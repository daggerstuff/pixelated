import hashlib
import json
import os
import sys
from collections.abc import AsyncGenerator
from contextlib import suppress
from pathlib import Path
from types import SimpleNamespace
from typing import Annotated, Any

import redis.asyncio as redis
from fastapi import Depends, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

# The shared auth middleware lives in the ai submodule. Both import shapes
# work depending on deployment layout: as part of the `ai` package (repo
# checkout / wheel) or with the submodule root on sys.path.
try:
    from ai.configs.api_authentication import AuthenticationSystem
    from ai.configs.fastapi_auth_middleware import (
        AuthenticationDependencies,
        FastAPIAuthenticationMiddleware,
    )
except ImportError:  # pragma: no cover - submodule checkout layout
    _ai_root = str(Path(__file__).resolve().parents[2] / "ai")
    if _ai_root not in sys.path:
        sys.path.insert(0, _ai_root)
    from configs.api_authentication import AuthenticationSystem
    from configs.fastapi_auth_middleware import (
        AuthenticationDependencies,
        FastAPIAuthenticationMiddleware,
    )

# Environment configuration (fallback to defaults for development)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "pixelated")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

mongo_client: AsyncIOMotorClient | None = None
mongo_db: Any = None
redis_client: Any = None

# Mutable client holder so the lifespan can install clients without
# rebinding module globals (tests monkeypatch these attributes directly).
state = SimpleNamespace(mongo_client=None, mongo_db=None, redis_client=None)


def _init_clients() -> None:
    """Create MongoDB and Redis clients (idempotent, lazy on first use)."""
    if state.mongo_client is None:
        state.mongo_client = AsyncIOMotorClient(MONGODB_URI)
        state.mongo_db = state.mongo_client[MONGODB_DB]
    if state.redis_client is None:
        state.redis_client = redis.from_url(REDIS_URL)


def _build_auth_system() -> AuthenticationSystem | None:
    """Build the real AuthenticationSystem when properly configured.

    Requires AUTH_SECRET_KEY (JWT signing secret, >= 32 unique chars).
    Returns None when unconfigured - create_app then refuses to start with
    authentication disabled rather than silently accepting every token.
    """
    secret = os.getenv("AUTH_SECRET_KEY")
    if not secret:
        return None
    db_path = os.getenv("AUTH_DB_PATH")
    return AuthenticationSystem(
        secret_key=secret,
        auth_database=Path(db_path) if db_path else None,
    )


async def _lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    _init_clients()
    yield
    if state.mongo_client is not None:
        state.mongo_client.close()
    if state.redis_client is not None:
        await state.redis_client.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="Reprioritizer Service", version="0.1.0", lifespan=_lifespan)

    auth_system = _build_auth_system()
    if auth_system is None:
        # Authentication is mandatory for a service that adjusts clinical
        # prioritization - refuse to boot with the permissive demo stub.
        raise RuntimeError(
            "AUTH_SECRET_KEY is required for the reprioritizer service. "
            "Refusing to start with unauthenticated access to prioritization data."
        )

    # Install authentication middleware - it will populate request.state.authenticated_user
    app.add_middleware(FastAPIAuthenticationMiddleware, auth_system=auth_system)

    # Dependency helper instance (kept for parity with other services)
    auth_deps = AuthenticationDependencies(auth_system)

    @app.post("/api/prioritization/adjust")
    async def adjust_prioritization(
        request: Request,
        _user: Annotated[Any, Depends(auth_deps.get_current_user)],
    ) -> dict[str, Any]:
        """Adjust prioritisation based on evaluation evidence.

        The request payload is not interpreted for scoring - a simple count of documents
        in the ``evaluation_evidence`` collection is used as the priority score.
        The result is cached in Redis keyed by a deterministic hash of the payload.
        """
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

        # Compute cache key - deterministic based on sorted JSON representation
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        cache_key = f"priority:{hashlib.sha256(payload_bytes).hexdigest()}"

        # Attempt to fetch cached score
        cached = await state.redis_client.get(cache_key)
        if cached is not None:
            try:
                score = int(cached)
                return {"score": score, "cached": True}
            except ValueError:
                # Corrupt cache entry - ignore and recompute
                pass

        # Compute priority score: simple count of evidence documents
        collection = state.mongo_db["evaluation_evidence"]
        # Count documents matching optional filter - here we ignore payload and count all
        score = await collection.count_documents({})

        # Cache the result for 5 minutes (300 seconds)
        await state.redis_client.set(cache_key, str(score), ex=300)
        return {"score": score, "cached": False}

    @app.get("/health")
    async def health() -> dict[str, Any]:
        """Health check - public endpoint."""
        return {"status": "healthy", "service": "reprioritizer"}

    return app


# The module-level `app` requires AUTH_SECRET_KEY; services/tests that need
# an app object without secrets construct their own via create_app() with
# the env var set (e.g. tests set a fixture secret).
app: FastAPI | None = None
with suppress(RuntimeError):
    # No AUTH_SECRET_KEY in this environment - import stays safe, the app is
    # None. create_app() remains the supported construction path.
    app = create_app()
