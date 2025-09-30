"""
Security utilities for MCP server.

This module provides cryptographic functions for password hashing, token generation,
and other security-related operations following industry best practices and HIPAA compliance.
"""

import secrets
import hashlib
import hmac
from typing import Optional
from datetime import datetime, timedelta

import bcrypt
import structlog

from mcp_server.config import settings


logger = structlog.get_logger(__name__)


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with appropriate cost factor.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string

    Raises:
        ValueError: If password is invalid
    """
    if not password:
        raise ValueError("Password cannot be empty")

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    # Generate salt and hash password
    salt = bcrypt.gensalt(rounds=settings.auth.bcrypt_rounds)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)

    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        password: Plain text password to verify
        hashed: Stored password hash

    Returns:
        True if password matches, False otherwise

    Raises:
        ValueError: If inputs are invalid
    """
    if not password or not hashed:
        return False

    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        logger.warning("Password verification failed due to invalid hash format")
        return False


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure random token.

    Args:
        length: Length of the token in characters (must be even)

    Returns:
        Secure random token as hexadecimal string

    Raises:
        ValueError: If length is invalid
    """
    if length < 16:
        raise ValueError("Token length must be at least 16 characters")

    if length % 2 != 0:
        raise ValueError("Token length must be even")

    # Generate random bytes and convert to hex
    num_bytes = length // 2
    random_bytes = secrets.token_bytes(num_bytes)
    return random_bytes.hex()


def generate_api_key() -> str:
    """
    Generate a secure API key.

    Returns:
        API key in format: prefix_random_string
    """
    prefix = "mcp_"
    random_part = generate_secure_token(48)  # 48 hex chars = 24 bytes
    return f"{prefix}{random_part}"


def hash_data(data: str, algorithm: str = "sha256") -> str:
    """
    Hash data using specified algorithm.

    Args:
        data: Data to hash
        algorithm: Hash algorithm (sha256, sha512, sha1)

    Returns:
        Hexadecimal hash string

    Raises:
        ValueError: If algorithm is not supported
    """
    if algorithm not in ["sha256", "sha512", "sha1"]:
        raise ValueError(f"Unsupported hash algorithm: {algorithm}")

    hash_func = getattr(hashlib, algorithm)
    return hash_func(data.encode('utf-8')).hexdigest()


def create_hmac_signature(message: str, key: str, algorithm: str = "sha256") -> str:
    """
    Create HMAC signature for message authentication.

    Args:
        message: Message to sign
        key: Secret key for HMAC
        algorithm: Hash algorithm (sha256, sha512)

    Returns:
        Hexadecimal HMAC signature

    Raises:
        ValueError: If algorithm is not supported
    """
    if algorithm not in ["sha256", "sha512"]:
        raise ValueError(f"Unsupported HMAC algorithm: {algorithm}")

    return hmac.new(
        key.encode('utf-8'),
        message.encode('utf-8'),
        getattr(hashlib, algorithm)
    ).hexdigest()


def verify_hmac_signature(message: str, signature: str, key: str, algorithm: str = "sha256") -> bool:
    """
    Verify HMAC signature.

    Args:
        message: Original message
        signature: HMAC signature to verify
        key: Secret key for HMAC
        algorithm: Hash algorithm used

    Returns:
        True if signature is valid, False otherwise
    """
    expected_signature = create_hmac_signature(message, key, algorithm)
    return hmac.compare_digest(expected_signature, signature)


def sanitize_input(input_string: str, max_length: int = 1000) -> str:
    """
    Sanitize input string by removing potentially dangerous characters.

    Args:
        input_string: String to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized string

    Raises:
        ValueError: If input is too long
    """
    if not input_string:
        return ""

    if len(input_string) > max_length:
        raise ValueError(f"Input exceeds maximum length of {max_length} characters")

    # Remove null bytes and control characters
    sanitized = input_string.replace('\x00', '').replace('\x1f', '')

    # Strip leading/trailing whitespace
    return sanitized.strip()


def validate_email_format(email: str) -> bool:
    """
    Validate email format using basic regex pattern.

    Args:
        email: Email address to validate

    Returns:
        True if email format is valid, False otherwise
    """
    import re

    if not email or len(email) > 254:  # RFC 5321 limit
        return False

    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def generate_session_id() -> str:
    """
    Generate a secure session ID.

    Returns:
        Session ID as hexadecimal string
    """
    return generate_secure_token(32)


def generate_csrf_token() -> str:
    """
    Generate a CSRF protection token.

    Returns:
        CSRF token as hexadecimal string
    """
    return generate_secure_token(32)


def constant_time_compare(a: str, b: str) -> bool:
    """
    Compare two strings in constant time to prevent timing attacks.

    Args:
        a: First string
        b: Second string

    Returns:
        True if strings are equal, False otherwise
    """
    return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))


def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
    """
    Mask sensitive data for logging (e.g., API keys, tokens).

    Args:
        data: Sensitive data to mask
        visible_chars: Number of characters to keep visible at the end

    Returns:
        Masked data string
    """
    if not data:
        return ""

    if len(data) <= visible_chars:
        return "*" * len(data)

    masked_part = "*" * (len(data) - visible_chars)
    visible_part = data[-visible_chars:]
    return f"{masked_part}{visible_part}"


def validate_password_strength(password: str) -> dict:
    """
    Validate password strength and return detailed feedback.

    Args:
        password: Password to validate

    Returns:
        Dictionary with validation results and feedback
    """
    result = {
        "valid": False,
        "score": 0,
        "feedback": [],
        "requirements": {
            "min_length": 8,
            "max_length": 128,
            "require_uppercase": True,
            "require_lowercase": True,
            "require_digit": True,
            "require_special": True
        }
    }

    if not password:
        result["feedback"].append("Password cannot be empty")
        return result

    # Length check
    if len(password) < result["requirements"]["min_length"]:
        result["feedback"].append(f"Password must be at least {result['requirements']['min_length']} characters long")
    elif len(password) > result["requirements"]["max_length"]:
        result["feedback"].append(f"Password must not exceed {result['requirements']['max_length']} characters")
    else:
        result["score"] += 1

    # Character type checks
    has_uppercase = any(c.isupper() for c in password)
    has_lowercase = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)

    if result["requirements"]["require_uppercase"] and not has_uppercase:
        result["feedback"].append("Password must contain at least one uppercase letter")
    elif has_uppercase:
        result["score"] += 1

    if result["requirements"]["require_lowercase"] and not has_lowercase:
        result["feedback"].append("Password must contain at least one lowercase letter")
    elif has_lowercase:
        result["score"] += 1

    if result["requirements"]["require_digit"] and not has_digit:
        result["feedback"].append("Password must contain at least one digit")
    elif has_digit:
        result["score"] += 1

    if result["requirements"]["require_special"] and not has_special:
        result["feedback"].append("Password must contain at least one special character")
    elif has_special:
        result["score"] += 1

    # Common password check (simple implementation)
    common_passwords = {
        "password", "123456", "12345678", "qwerty", "abc123",
        "password123", "admin", "letmein", "welcome", "monkey"
    }

    if password.lower() in common_passwords:
        result["feedback"].append("Password is too common, please choose a more unique password")
    else:
        result["score"] += 1

    # Determine validity
    result["valid"] = result["score"] >= 5 and len(result["feedback"]) == 0

    return result


def generate_secure_random_string(length: int = 16, charset: Optional[str] = None) -> str:
    """
    Generate a secure random string using secrets module.

    Args:
        length: Length of the string to generate
        charset: Character set to use (default: alphanumeric + special chars)

    Returns:
        Secure random string
    """
    if charset is None:
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"

    if not charset:
        raise ValueError("Character set cannot be empty")

    return ''.join(secrets.choice(charset) for _ in range(length))


def secure_compare_timestamps(timestamp1: datetime, timestamp2: datetime, tolerance_seconds: int = 300) -> bool:
    """
    Securely compare two timestamps within a tolerance window.

    Args:
        timestamp1: First timestamp
        timestamp2: Second timestamp
        tolerance_seconds: Tolerance in seconds

    Returns:
        True if timestamps are within tolerance, False otherwise
    """
    if not isinstance(timestamp1, datetime) or not isinstance(timestamp2, datetime):
        return False

    time_diff = abs((timestamp1 - timestamp2).total_seconds())
    return time_diff <= tolerance_seconds
