"""Postgres table setup for the monthly LLM pipeline orchestrator.

Creates two tables in the ``orch`` schema:

1. ``orch.audit_findings_table``
   - Columns: month TEXT, finding_code TEXT, severity TEXT, record_id TEXT,
     raised_at TIMESTAMPTZ (DEFAULT now()), resolved_at TIMESTAMPTZ NULL
   - Primary key: (month, finding_code, record_id, raised_at)

2. ``orch.cross_month_aggregates``
   - Columns: invariant_code TEXT PRIMARY KEY, first_observed TIMESTAMPTZ,
     last_value NUMERIC

Wall budget: 3 minutes total for DDL execution.

Returns (raises) on any DDL failure so the orchestrator can surface the error.

Usage::

    from skills.monthly_llm_driver.orch_db import ConnectionBundle
    from skills.monthly_llm_driver.orch_db_postgres_tables import setup_postgres_tables

    with ConnectionBundle.from_env() as bundle:
        setup_postgres_tables(bundle.pg_conn)
"""

from __future__ import annotations

import psycopg2

# Wall budget: 3 minutes for DDL execution.
_WALL_BUDGET_MINUTES = 3


def setup_postgres_tables(pg_conn: psycopg2.extensions.connection) -> None:
    """Create the two tables in the ``orch`` schema.

    Idempotent: uses ``CREATE TABLE IF NOT EXISTS`` so safe to call multiple times.
    Creates the ``orch`` schema if it doesn't exist.

    Raises on any DDL failure (return-to-orchestrator signal).

    Args:
        pg_conn: ``psycopg2.extensions.connection`` instance.
    """
    cur = pg_conn.cursor()

    try:
        # Create the orch schema if it doesn't exist
        cur.execute("CREATE SCHEMA IF NOT EXISTS orch")

        # -- audit_findings_table --------------------------------------------
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orch.audit_findings_table (
                month TEXT NOT NULL,
                finding_code TEXT NOT NULL,
                severity TEXT NOT NULL,
                record_id TEXT NOT NULL,
                raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                resolved_at TIMESTAMPTZ NULL,
                PRIMARY KEY (month, finding_code, record_id, raised_at)
            )
        """)

        # -- cross_month_aggregates ------------------------------------------
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orch.cross_month_aggregates (
                invariant_code TEXT PRIMARY KEY,
                first_observed TIMESTAMPTZ,
                last_value NUMERIC
            )
        """)

        pg_conn.commit()

    except Exception:
        pg_conn.rollback()
        raise
    finally:
        cur.close()


def verify_postgres_tables(pg_conn: psycopg2.extensions.connection) -> dict[str, list[dict]]:
    """Verify both tables exist with correct schema.

    Returns a dict mapping table names to their column info.
    Raises if any expected table or column is missing.

    Args:
        pg_conn: ``psycopg2.extensions.connection`` instance.

    Returns:
        Dict mapping table name to list of column info dicts.
    """
    cur = pg_conn.cursor()
    result = {}

    try:
        # -- Verify audit_findings_table -------------------------------------
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'orch' AND table_name = 'audit_findings_table'
            ORDER BY ordinal_position
        """)
        audit_findings_cols = cur.fetchall()

        if not audit_findings_cols:
            raise RuntimeError("Missing table: orch.audit_findings_table")

        result["audit_findings_table"] = []
        expected_cols = {
            "month": ("text", "NO"),
            "finding_code": ("text", "NO"),
            "severity": ("text", "NO"),
            "record_id": ("text", "NO"),
            "raised_at": ("timestamp with time zone", "NO"),
            "resolved_at": ("timestamp with time zone", "YES"),
        }

        col_names = {row[0] for row in audit_findings_cols}
        for col_name, (_expected_type, _expected_nullable) in expected_cols.items():
            if col_name not in col_names:
                raise RuntimeError(f"Missing column: orch.audit_findings_table.{col_name}")

        # Find the column row
        for row in audit_findings_cols:
            col_name, data_type, is_nullable, col_default = row
            result["audit_findings_table"].append(
                {
                    "column_name": col_name,
                    "data_type": data_type,
                    "is_nullable": is_nullable,
                    "column_default": col_default,
                }
            )

        # Verify primary key
        cur.execute("""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
              AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'orch'
              AND tc.table_name = 'audit_findings_table'
            ORDER BY kcu.ordinal_position
        """)
        pk_cols = [row[0] for row in cur.fetchall()]
        expected_pk = ["month", "finding_code", "record_id", "raised_at"]
        if pk_cols != expected_pk:
            raise RuntimeError(f"Primary key mismatch on audit_findings_table: expected {expected_pk}, got {pk_cols}")

        # -- Verify cross_month_aggregates -----------------------------------
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'orch' AND table_name = 'cross_month_aggregates'
            ORDER BY ordinal_position
        """)
        cross_month_cols = cur.fetchall()

        if not cross_month_cols:
            raise RuntimeError("Missing table: orch.cross_month_aggregates")

        result["cross_month_aggregates"] = []
        expected_cols = {
            "invariant_code": ("text", "NO"),
            "first_observed": ("timestamp with time zone", "YES"),
            "last_value": ("numeric", "YES"),
        }

        col_names = {row[0] for row in cross_month_cols}
        for col_name, (_expected_type, _expected_nullable) in expected_cols.items():
            if col_name not in col_names:
                raise RuntimeError(f"Missing column: orch.cross_month_aggregates.{col_name}")

        # Find the column row
        for row in cross_month_cols:
            col_name, data_type, is_nullable, col_default = row
            result["cross_month_aggregates"].append(
                {
                    "column_name": col_name,
                    "data_type": data_type,
                    "is_nullable": is_nullable,
                    "column_default": col_default,
                }
            )

        # Verify primary key
        cur.execute("""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
              AND tc.table_catalog = kcu.table_catalog
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'orch'
              AND tc.table_name = 'cross_month_aggregates'
            ORDER BY kcu.ordinal_position
        """)
        pk_cols = [row[0] for row in cur.fetchall()]
        expected_pk = ["invariant_code"]
        if pk_cols != expected_pk:
            raise RuntimeError(f"Primary key mismatch on cross_month_aggregates: expected {expected_pk}, got {pk_cols}")

        return result

    finally:
        cur.close()
