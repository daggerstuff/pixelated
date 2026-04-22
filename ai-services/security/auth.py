"""
Discriminated Union Auth Middleware for User and Developer contexts.
Implements 401-Triggered JWKS cache invalidation.
"""

import logging
import time
from dataclasses import dataclass
from functools import wraps
from typing import Literal, Union

from flask import jsonify, request

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class UserContext:
    context_type: Literal["user"] = "user"
    user_id: str
    tier: str = "standard"

@dataclass(frozen=True)
class DeveloperContext:
    context_type: Literal["developer"] = "developer"
    developer_id: str
    api_key: str
    scopes: tuple[str, ...] = ()

AuthContext = Union[UserContext, DeveloperContext]

class JWKSCache:
    """Cache for JSON Web Key Sets with 401-triggered invalidation."""
    def __init__(self):
        self._keys = {}
        self._last_updated = 0
        self._ttl = 3600

    def get_keys(self):
        if not self._keys or (time.time() - self._last_updated > self._ttl):
            self.refresh()
        return self._keys

    def refresh(self):
        logger.info("Refreshing JWKS cache...")
        # Mock implementation of JWKS fetch
        self._keys = {"mock_key": "mock_value"}
        self._last_updated = time.time()

    def invalidate(self):
        logger.warning("JWKS cache invalidated by 401 response.")
        self._keys = {}

# Global cache instance
jwks_cache = JWKSCache()

def authenticate(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        api_key = request.headers.get("X-API-Key")
        client_id = request.headers.get("X-Pixelated-Client")

        # MANDATE: Standardize X-Pixelated-Client and X-API-Key
        if not client_id:
             return jsonify({"error": "Missing X-Pixelated-Client header"}), 401

        context: AuthContext | None = None

        try:
            if api_key:
                # Developer path
                context = DeveloperContext(developer_id="dev_123", api_key=api_key)
            elif auth_header:
                # User path
                context = UserContext(user_id="user_123")

            if not context:
                # Trigger cache flush on failure
                jwks_cache.invalidate()
                return jsonify({"error": "Unauthorized"}), 401

            # Attach context to request for downstream use
            request.auth_context = context
            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Auth error: {e}")
            jwks_cache.invalidate()
            return jsonify({"error": "Authentication failed"}), 401

    return decorated
