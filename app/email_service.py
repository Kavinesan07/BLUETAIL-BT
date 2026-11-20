import os
import smtplib
from email.message import EmailMessage
import anyio

# Sender email configuration
# Inga than mail varum -> Replace with your sender email address (e.g. your_email@gmail.com)
DEFAULT_SMTP_USER = "inga than mail varum"

# Pass word venna -> Replace with your Gmail App Password (e.g. 16-character app password)
DEFAULT_SMTP_PASSWORD = " pass word venna "


def _send_sync(message, host, port, user, password):
    with smtplib.SMTP(host, port, timeout=10) as server:
        server.starttls()
        if user and password:
            server.login(user, password)
        server.send_message(message)


async def send_verification_email(
    recipient_email: str,
    otp: str,
):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", DEFAULT_SMTP_USER)
    smtp_password = os.getenv("SMTP_PASSWORD", DEFAULT_SMTP_PASSWORD)

    message = EmailMessage()
    message["Subject"] = "Verify Your Bluetail Account - OTP Code"
    message["From"] = smtp_user if smtp_user != DEFAULT_SMTP_USER else "noreply@bluetail.shop"
    message["To"] = recipient_email

    message.set_content(
        f"""Hello,

Thank you for signing up with Bluetail!

Your Email Verification OTP Code is: {otp}

Please enter this code on the registration page to verify your email address and activate your account.
This OTP code will expire in 15 minutes.

If you did not request this, please ignore this email.

Regards,
Bluetail Team
"""
    )

    if not smtp_host or smtp_user == DEFAULT_SMTP_USER or smtp_password == DEFAULT_SMTP_PASSWORD:
        # Dev fallback when SMTP credentials are not filled yet
        print(f"\n=======================================================")
        print(f"[BLUETAIL REGISTRATION OTP] Code for {recipient_email}: {otp}")
        print(f"NOTE: To send real emails, update 'inga than mail varum' and ' pass word venna ' in .env or app/email_service.py!")
        print(f"=======================================================\n")
        return False

    try:
        await anyio.to_thread.run_sync(
            _send_sync, message, smtp_host, smtp_port, smtp_user, smtp_password
        )
        return True
    except Exception as e:
        print(f"Failed to send email via SMTP: {e}")
        print(f"[FALLBACK OTP] Verification code for {recipient_email}: {otp}\n")
        return False


async def send_reset_email(
    recipient_email: str,
    reset_token_or_otp: str,
):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", DEFAULT_SMTP_USER)
    smtp_password = os.getenv("SMTP_PASSWORD", DEFAULT_SMTP_PASSWORD)

    reset_link = f"{frontend_url}/forgot-password?otp={reset_token_or_otp}&email={recipient_email}"

    message = EmailMessage()
    message["Subject"] = "Reset Your Bluetail Password"
    message["From"] = smtp_user if smtp_user != DEFAULT_SMTP_USER else "noreply@bluetail.shop"
    message["To"] = recipient_email

    message.set_content(
        f"""Hello,

We received a request to reset your Bluetail password.

Your Password Reset OTP is: {reset_token_or_otp}

You can also use this link to reset your password:
{reset_link}

This OTP expires in 15 minutes and can only be used once.

If you did not request this, please ignore this email.

Regards,
Bluetail Team
"""
    )

    if not smtp_host or smtp_user == DEFAULT_SMTP_USER or smtp_password == DEFAULT_SMTP_PASSWORD:
        # Dev fallback when SMTP credentials are not filled yet
        print(f"\n=======================================================")
        print(f"[BLUETAIL PASSWORD RESET OTP] OTP for {recipient_email}: {reset_token_or_otp}")
        print(f"[BLUETAIL LINK] {reset_link}")
        print(f"NOTE: To send real emails, update 'inga than mail varum' and ' pass word venna ' in .env or app/email_service.py!")
        print(f"=======================================================\n")
        return False

    try:
        await anyio.to_thread.run_sync(
            _send_sync, message, smtp_host, smtp_port, smtp_user, smtp_password
        )
        return True
    except Exception as e:
        print(f"Failed to send email via SMTP: {e}")
        print(f"[FALLBACK OTP] Reset OTP for {recipient_email}: {reset_token_or_otp}\n")
        return False
