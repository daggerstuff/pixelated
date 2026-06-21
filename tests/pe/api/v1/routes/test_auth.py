import warnings

from src.pe.api.v1.routes.auth import _encrypt_email


def test_encrypt_email_returns_bytes():
    """Test that _encrypt_email correctly returns bytes and warns."""
    email = "test@example.com"
    key = "dummy_key"

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = _encrypt_email(email, key)

        # Verify it returns bytes
        assert isinstance(result, bytes)
        # Verify it just encodes the email directly (dev stub behavior)
        assert result == email.encode("utf-8")

        # Verify the warning is emitted
        assert len(w) == 1
        assert "DEV-ONLY stub" in str(w[-1].message)


def test_encrypt_email_empty_string():
    """Test _encrypt_email handles empty strings gracefully."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = _encrypt_email("", "key")
        assert result == b""


def test_encrypt_email_ignores_key():
    """Test _encrypt_email behavior is independent of the provided key (dev stub)."""
    email = "test@example.com"

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result1 = _encrypt_email(email, "key1")
        result2 = _encrypt_email(email, "key2")

        assert result1 == result2
        assert result1 == email.encode("utf-8")
