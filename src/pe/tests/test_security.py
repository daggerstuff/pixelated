"""Tests for security/JWT module."""

from datetime import timedelta

from src.pe.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


class TestJWT:
    """Verify JWT token creation and validation."""

    def test_create_and_decode_access_token(self) -> None:
        """Should create a valid access token."""
        token = create_access_token(
            user_id="user-1",
            tenant_id="tenant-1",
            role="institution_admin",
        )
        assert isinstance(token, str)
        assert len(token) > 50

        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"
        assert payload["tenant_id"] == "tenant-1"
        assert payload["role"] == "institution_admin"
        assert payload["type"] == "access"

    def test_refresh_token(self) -> None:
        """Should create and validate refresh tokens."""
        token = create_refresh_token(
            user_id="user-1",
            tenant_id="tenant-1",
        )
        payload = decode_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"
        assert payload["type"] == "refresh"

    def test_access_token_rejected_as_refresh(self) -> None:
        """Access token should not decode as refresh."""
        token = create_access_token(
            user_id="user-1",
            tenant_id="tenant-1",
            role="learner",
        )
        assert decode_refresh_token(token) is None

    def test_expired_token_returns_none(self) -> None:
        """Expired token should return None."""
        token = create_access_token(
            user_id="user-1",
            tenant_id="tenant-1",
            role="learner",
            expires_delta=timedelta(seconds=-1),  # Already expired
        )
        assert decode_access_token(token) is None

    def test_invalid_token_returns_none(self) -> None:
        """Invalid token should return None."""
        assert decode_access_token("not-a-real-token") is None


class TestPassword:
    """Verify password hashing and verification."""

    def test_hash_and_verify(self) -> None:
        """Should hash and verify passwords correctly."""
        password = "SecureP@ss123!"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self) -> None:
        """Wrong password should not verify."""
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False
