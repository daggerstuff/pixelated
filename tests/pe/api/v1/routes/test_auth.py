import pytest

from src.pe.api.v1.routes.auth import _encrypt_email


def test_encrypt_email_returns_bytes():
    """Test that _encrypt_email correctly returns bytes and warns."""
    email = "test@example.com"
    key = "dummy_key"

    with pytest.warns(UserWarning, match="_encrypt_email is a DEV-ONLY stub"):
        result = _encrypt_email(email, key)

    assert isinstance(result, bytes)
    assert result == email.encode("utf-8")


def test_encrypt_email_empty_string():
    """Test _encrypt_email handles empty strings gracefully."""
    with pytest.warns(UserWarning, match="_encrypt_email is a DEV-ONLY stub"):
        result = _encrypt_email("", "key")

    assert result == b""


def test_encrypt_email_ignores_key():
    """Test _encrypt_email behavior is independent of the provided key (dev stub)."""
    email = "test@example.com"

    with pytest.warns(UserWarning, match="_encrypt_email is a DEV-ONLY stub"):
        result1 = _encrypt_email(email, "key1")

    with pytest.warns(UserWarning, match="_encrypt_email is a DEV-ONLY stub"):
        result2 = _encrypt_email(email, "key2")

    assert result1 == result2
    assert result1 == email.encode("utf-8")
