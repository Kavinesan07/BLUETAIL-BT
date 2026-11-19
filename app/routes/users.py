import os
import bcrypt
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Users, PasswordResetToken, EmailVerificationToken
from ..auth.jwt_handler import create_access_token
from ..auth.dependencies import get_current_user, require_super_admin, ROLE_SUPER_ADMIN
from ..auth.password_reset import (
    generate_otp,
    hash_reset_token,
    verify_reset_token,
    get_reset_token_expiry,
    is_reset_token_expired,
)
from ..email_service import send_reset_email, send_verification_email

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    otp: Optional[str] = None
    role: Optional[int] = 0


class SendRegistrationOtpRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


def user_to_dict(user: Users) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", 0) if getattr(user, "role", 0) is not None else 0,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


@router.post("/send-registration-otp")
async def send_registration_otp(data: SendRegistrationOtpRequest, db: Session = Depends(get_db)):
    # Check if email is already registered
    if db.query(Users).filter(Users.email == data.email).first():
        raise HTTPException(
            status_code=409,
            detail="An account with this email address already exists. Please log in instead.",
        )

    # Check if username is already taken
    if db.query(Users).filter(Users.username == data.username.strip()).first():
        raise HTTPException(
            status_code=409,
            detail="This username is already taken. Please choose another username.",
        )

    now = datetime.now(timezone.utc)
    # Invalidate previous unused verification tokens for this email
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == data.email,
        EmailVerificationToken.used_at == None,
    ).update({EmailVerificationToken.used_at: now})

    # Generate 6-digit verification OTP
    otp = generate_otp(6)
    otp_hash = hash_reset_token(otp)

    verif_record = EmailVerificationToken(
        email=data.email,
        otp_hash=otp_hash,
        expires_at=get_reset_token_expiry(),
        created_at=now,
    )
    db.add(verif_record)
    db.commit()

    # Deliver verification email (or fallback to console in dev)
    await send_verification_email(data.email, otp)

    res = {
        "message": "Verification OTP sent to your email.",
    }
    # Dev fallback
    if os.getenv("SMTP_USER") == "inga than mail varum" or not os.getenv("SMTP_HOST"):
        res["dev_otp"] = otp

    return res


@router.post("/create", status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(Users).filter(Users.email == data.email).first():
        raise HTTPException(
            status_code=409,
            detail="A user with this email address already exists."
        )

    if db.query(Users).filter(Users.username == data.username.strip()).first():
        raise HTTPException(
            status_code=409,
            detail="This username is already taken. Please choose another."
        )

    # If an OTP was provided, verify it against email_verification_tokens
    if data.otp:
        token_record = (
            db.query(EmailVerificationToken)
            .filter(
                EmailVerificationToken.email == data.email,
                EmailVerificationToken.used_at == None,
            )
            .order_by(EmailVerificationToken.id.desc())
            .first()
        )
        if not token_record:
            raise HTTPException(
                status_code=400,
                detail="No active verification code found for this email. Please request a new code.",
            )

        if is_reset_token_expired(token_record.expires_at):
            raise HTTPException(
                status_code=400,
                detail="Verification code has expired. Please request a new code.",
            )

        if not verify_reset_token(data.otp.strip(), token_record.otp_hash):
            raise HTTPException(
                status_code=400,
                detail="Invalid verification code. Please check your email and try again.",
            )

        # Mark verification token as used
        token_record.used_at = datetime.now(timezone.utc)

    user = Users(
        username=data.username.strip(),
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role if data.role is not None else 0,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not create user account."
        )

    # Do NOT return access_token here: the user must log in through the Login page first!
    return {
        "message": "Account created successfully! Please log in with your credentials.",
        "user": user_to_dict(user),
    }


@router.post("/login")
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == data.email).first()

    if not user or not bcrypt.checkpw(
        data.password.encode(),
        user.hashed_password.encode(),
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
        username=user.username,
    )

    return {
        "message": "Sign-in successful!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@router.get("/me")
def get_my_profile(current_user: Users = Depends(get_current_user)):
    """Verifies JWT bearer token and returns the authenticated user profile."""
    return {
        "user": user_to_dict(current_user),
    }


class UserRoleUpdate(BaseModel):
    role: int = Field(ge=0, le=2)


@router.get("", response_model=list[dict])
def list_users(
    db: Session = Depends(get_db),
    admin: Users = Depends(require_super_admin),
):
    """Super Admin only: View all registered users and their roles."""
    users = db.query(Users).order_by(Users.id.asc()).all()
    return [user_to_dict(u) for u in users]


@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if current_user.id != user_id and getattr(current_user, "role", 0) != ROLE_SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this user profile",
        )

    user = db.query(Users).filter(Users.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return {
        "user": user_to_dict(user),
    }


@router.put("/{user_id}/role")
def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: Users = Depends(require_super_admin),
):
    """Super Admin only: Promote or update a user's role (0=Customer, 1=Shop Owner, 2=Super Admin)."""
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = data.role
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return {
        "message": f"User {user.username} role updated to {data.role}",
        "user": user_to_dict(user),
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=64)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=64)
    new_password: str = Field(min_length=6, max_length=72)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == data.email).first()
    if not user:
        return {
            "message": "If this email is registered, a password reset OTP has been sent.",
        }

    now = datetime.now(timezone.utc)
 
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at == None,
    ).update({PasswordResetToken.used_at: now})

    # Generate 6-digit OTP and store its SHA-256 hash
    otp = generate_otp(6)
    token_hash = hash_reset_token(otp)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=get_reset_token_expiry(),
        created_at=now,
    )
    db.add(reset_record)
    db.commit()

    # Deliver OTP via email or console fallback
    await send_reset_email(user.email, otp)

    response = {
        "message": "Password reset OTP has been sent to your email.",
    }
    if os.getenv("SMTP_USER") == "inga than mail varum" or not os.getenv("SMTP_HOST"):
        response["fill_otp"] = otp
        response["dev_otp"] = otp

    return response


@router.post("/verify-otp")
def verify_otp(data: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == data.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or OTP.")

    token_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at == None,
        )
        .order_by(PasswordResetToken.id.desc())
        .first()
    )

    if not token_record:
        raise HTTPException(status_code=400, detail="No active password reset request found.")

    if is_reset_token_expired(token_record.expires_at):
        raise HTTPException(status_code=400, detail="Reset OTP has expired. Please request a new one.")

    if not verify_reset_token(data.otp.strip(), token_record.token_hash):
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please check and try again.")

    return {
        "valid": True,
        "message": "OTP is valid. You can now reset your password.",
    }


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == data.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or OTP.")

    token_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at == None,
        )
        .order_by(PasswordResetToken.id.desc())
        .first()
    )

    if not token_record:
        raise HTTPException(status_code=400, detail="No active password reset request found.")

    if is_reset_token_expired(token_record.expires_at):
        raise HTTPException(status_code=400, detail="Reset OTP has expired. Please request a new one.")

    if not verify_reset_token(data.otp.strip(), token_record.token_hash):
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    # Update password with bcrypt hash and mark token as used
    now = datetime.now(timezone.utc)
    user.hashed_password = hash_password(data.new_password)
    user.updated_at = now
    token_record.used_at = now

    db.commit()

    return {
        "message": "Password has been reset successfully! You can now log in with your new password.",
    }
