import pytest

from src.pe.api.v1.routes.auth import _decrypt_email, _encrypt_email

# Ensure a deterministic key for tests — valid 64-char hex (32 bytes)
_TEST_KEY = "a" * 64


@pytest.fixture(autouse=True)
def _set_encryption_key(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", _TEST_KEY)
    # Reload settings so the new key takes effect
    from src.pe.config import Settings

    monkeypatch.setattr("src.pe.api.v1.routes.auth.settings", Settings())


def test_encrypt_email_returns_bytes():
    """_encrypt_email returns bytes (ciphertext, not plaintext)."""
    result = _encrypt_email("test@example.com")

    assert isinstance(result, bytes)
    # AES-GCM: 12-byte nonce + ciphertext + 16-byte tag
    assert len(result) == 12 + len("test@example.com") + 16


def test_encrypt_email_not_plaintext():
    """Ciphertext must not contain the plaintext email."""
    email = "test@example.com"
    result = _encrypt_email(email)

    assert email.encode("utf-8") not in result
    assert result != email.encode("utf-8")


def test_encrypt_email_empty_string():
    """_encrypt_email handles empty strings."""
    result = _encrypt_email("")

    assert isinstance(result, bytes)
    assert len(result) == 12 + 16  # nonce + tag, no plaintext


def test_encrypt_decrypt_round_trip():
    """Decrypting an encrypted email returns the original."""
    email = "user@hospital.org"
    ciphertext = _encrypt_email(email)

    assert _decrypt_email(ciphertext) == email


def test_encrypt_decrypt_round_trip_empty():
    """Round-trip works for empty string."""
    ciphertext = _encrypt_email("")

    assert _decrypt_email(ciphertext) == ""


def test_encrypt_email_unique_ciphertext():
    """Each encryption produces a different ciphertext (random nonce)."""
    email = "test@example.com"
    result1 = _encrypt_email(email)
    result2 = _encrypt_email(email)

    assert result1 != result2
    # But both decrypt to the same value
    assert _decrypt_email(result1) == email
    assert _decrypt_email(result2) == email


def test_decrypt_email_tamper_detection():
    """Tampered ciphertext raises an InvalidTag error."""
    ciphertext = bytearray(_encrypt_email("test@example.com"))
    ciphertext[20] ^= 1  # Flip a bit in the ciphertext

    with pytest.raises(Exception):
        _decrypt_email(bytes(ciphertext))


def test_decrypt_email_short_ciphertext():
    """Ciphertext too short raises ValueError."""
    with pytest.raises(ValueError, match="too short"):
        _decrypt_email(b"short")
