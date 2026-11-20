
import secrets
import hashlib
import hmac

from datetime import datetime, timedelta, timezone


RESET_TOKEN_EXPIRE_MINUTES = 15


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def verify_reset_token(
    token: str,
    stored_hash: str
) -> bool:

    token_hash = hash_reset_token(token)

    return hmac.compare_digest(
        token_hash,
        stored_hash
    )


def get_reset_token_expiry():
    return datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_EXPIRE_MINUTES
    )


def is_reset_token_expired(expires_at) -> bool:

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    return datetime.now(timezone.utc) >= expires_at
