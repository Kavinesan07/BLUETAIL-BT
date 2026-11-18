from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Users
from .jwt_handler import verify_access_token

optional_security = HTTPBearer(auto_error=False)


def _extract_token(
    access_token: str | None = Cookie(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> str | None:
    if access_token:
        return access_token
    if credentials and credentials.credentials:
        return credentials.credentials
    return None


def get_current_user(
    token: str | None = Depends(_extract_token),
    db: Session = Depends(get_db),
) -> Users:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(token)
    user_id = payload.get("sub") or payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identification",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(Users).filter(Users.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_admin(
    current_user: Users = Depends(get_current_user),
) -> Users:
    if getattr(current_user, "role", 0) != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to perform this action",
        )
    return current_user


def get_optional_current_user(
    token: str | None = Depends(_extract_token),
    db: Session = Depends(get_db),
) -> Users | None:
    if not token:
        return None
    try:
        payload = verify_access_token(token)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return None
        return db.query(Users).filter(Users.id == int(user_id)).first()
    except Exception:
        return None