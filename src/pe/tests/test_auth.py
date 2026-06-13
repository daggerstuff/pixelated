"""Tests for authentication and user management API endpoints."""

import pytest
from httpx import AsyncClient

from src.pe.core.security import create_access_token, hash_password, verify_password


class TestAuthEndpoints:
    """Integration tests for auth endpoints."""

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Health endpoint should return 200."""
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("healthy", "degraded")

    @pytest.mark.asyncio
    async def test_login_missing_fields(self, client: AsyncClient):
        """Login without credentials should return 422."""
        response = await client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Login with bad credentials should return 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword123",
            },
        )
        assert response.status_code == 401
        assert "Invalid email or password" in response.text

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client: AsyncClient):
        """Refresh with invalid token should return 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": "invalid-token-here",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_unauthenticated(self, client: AsyncClient):
        """Accessing /me without auth should return 401."""
        response = await client.get("/api/v1/auth/users/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_users_unauthenticated(self, client: AsyncClient):
        """Listing users without auth should return 401."""
        response = await client.get("/api/v1/auth/users")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_user_no_auth(self, client: AsyncClient):
        """Creating a user without auth should return 401."""
        response = await client.post(
            "/api/v1/auth/users",
            json={
                "email": "test@example.com",
                "display_name": "Test User",
                "password": "SecurePass123!",
                "role": "learner",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_institution_no_auth(self, client: AsyncClient):
        """Creating institution without auth should return 401."""
        response = await client.post(
            "/api/v1/auth/institutions",
            json={
                "name": "Test Medical School",
                "slug": "test-medical",
                "institution_type": "medical_school",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_api_key_no_auth(self, client: AsyncClient):
        """Creating API key without auth should return 401."""
        response = await client.post(
            "/api/v1/auth/api-keys",
            json={
                "label": "Test Key",
                "role": "manager",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_auth_with_valid_token(self, client: AsyncClient):
        """Using a valid JWT should pass auth checks."""
        token = create_access_token(
            user_id="00000000-0000-0000-0000-000000000001",
            tenant_id="00000000-0000-0000-0000-000000000001",
            role="manager",
        )
        response = await client.get(
            "/api/v1/auth/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        # May 404 if user not in DB, but should not 401
        assert response.status_code != 401


class TestSecurityUnit:
    """Unit tests for security functions."""

    def test_password_hashing(self):
        """Password hashing should work correctly."""
        pw = "TestPassword123!"
        hashed = hash_password(pw)
        assert verify_password(pw, hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_jwt_token_creation(self):
        """JWT token creation should produce valid tokens."""
        token = create_access_token(
            user_id="user-1",
            tenant_id="tenant-1",
            role="institution_admin",
        )
        assert token is not None
        assert len(token) > 50
