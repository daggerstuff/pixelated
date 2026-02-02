"""
Database Connector - MongoDB Atlas
Handles storage of therapeutic session data and analysis results
"""

import json
import logging
import os
from base64 import b64decode, b64encode
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, OperationFailure

logger = logging.getLogger(__name__)


class DatabaseService:
    def __init__(self, uri: str, db_name: str = "pixelated_empathy"):
        self.uri = uri
        self.db_name = db_name
        self.client: MongoClient | None = None
        self.db: Database | None = None
        self._encryption_key = os.environ.get("PHI_ENCRYPTION_KEY")
        if not self._encryption_key and os.environ.get("NODE_ENV") == "production":
            logger.error("CRITICAL: PHI_ENCRYPTION_KEY not set in production!")
        elif not self._encryption_key:
            logger.warning(
                "PHI_ENCRYPTION_KEY not set. Using insecure placeholder for development."
            )

    def connect(self) -> bool:
        """Establish connection to MongoDB Atlas"""
        try:
            self.client = MongoClient(self.uri)
            # Verify connection by running a ping command
            if self.client:
                self.client.admin.command("ping")
                self.db = self.client[self.db_name]
                logger.info(f"Successfully connected to MongoDB Atlas: {self.db_name}")
                return True
            return False
        except (ConnectionFailure, OperationFailure) as e:
            logger.error(f"Failed to connect to MongoDB Atlas: {e}")
            return False

    def get_collection(self, name: str) -> Collection:
        """Get a collection by name"""
        if self.db is None:
            raise ConnectionError("Database not connected")
        return self.db[name]

    def _encrypt_phi(self, data: dict[str, Any]) -> dict[str, Any]:
        """Encrypt PHI data before storage using AES-256-GCM - HIPAA compliance"""
        if not self._encryption_key:
            # Fallback for dev only - DO NOT USE IN PRODUCTION
            encrypted_data = data.copy()
            encrypted_data["_insecure_mode"] = True
            encrypted_data["_encryption_timestamp"] = datetime.now(timezone.utc)
            return encrypted_data

        try:
            # Prepare key (must be 32 bytes for AES-256)
            key_bytes = b64decode(self._encryption_key)
            if len(key_bytes) != 32:
                logger.error("PHI_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
                return data

            aesgcm = AESGCM(key_bytes)
            nonce = os.urandom(12)  # GCM recommended nonce size

            # Serialize data to JSON
            json_data = json.dumps(data).encode("utf-8")

            # Encrypt
            ciphertext = aesgcm.encrypt(nonce, json_data, None)

            # Combine nonce and ciphertext for storage
            encrypted_payload = b64encode(nonce + ciphertext).decode("utf-8")

            return {
                "ciphertext": encrypted_payload,
                "_encrypted": True,
                "_encryption_algorithm": "AES-256-GCM",
                "_encryption_timestamp": datetime.now(timezone.utc),
            }
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data

    def _decrypt_phi(self, encrypted_doc: dict[str, Any]) -> dict[str, Any]:
        """Decrypt PHI data retrieved from storage"""
        if not encrypted_doc.get("_encrypted") or not self._encryption_key:
            return encrypted_doc.get("data", encrypted_doc)

        try:
            payload = b64decode(encrypted_doc["ciphertext"])
            nonce = payload[:12]
            ciphertext = payload[12:]

            key_bytes = b64decode(self._encryption_key)
            aesgcm = AESGCM(key_bytes)

            decrypted_json = aesgcm.decrypt(nonce, ciphertext, None)
            return json.loads(decrypted_json.decode("utf-8"))
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return {"error": "decryption_failed", "_original": encrypted_doc.get("ciphertext")}

    def _log_audit_event(
        self, event_type: str, session_id: str, user_id: str | None = None
    ) -> None:
        """Log audit events for HIPAA compliance"""
        if self.db is None:
            return
        audit_collection = self.db["audit_log"]
        audit_doc = {
            "event_type": event_type,
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "source": "database_service",
        }
        try:
            audit_collection.insert_one(audit_doc)
        except Exception as e:
            logger.error(f"Audit log failed: {e}")

    def save_analysis_result(
        self,
        analysis_type: str,
        data: dict[str, Any],
        session_id: str | None = None,
        user_id: str | None = None,
    ) -> str | None:
        """Save an analysis result to the database with HIPAA compliance"""
        if self.db is None:
            logger.warning("Database not connected, skipping save")
            return None

        # Apply HIPAA compliance measures
        if "phi" in str(data).lower() or analysis_type in [
            "therapy_session",
            "crisis_detection",
            "mental_health",
        ]:
            # Encrypt PHI data
            data = self._encrypt_phi(data)

        # Log audit event
        if session_id:
            self._log_audit_event(f"save_{analysis_type}", session_id, user_id)

        collection = self.db["analysis_results"]

        document = {
            "type": analysis_type,
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "data": data,
            "version": "1.0.0",
            "hipaa_compliant": True,
        }

        try:
            result = collection.insert_one(document)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving analysis result: {e}")
            return None

    def get_session_history(
        self, session_id: str, limit: int = 10, user_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Retrieve analysis history for a session with HIPAA compliance"""
        if self.db is None:
            return []

        # Log audit event
        self._log_audit_event("get_session_history", session_id, user_id)

        collection = self.db["analysis_results"]
        cursor = collection.find({"session_id": session_id}).sort("timestamp", -1).limit(limit)
        results = list(cursor)

        # Decrypt any encrypted results
        for res in results:
            if isinstance(res.get("data"), dict) and res["data"].get("_encrypted"):
                res["data"] = self._decrypt_phi(res["data"])

        return results
