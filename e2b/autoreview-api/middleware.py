"""
AutoReview AI — JWT Authentication Middleware.

Validates Bearer tokens on protected routes,
extracts user_id into request state.
"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from starlette.responses import Response

from config import get_settings

# Routes that skip authentication
PUBLIC_PATHS = frozenset(
    {
        "/",
        "/health",
        "/docs",
        "/openapi.json",
        "/auth/github",
        "/auth/github/callback",
        "/billing/webhook",
        "/github/install/callback",
    }
)

security = HTTPBearer(auto_error=False)


def create_token(user_id: str, github_login: str) -> str:
    """Create a signed JWT session token."""
    settings = get_settings()
    payload = {
        "sub": user_id,
        "login": github_login,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
    }
    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware that validates JWT on protected routes."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        path = request.url.path.rstrip("/") or "/"

        # Skip auth for public routes and preflight
        if path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # Also skip paths that start with public prefixes
        if any(path.startswith(p) for p in ("/docs", "/redoc", "/openapi")):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)

        # Attach user info to request state
        request.state.user_id = payload["sub"]
        request.state.github_login = payload.get("login", "")

        return await call_next(request)
