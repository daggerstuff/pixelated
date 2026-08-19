from __future__ import annotations

from collections.abc import Iterator

from pgvector.psycopg import register_vector
from psycopg import Connection
from psycopg_pool import ConnectionPool

from .config import TOOL_DIR

SCHEMA_PATH = TOOL_DIR / "sql" / "001_init.sql"


def _configure(conn: Connection) -> None:
    register_vector(conn)


class Database:
    def __init__(self, dsn: str, max_size: int = 4) -> None:
        self.pool = ConnectionPool(dsn, min_size=1, max_size=max_size, configure=_configure)

    def apply_schema(self) -> None:
        sql = SCHEMA_PATH.read_text(encoding="utf-8")
        with self.pool.connection() as conn:
            conn.execute(sql)

    def connection(self) -> Iterator[Connection]:
        with self.pool.connection() as conn:
            yield conn

    def close(self) -> None:
        self.pool.close()


def connect(dsn: str) -> Database:
    db = Database(dsn)
    db.apply_schema()
    return db
