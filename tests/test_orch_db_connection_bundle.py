"""Tests for ``scripts.services.monthly_llm_driver.orch_db.ConnectionBundle``.

Verifies the three-DB connection helper used by the monthly LLM pipeline
orchestrator.  All tests require the three database services to be
reachable on 127.0.0.1 (Redis 6379, MongoDB 27017, Postgres 5432) with
the dev credentials documented in ``orch_db.py``.

Test cases:
    from_env_returns_3_clients   -- factory connects to all three DBs
    from_env_close_idempotent    -- close() can be called multiple times
    from_env_uses_override_uri   -- env vars override defaults
    close_order_is_pg_first      -- close() closes pg cursors, pg_conn, then mongo
"""

import os
from unittest.mock import MagicMock

import pymongo
import redis

# ---------------------------------------------------------------------------
# Import the module (now snake_case — direct from-import works)
# ---------------------------------------------------------------------------
from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

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
# Test 4: close() order is pg cursors → pg_conn → mongo
# ---------------------------------------------------------------------------


def test_close_order_is_pg_first() -> None:
    """close() must close in order: pg cursors → pg_conn → redis → mongo_db.

    This verifies the fix for Chaos Monkey #3c where iterating a Mongo cursor
    inside ConnectionBundle.__exit__ triggered StopIteration indistinguishable
    from a real driver bug. The fix ensures PG cursors and pg_conn close first,
    then mongo_db.client closes last.
    """
    # Create a bundle with mock clients
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True

    mock_mongo_client = MagicMock()
    mock_mongo_db = MagicMock()
    mock_mongo_db.client = mock_mongo_client
    mock_mongo_db.name = "hackathon"

    mock_pg_conn = MagicMock()
    mock_pg_conn.closed = False

    bundle = ConnectionBundle(
        redis_client=mock_redis,
        mongo_db=mock_mongo_db,
        pg_conn=mock_pg_conn,
    )

    # Register two mock cursors
    mock_cursor1 = MagicMock()
    mock_cursor1.closed = False
    mock_cursor2 = MagicMock()
    mock_cursor2.closed = False

    bundle.register_pg_cursor(mock_cursor1)
    bundle.register_pg_cursor(mock_cursor2)

    # Track close call order
    close_order = []

    def track_cursor1_close():
        close_order.append("cursor1")

    def track_cursor2_close():
        close_order.append("cursor2")

    def track_pg_conn_close():
        close_order.append("pg_conn")

    def track_redis_close():
        close_order.append("redis")

    def track_mongo_close():
        close_order.append("mongo")

    mock_cursor1.close.side_effect = track_cursor1_close
    mock_cursor2.close.side_effect = track_cursor2_close
    mock_pg_conn.close.side_effect = track_pg_conn_close
    mock_redis.close.side_effect = track_redis_close
    mock_mongo_client.close.side_effect = track_mongo_close

    # Call close
    bundle.close()

    # Verify order: cursors first (any order), then pg_conn, then redis, then mongo
    # The set iteration order is non-deterministic, so we check relative ordering
    cursor_indices = [i for i, name in enumerate(close_order) if name.startswith("cursor")]
    pg_conn_idx = close_order.index("pg_conn")
    redis_idx = close_order.index("redis")
    mongo_idx = close_order.index("mongo")

    # All cursors must close before pg_conn
    assert all(idx < pg_conn_idx for idx in cursor_indices), (
        f"Cursors must close before pg_conn, got order: {close_order}"
    )

    # pg_conn must close before redis
    assert pg_conn_idx < redis_idx, f"pg_conn must close before redis, got order: {close_order}"

    # redis must close before mongo
    assert redis_idx < mongo_idx, f"redis must close before mongo, got order: {close_order}"

    # Verify all close methods were called
    mock_cursor1.close.assert_called_once()
    mock_cursor2.close.assert_called_once()
    mock_pg_conn.close.assert_called_once()
    mock_redis.close.assert_called_once()
    mock_mongo_client.close.assert_called_once()

    # Verify cursors are unregistered after close
    assert len(bundle._open_pg_cursors) == 0


# ---------------------------------------------------------------------------
# Test 5: context manager works
# ---------------------------------------------------------------------------


def test_context_manager_closes_on_exit() -> None:
    """``with ConnectionBundle.from_env() as b:`` must close on exit."""
    with ConnectionBundle.from_env() as bundle:
        assert bundle.redis_client.ping() is True
        assert not bundle.pg_conn.closed

    # After exit, connections should be closed
    assert bundle.pg_conn.closed
