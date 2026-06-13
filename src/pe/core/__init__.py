"""FastAPI dependency injection for DB sessions and RLS context."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pe.core.security import decode_access_token
from src.pe.database import async_session_factory

security_scheme = HTTPBearer(auto_error=False)


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    """Provide an async DB session without RLS context.

    For endpoints that need RLS isolation, use `get_rls_session` instead.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> dict:
    """Validate JWT and return the token payload.

    This dependency:
    1. Extracts the Bearer token from the Authorization header
    2. Decodes and validates the JWT
    3. Verifies the token has required claims (sub, tenant_id, role)

    Returns:
        Dict with user_id, tenant_id, role, and other claims.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "user_id": payload.get("sub"),
        "tenant_id": payload.get("tenant_id"),
        "role": payload.get("role", "learner"),
        "email_hash": payload.get("email_hash"),
    }


async def get_rls_session(
    current_user: dict = Depends(get_current_user),
) -> AsyncGenerator[AsyncSession]:
    """Provide a DB session with RLS context set from the JWT.

    Sets app.tenant_id, app.user_id, and app.user_role so that
    PostgreSQL RLS policies enforce tenant isolation.
    """
    async with async_session_factory() as session:
        try:
            await session.execute(
                text("SELECT pe.set_session_context(:tenant_id, :user_id, :user_role)"),
                {
                    "tenant_id": current_user["tenant_id"],
                    "user_id": current_user["user_id"],
                    "user_role": current_user["role"],
                },
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
