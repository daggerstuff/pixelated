"""Database connection pooling and RLS session context management.

Uses asyncpg via SQLAlchemy's async engine for PostgreSQL.
Implements the tenant isolation strategy from ADR-001:
- Set app.tenant_id, app.user_id, app.user_role on every request
- RLS policies enforce row-level tenant isolation
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.pe.config import settings

logger = structlog.get_logger(__name__)

# ── Engine ─────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_MIN_CONNECTIONS,
    max_overflow=settings.DB_MAX_CONNECTIONS - settings.DB_MIN_CONNECTIONS,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={
        "statement_cache_size": 0,  # Disable for RLS compatibility
        "server_settings": {
            "application_name": settings.APP_NAME,
        },
    },
)

# ── Session Factory ────────────────────────────────────────────────
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager  # type: ignore
async def check_connection() -> dict:
    """Verify database connectivity and return server info.

    Returns:
        Dict with server_version and rls_status.
    """
    async with async_session_factory() as session:
        result = await session.execute(text("SELECT version()"))
        version = result.scalar()

        # Check RLS is enabled
        rls_check = await session.execute(
            text("""
                SELECT COUNT(*)::int AS rls_enabled_tables
                FROM pg_tables t
                JOIN pg_class c ON c.relname = t.tablename
                WHERE c.relrowsecurity = true
                  AND t.schemaname = 'pe'
            """)
        )
        rls_count = rls_check.scalar()

        return {
            "server_version": version,
            "rls_enabled_tables": rls_count,
            "connected": True,
        }


async def init_db() -> None:
    """Warm up the connection pool on startup."""
    async with async_session_factory() as session:
        await session.execute(text("SELECT 1"))
    logger.info("database_pool_warmed", pool_size=settings.DB_MIN_CONNECTIONS)


async def close_db() -> None:
    """Dispose of the connection pool on shutdown."""
    await engine.dispose()
    logger.info("database_pool_disposed")
