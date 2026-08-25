"""Tests for ``scripts.services.monthly_llm_driver.orch_db_postgres_tables``.

Verifies the Postgres table setup used by the monthly LLM pipeline
orchestrator.  All tests require PostgreSQL to be reachable on
127.0.0.1:5432 (dev credentials documented in ``orch_db.py``).

Test cases:
    tables_exist              -- both tables created in orch schema
    schema_match              -- all columns have correct types and constraints
    idempotent_recreate       -- calling setup_postgres_tables twice is safe
"""

import pytest

from scripts.services.monthly_llm_driver.orch_db_postgres_tables import (
    setup_postgres_tables,
    verify_postgres_tables,
)


@pytest.fixture
def pg_conn():
    """Provide a ``psycopg2.extensions.connection`` via ConnectionBundle.

    Uses the same connection as production (the tables are idempotent via
    ``CREATE TABLE IF NOT EXISTS``).  Tests verify the setup is safe to
    call multiple times.
    """
    from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

    bundle = ConnectionBundle.from_env()
    yield bundle.pg_conn
    bundle.close()


# ---------------------------------------------------------------------------
# Test 1: Both tables exist after setup
# ---------------------------------------------------------------------------


def test_tables_exist(pg_conn):
    """``setup_postgres_tables`` must create both tables in orch schema."""
    setup_postgres_tables(pg_conn)

    cur = pg_conn.cursor()

    # Check orch schema exists
    cur.execute("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name = 'orch'
    """)
    assert cur.fetchone() is not None, "orch schema missing"

    # Check audit_findings_table exists
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'orch' AND table_name = 'audit_findings_table'
    """)
    assert cur.fetchone() is not None, "orch.audit_findings_table missing"

    # Check cross_month_aggregates exists
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'orch' AND table_name = 'cross_month_aggregates'
    """)
    assert cur.fetchone() is not None, "orch.cross_month_aggregates missing"

    cur.close()


# ---------------------------------------------------------------------------
# Test 2: Schema matches expected specification
# ---------------------------------------------------------------------------


def test_schema_match(pg_conn):
    """All columns must have the correct types and constraints."""
    setup_postgres_tables(pg_conn)

    result = verify_postgres_tables(pg_conn)

    # -- audit_findings_table ------------------------------------------------
    assert "audit_findings_table" in result
    audit_cols = result["audit_findings_table"]
    col_map = {row["column_name"]: row for row in audit_cols}

    # Check expected columns
    assert "month" in col_map
    assert col_map["month"]["data_type"] == "text"
    assert col_map["month"]["is_nullable"] == "NO"

    assert "finding_code" in col_map
    assert col_map["finding_code"]["data_type"] == "text"
    assert col_map["finding_code"]["is_nullable"] == "NO"

    assert "severity" in col_map
    assert col_map["severity"]["data_type"] == "text"
    assert col_map["severity"]["is_nullable"] == "NO"

    assert "record_id" in col_map
    assert col_map["record_id"]["data_type"] == "text"
    assert col_map["record_id"]["is_nullable"] == "NO"

    assert "raised_at" in col_map
    assert col_map["raised_at"]["data_type"] == "timestamp with time zone"
    assert col_map["raised_at"]["is_nullable"] == "NO"
    assert col_map["raised_at"]["column_default"] is not None  # DEFAULT now()

    assert "resolved_at" in col_map
    assert col_map["resolved_at"]["data_type"] == "timestamp with time zone"
    assert col_map["resolved_at"]["is_nullable"] == "YES"

    # -- cross_month_aggregates ----------------------------------------------
    assert "cross_month_aggregates" in result
    cross_cols = result["cross_month_aggregates"]
    col_map = {row["column_name"]: row for row in cross_cols}

    # Check expected columns
    assert "invariant_code" in col_map
    assert col_map["invariant_code"]["data_type"] == "text"
    assert col_map["invariant_code"]["is_nullable"] == "NO"  # PRIMARY KEY

    assert "first_observed" in col_map
    assert col_map["first_observed"]["data_type"] == "timestamp with time zone"

    assert "last_value" in col_map
    assert col_map["last_value"]["data_type"] == "numeric"


# ---------------------------------------------------------------------------
# Test 3: setup_postgres_tables is idempotent
# ---------------------------------------------------------------------------


def test_idempotent_recreate(pg_conn):
    """Calling ``setup_postgres_tables`` twice must not raise."""
    # First call: creates tables
    setup_postgres_tables(pg_conn)

    # Verify state after first call
    result1 = verify_postgres_tables(pg_conn)
    assert result1 is not None

    # Second call: must succeed without raising (idempotent)
    setup_postgres_tables(pg_conn)

    # Verify state is unchanged after second call
    result2 = verify_postgres_tables(pg_conn)
    assert result2 is not None

    # Both results should have the same structure
    assert set(result1.keys()) == set(result2.keys())


# ---------------------------------------------------------------------------
# Test 4: verify_postgres_tables raises on missing table
# ---------------------------------------------------------------------------


def test_verify_tables_raises_on_missing(pg_conn):
    """``verify_postgres_tables`` must raise if expected tables are missing."""
    # Drop the tables to test the missing case
    cur = pg_conn.cursor()
    cur.execute("DROP TABLE IF EXISTS orch.audit_findings_table CASCADE")
    cur.execute("DROP TABLE IF EXISTS orch.cross_month_aggregates CASCADE")
    pg_conn.commit()
    cur.close()

    # Now verify should raise
    with pytest.raises(RuntimeError, match="Missing table"):
        verify_postgres_tables(pg_conn)
