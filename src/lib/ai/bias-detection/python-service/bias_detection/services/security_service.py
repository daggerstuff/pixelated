"""
Security and audit logging for bias detection service.
Handles encryption, authentication, and HIPAA-compliant audit trails.
Framework-agnostic implementation.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from functools import partial
from typing import Any

import jwt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class SecurityManager:
    """Handles encryption, authentication, and HIPAA compliance."""

    def __init__(self, jwt_secret_key: str | None = None):
        self.encryption_key = self._generate_encryption_key()
        self.fernet = Fernet(self.encryption_key)
        self.jwt_secret_key = jwt_secret_key

    def _generate_encryption_key(self) -> bytes:
        """Generate encryption key from environment variables.

        Requires ENCRYPTION_PASSWORD and ENCRYPTION_SALT environment variables.
        Fails securely if not configured - no hardcoded defaults.
        """
        password = os.environ.get("ENCRYPTION_PASSWORD")
        salt = os.environ.get("ENCRYPTION_SALT")

        if not password:
            raise RuntimeError(
                "ENCRYPTION_PASSWORD environment variable is required. "
                "Generate a secure random password for encryption."
            )
        if not salt:
            raise RuntimeError(
                "ENCRYPTION_SALT environment variable is required. "
                "Generate a secure random salt for encryption."
            )

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt.encode(),
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data."""
        return self.fernet.encrypt(data.encode()).decode()

    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        return self.fernet.decrypt(encrypted_data.encode()).decode()

    def hash_session_id(self, session_id: str) -> str:
        """Create a cryptographic hash of a session ID."""
        return hashlib.sha256(session_id.encode()).hexdigest()

    def verify_jwt_token(self, token: str, secret_key: str | None = None) -> dict[str, Any]:
        """Verify JWT token and return payload."""
        effective_secret = secret_key or self.jwt_secret_key
        if not effective_secret:
            raise RuntimeError("JWT secret key not configured")

        try:
            return jwt.decode(token, effective_secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError as e:
            raise ValueError("Token has expired") from e
        except jwt.InvalidTokenError as e:
            raise ValueError("Invalid token") from e


class AuditLogger:
    """
    HIPAA-compliant audit logging service.

    Note: This implementation writes to a local file for development/testing.
    For production HIPaa compliance, configure AUDIT_LOG_PATH to point to a
    secure, append-only log destination or replace with a centralized logging
    service (e.g., AWS CloudWatch Logs, Splunk, ELK stack).
    """

    def __init__(self, security_manager: SecurityManager, audit_log_path: str | None = None):
        self.security_manager = security_manager
        # Use environment variable for production path, default to /var/log/ for HIPAA compliance
        self.audit_log_path = audit_log_path or os.environ.get(
            "AUDIT_LOG_PATH",
            "/tmp/bias_detection_audit.log"  # Temporary default - change for production
        )

    async def log_event(
        self,
        event_type: str,
        user_context: dict[str, Any],
        details: dict[str, Any],
        sensitive_data: bool = False,
    ) -> None:
        """Log an audit event securely, encrypting details if sensitive."""
        session_id = user_context.get("session_id", "unknown")
        user_id = user_context.get("user_id", "anonymous")
        ip_address = user_context.get("ip_address", "system")
        user_agent = user_context.get("user_agent", "system")

        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "session_id_hash": self.security_manager.hash_session_id(session_id),
            "user_id": user_id,
            "details": "ENCRYPTED" if sensitive_data else details,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }

        if sensitive_data:
            audit_entry["encrypted_details"] = self.security_manager.encrypt_data(
                json.dumps(details)
            )

        try:
            # Use run_in_executor to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                partial(self._write_audit_log, audit_entry)
            )
            logger.info("Audit event logged: %s for user: %s", event_type, user_id)
        except Exception as e:
            logger.error("Failed to write audit log: %s", e)

    def _write_audit_log(self, audit_entry: dict[str, Any]) -> None:
        """
        Synchronous helper to write audit log entry to disk.

        Note: For production HIPAA compliance, this should write to:
        - A centralized logging service (e.g., Splunk, ELK, CloudWatch)
        - A dedicated audit database with append-only access
        - A secure audit log aggregation system
        """
        with open(self.audit_log_path, "a") as f:
            f.write(json.dumps(audit_entry) + "\n")

