"""JWT token handling and password utilities.

Implements the authentication strategy from ADR-001:
- Short-lived access tokens (15 min) with tenant_id claim
- Long-lived refresh tokens (7 days)
- bcrypt password hashing
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
import structlog
from pydantic import ValidationError

from src.pe.config import settings

logger = structlog.get_logger(__name__)


def create_access_token(
    user_id: str,
    tenant_id: str,
    role: str,
    email_hash: str | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token.

    Args:
        user_id: The user's UUID.
        tenant_id: The tenant/institution UUID.
        role: User role (super_admin, institution_admin, etc.).
        email_hash: SHA-256 hash of email for lookups (not PHI).
        expires_delta: Custom expiry duration.

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "iat": now,
        "type": "access",
    }

    if email_hash:
        payload["email_hash"] = email_hash

    expire = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    payload["exp"] = expire

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    tenant_id: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT refresh token."""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "iat": now,
        "type": "refresh",
    }
    expire = now + (expires_delta or timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS))
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate an access token.

    Returns:
        The payload dict, or None if the token is invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            logger.warning("decode_access_token invalid type", expected="access", actual=payload.get("type"))
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("decode_access_token expired", error="token_expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.debug("decode_access_token invalid", error=str(exc))
        return None
    except ValidationError as exc:
        logger.warning("decode_access_token validation error", error=str(exc))
        return None


def decode_refresh_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "refresh":
            logger.warning("decode_refresh_token invalid type", expected="refresh", actual=payload.get("type"))
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("decode_refresh_token expired", error="token_expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.debug("decode_refresh_token invalid", error=str(exc))
        return None
    except ValidationError as exc:
        logger.warning("decode_refresh_token validation error", error=str(exc))
        return None


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except (ValueError, TypeError) as exc:
        logger.warning("verify_password failed", error=str(exc))
        return False
