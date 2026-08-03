"""Reusable database connection helper for the monthly LLM pipeline
orchestrator.

Exposes ``ConnectionBundle``, a ``dataclass`` bundling the three
database clients the pipeline needs:

- ``redis_client``  -- ``redis.Redis`` (db 0)
- ``mongo_db``      -- ``pymongo.database.Database`` (db ``hackathon``)
- ``pg_conn``       -- ``psycopg2.extensions.connection``

The ``.from_env()`` factory reads ``REDIS_URL``, ``MONGO_URL``,
``POSTGRES_URL`` in priority order:

1. Process environment variables (``os.environ``).
2. The mission ``.env`` file at
   ``/home/vivi/.factory/missions/98c15371-4572-4f91-a290-ce42806e9bbf/.env``.
3. Hard-coded fallback defaults (dev credentials on 127.0.0.1).

The bundle is a context manager: ``close()`` flushes/closes Redis,
closes the pymongo client, and closes the psycopg2 connection.

Wall budget: 5 minutes total for the three connection handshakes
(each uses a 300-second connect/serverSelection timeout).

Raises immediately (return-to-orchestrator signal) if any URI is
unreachable or if ``.from_env()`` raises at import time.
"""

from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg2
import pymongo
import redis

# ---------------------------------------------------------------------------
# Defaults (dev credentials on 127.0.0.1)
# ---------------------------------------------------------------------------

_DEFAULT_REDIS_URL = "redis://:dev_redis_password@127.0.0.1:6379/0"
_DEFAULT_MONGO_URL = "mongodb://127.0.0.1:27017"
_DEFAULT_POSTGRES_URL = "postgresql://pixelated:dev_password_change_in_prod@127.0.0.1:5432/pixelated_empathy"

_MISSION_ENV_PATH = Path("/home/vivi/.factory/missions/98c15371-4572-4f91-a290-ce42806e9bbf/.env")

# 5-minute wall budget per connection handshake.
_CONNECT_TIMEOUT_S = 300


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_env_file(path: Path) -> dict[str, str]:
    """Parse a simple ``KEY=VALUE`` ``.env`` file (no interpolation)."""
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        # Strip surrounding quotes if present.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        if key:
            result[key] = value
    return result


def _resolve_uri(env_key: str, default: str, file_vars: dict[str, str]) -> str:
    """Resolve a connection URI: env var > .env file > default."""
    return os.environ.get(env_key) or file_vars.get(env_key) or default


# ---------------------------------------------------------------------------
# ConnectionBundle
# ---------------------------------------------------------------------------


@dataclass
class ConnectionBundle:
    """Bundles the three database clients the orchestrator needs.

    Fields:
        redis_client: ``redis.Redis`` instance (db 0).
        mongo_db:     ``pymongo.database.Database`` for db ``hackathon``.
        pg_conn:      ``psycopg2.extensions.connection`` instance.
        _open_pg_cursors: Registry of PG cursors to close before pg_conn.
    """

    redis_client: redis.Redis
    mongo_db: pymongo.database.Database
    pg_conn: Any  # psycopg2.extensions.connection (avoid import-time type resolution)
    _open_pg_cursors: set[Any] = field(default_factory=set, repr=False)

    def __post_init__(self) -> None:
        """Ensure _open_pg_cursors is initialized for backward compatibility."""
        if not hasattr(self, "_open_pg_cursors"):
            object.__setattr__(self, "_open_pg_cursors", set())

    def register_pg_cursor(self, cursor: Any) -> None:
        """Register a PG cursor to be closed before pg_conn.

        Args:
            cursor: A psycopg2 cursor instance to track for cleanup.
        """
        self._open_pg_cursors.add(cursor)

    def unregister_pg_cursor(self, cursor: Any) -> None:
        """Unregister a PG cursor (typically called after cursor.close()).

        Args:
            cursor: The cursor to remove from the registry.
        """
        self._open_pg_cursors.discard(cursor)

    # -- factory ----------------------------------------------------------

    @classmethod
    def from_env(cls) -> ConnectionBundle:
        """Build a ``ConnectionBundle`` from env / .env / defaults.

        Verifies each connection is reachable before returning.
        Raises on any unreachable URI (return-to-orchestrator signal).
        """
        file_vars = _load_env_file(_MISSION_ENV_PATH)

        redis_url = _resolve_uri("REDIS_URL", _DEFAULT_REDIS_URL, file_vars)
        mongo_url = _resolve_uri("MONGO_URL", _DEFAULT_MONGO_URL, file_vars)
        pg_url = _resolve_uri("POSTGRES_URL", _DEFAULT_POSTGRES_URL, file_vars)

        # -- Redis ---------------------------------------------------------
        redis_client = redis.Redis.from_url(
            redis_url,
            socket_connect_timeout=_CONNECT_TIMEOUT_S,
            socket_timeout=_CONNECT_TIMEOUT_S,
        )
        redis_client.ping()

        # -- MongoDB -------------------------------------------------------
        mongo_client = pymongo.MongoClient(
            mongo_url,
            serverSelectionTimeoutMS=_CONNECT_TIMEOUT_S * 1000,
        )
        mongo_client.server_info()
        mongo_db = mongo_client["hackathon"]

        # -- PostgreSQL ----------------------------------------------------
        pg_conn = psycopg2.connect(pg_url, connect_timeout=_CONNECT_TIMEOUT_S)
        cur = pg_conn.cursor()
        cur.execute("SELECT version()")
        cur.fetchone()
        cur.close()

        return cls(
            redis_client=redis_client,
            mongo_db=mongo_db,
            pg_conn=pg_conn,
        )

    # -- context manager --------------------------------------------------

    def close(self) -> None:
        """Flush and close all three connections.

        Close order (per Chaos Monkey #3c fix):
        1. Close registered PG cursors first (they have real close() methods)
        2. Close pg_conn (PostgreSQL connection)
        3. Close mongo_client (PyMongo client)

        This order ensures PyMongo iterators find their next batch returning
        empty rather than raising StopIteration indistinguishable from a
        real driver bug when a worker iterates a Mongo cursor inside __exit__.

        Idempotent: safe to call multiple times.  Exceptions during
        close are swallowed so that a partial close does not prevent
        the remaining connections from being cleaned up.
        """
        # 1. Close registered PG cursors FIRST
        for cursor in list(self._open_pg_cursors):
            with contextlib.suppress(Exception):
                if not cursor.closed:
                    cursor.close()
            self._open_pg_cursors.discard(cursor)

        # 2. Close PG connection
        with contextlib.suppress(Exception):
            if not self.pg_conn.closed:
                self.pg_conn.close()

        # 3. Close Redis
        with contextlib.suppress(Exception):
            self.redis_client.close()

        # 4. Close MongoDB LAST
        with contextlib.suppress(Exception):
            self.mongo_db.client.close()

    def __enter__(self) -> ConnectionBundle:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- repr -------------------------------------------------------------

    def __repr__(self) -> str:
        redis_ok = False
        with contextlib.suppress(Exception):
            redis_ok = self.redis_client.ping()

        mongo_ok = False
        with contextlib.suppress(Exception):
            mongo_ok = bool(self.mongo_db.client.server_info().get("ok"))

        pg_ok = False
        with contextlib.suppress(Exception):
            cur = self.pg_conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            cur.close()
            pg_ok = True

        return (
            f"ConnectionBundle("
            f"redis_client={self.redis_client!r} (ping={redis_ok}), "
            f"mongo_db={self.mongo_db!r} (ok={mongo_ok}), "
            f"pg_conn={self.pg_conn!r} (ok={pg_ok})"
            f")"
        )
