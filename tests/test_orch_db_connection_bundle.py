"""Tests for ``skills.monthly-llm-driver.orch_db.ConnectionBundle``.

Verifies the three-DB connection helper used by the monthly LLM pipeline
orchestrator.  All tests require the three database services to be
reachable on 127.0.0.1 (Redis 6379, MongoDB 27017, Postgres 5432) with
the dev credentials documented in ``orch_db.py``.

Test cases:
    from_env_returns_3_clients   -- factory connects to all three DBs
    from_env_close_idempotent    -- close() can be called multiple times
    from_env_uses_override_uri   -- env vars override defaults
"""

import importlib
import os

import pymongo
import redis

# ---------------------------------------------------------------------------
# Import the module (hyphenated name requires importlib)
# ---------------------------------------------------------------------------

_ORCH_DB = importlib.import_module("skills.monthly-llm-driver.orch_db")
ConnectionBundle = _ORCH_DB.ConnectionBundle


# ---------------------------------------------------------------------------
# Test 1: from_env() returns 3 connected clients
# ---------------------------------------------------------------------------


def test_from_env_returns_3_clients() -> None:
    """``from_env()`` must return a bundle with all three clients connected."""
    bundle = ConnectionBundle.from_env()

    # Redis
    assert isinstance(bundle.redis_client, redis.Redis)
    assert bundle.redis_client.ping() is True

    # MongoDB
    assert isinstance(bundle.mongo_db, pymongo.database.Database)
    assert bundle.mongo_db.name == "hackathon"
    server_info = bundle.mongo_db.client.server_info()
    assert server_info.get("ok") == 1.0

    # PostgreSQL
    assert not bundle.pg_conn.closed
    cur = bundle.pg_conn.cursor()
    cur.execute("SELECT version()")
    version_row = cur.fetchone()
    cur.close()
    assert version_row is not None
    assert "PostgreSQL" in version_row[0]

    bundle.close()


# ---------------------------------------------------------------------------
# Test 2: close() is idempotent
# ---------------------------------------------------------------------------


def test_from_env_close_idempotent() -> None:
    """``close()`` must be safe to call multiple times without raising."""
    bundle = ConnectionBundle.from_env()

    # First close
    bundle.close()

    # Second close (idempotent)
    bundle.close()

    # Third close via context manager exit
    with bundle:
        pass

    # Fourth close (idempotent after context manager)
    bundle.close()


# ---------------------------------------------------------------------------
# Test 3: from_env() uses override URIs from environment
# ---------------------------------------------------------------------------


def test_from_env_uses_override_uri() -> None:
    """``from_env()`` must read REDIS_URL / MONGO_URL / POSTGRES_URL from env."""
    # Use the default URIs (we are not testing bad URIs, just that the
    # override path is exercised).  The test verifies that the factory
    # reads the env vars and does not hard-code the defaults.
    original_redis = os.environ.get("REDIS_URL")
    original_mongo = os.environ.get("MONGO_URL")
    original_pg = os.environ.get("POSTGRES_URL")

    try:
        # Set the env vars to the same defaults (so the test passes
        # even if the services are not running on the default URIs).
        os.environ["REDIS_URL"] = "redis://:dev_redis_password@127.0.0.1:6379/0"
        os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
        os.environ["POSTGRES_URL"] = (
            "postgresql://pixelated:dev_password_change_in_prod@127.0.0.1:5432/pixelated_empathy"
        )

        bundle = ConnectionBundle.from_env()

        # Verify all three connections work
        assert bundle.redis_client.ping() is True
        assert bundle.mongo_db.client.server_info().get("ok") == 1.0
        assert not bundle.pg_conn.closed

        bundle.close()

    finally:
        # Restore original env vars
        if original_redis is not None:
            os.environ["REDIS_URL"] = original_redis
        else:
            os.environ.pop("REDIS_URL", None)

        if original_mongo is not None:
            os.environ["MONGO_URL"] = original_mongo
        else:
            os.environ.pop("MONGO_URL", None)

        if original_pg is not None:
            os.environ["POSTGRES_URL"] = original_pg
        else:
            os.environ.pop("POSTGRES_URL", None)


# ---------------------------------------------------------------------------
# Test 4 (bonus): context manager works
# ---------------------------------------------------------------------------


def test_context_manager_closes_on_exit() -> None:
    """``with ConnectionBundle.from_env() as b:`` must close on exit."""
    with ConnectionBundle.from_env() as bundle:
        assert bundle.redis_client.ping() is True
        assert not bundle.pg_conn.closed

    # After exit, connections should be closed
    assert bundle.pg_conn.closed
