import hashlib
import json
import os
from typing import Any

import redis.asyncio as redis
from fastapi import Depends, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

# Import authentication middleware and dependencies from existing project
from ai.scripts.fastapi_auth_middleware import AuthenticationDependencies, FastAPIAuthenticationMiddleware

# Environment configuration (fallback to defaults for development)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "pixelated")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Initialise MongoDB client (single global client is recommended)
mongo_client = AsyncIOMotorClient(MONGODB_URI)
mongo_db = mongo_client[MONGODB_DB]

# Initialise Redis client (async)
redis_client = redis.from_url(REDIS_URL)


# Simple authentication system placeholder – in real code this would be the shared instance
# Here we create a minimal stub that satisfies the middleware constructor
class _DummyAuthSystem:
    def verify_jwt_token(self, token: str) -> dict[str, Any] | None:
        # Accept any token for demo purposes – real verification lives elsewhere
        return {"user_id": "dummy"}

    def authenticate_api_key(self, key: str):
        return None

    def check_permission(self, role, permission):
        return True

    def check_api_key_permission(self, api_key, permission):
        return True

    @property
    def users(self):
        return {"dummy": type("User", (), {"is_active": True, "role": None})()}


_auth_system = _DummyAuthSystem()


def create_app() -> FastAPI:
    app = FastAPI(title="Reprioritizer Service", version="0.1.0")

    # Install authentication middleware – it will populate request.state.authenticated_user
    app.add_middleware(FastAPIAuthenticationMiddleware, auth_system=_auth_system)  # type: ignore

    # Dependency helper instance (not strictly required for the endpoint but kept for parity)
    auth_deps = AuthenticationDependencies(_auth_system)  # type: ignore

    @app.post("/api/prioritization/adjust")
    async def adjust_prioritization(request: Request, user: Any = Depends(auth_deps.get_current_user)):
        """Adjust prioritisation based on evaluation evidence.

        The request payload is not interpreted for scoring – a simple count of documents
        in the ``evaluation_evidence`` collection is used as the priority score.
        The result is cached in Redis keyed by a deterministic hash of the payload.
        """
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

        # Compute cache key – deterministic based on sorted JSON representation
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        cache_key = f"priority:{hashlib.sha256(payload_bytes).hexdigest()}"

        # Attempt to fetch cached score
        cached = await redis_client.get(cache_key)
        if cached is not None:
            try:
                score = int(cached)
                return {"score": score, "cached": True}
            except ValueError:
                # Corrupt cache entry – ignore and recompute
                pass

        # Compute priority score: simple count of evidence documents
        collection = mongo_db["evaluation_evidence"]
        # Count documents matching optional filter – here we ignore payload and count all
        score = await collection.count_documents({})

        # Cache the result for 5 minutes (300 seconds)
        await redis_client.set(cache_key, str(score), ex=300)
        return {"score": score, "cached": False}

    return app


# Create the FastAPI instance that will be imported by the server or tests
app = create_app()
