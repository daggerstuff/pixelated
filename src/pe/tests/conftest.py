"""Test fixtures for the Pixelated Empathy backend."""

from __future__ import annotations

from typing import Any, AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from src.pe.config import settings
from src.pe.database import async_session_factory
from src.pe.main import app


@pytest.fixture
def anyio_backend() -> str:
    """Use asyncio backend for anyio."""
    return "asyncio"


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for testing (no RLS)."""
    async with async_session_factory() as session:
        yield session
        await session.rollback()
        await session.close()


# ── Mock JWT token helper ─────────────────────────────────────────
def make_test_token(
    user_id: str = "test-user-0000-0000-000000000001",
    tenant_id: str = "test-tenant-0000-0000-000000000001",
    role: str = "learner",
) -> str:
    """Create a test JWT token for integration tests."""
    from src.pe.core.security import create_access_token
    return create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        email_hash="abc123def456",
    )