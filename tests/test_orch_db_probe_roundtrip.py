"""End-to-end probe roundtrip tests for all three orchestrator databases.

Verifies that the monthly LLM pipeline can successfully write, read, and
delete probe documents in MongoDB, PostgreSQL, and Redis. All three
roundtrips must succeed with zero probe documents left behind.

Wall budget: 3 minutes total for all three probes.

Test cases:
    mongo_roundtrip      -- insert/read/delete probe doc in dispatch_chunks
    postgres_roundtrip   -- insert/select/delete probe row in cross_month_aggregates
    redis_roundtrip      -- SET/GET/TTL probe key with 5s expiry
"""

from __future__ import annotations

import time

from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

# ---------------------------------------------------------------------------
# Test 1: MongoDB roundtrip
# ---------------------------------------------------------------------------


def test_mongo_roundtrip() -> None:
    """MongoDB probe: insert+read+delete in dispatch_chunks.

    Writes {month:'_probe', chunk_index:999, transport:'probe',
    status:'probe', wall_seconds:0} into dispatch_chunks, reads it back,
    counts documents, deletes the probe document, and confirms zero
    probe documents remain.
    """
    with ConnectionBundle.from_env() as bundle:
        coll = bundle.mongo_db["dispatch_chunks"]

        # Clean up any leftover probe docs from previous runs
        coll.delete_many({"month": "_probe"})

        # Insert probe document
        probe_doc = {
            "month": "_probe",
            "chunk_index": 999,
            "transport": "probe",
            "status": "probe",
            "wall_seconds": 0,
        }
        result = coll.insert_one(probe_doc)
        inserted_id = result.inserted_id
        assert inserted_id is not None, "insert_one returned None"

        # Read it back
        found = coll.find_one({"_id": inserted_id})
        assert found is not None, "Probe document not found after insert"
        assert found["month"] == "_probe"
        assert found["chunk_index"] == 999
        assert found["transport"] == "probe"
        assert found["status"] == "probe"
        assert found["wall_seconds"] == 0

        # Count probe documents (should be 1)
        count_before = coll.count_documents({"month": "_probe"})
        assert count_before == 1, f"Expected 1 probe doc, got {count_before}"

        # Delete the probe document
        delete_result = coll.delete_one({"_id": inserted_id})
        assert delete_result.deleted_count == 1, "delete_one did not delete the probe doc"

        # Verify zero probe documents remain
        count_after = coll.count_documents({"month": "_probe"})
        assert count_after == 0, f"Expected 0 probe docs after delete, got {count_after}"


# ---------------------------------------------------------------------------
# Test 2: PostgreSQL roundtrip
# ---------------------------------------------------------------------------


def test_postgres_roundtrip() -> None:
    """PostgreSQL probe: insert+select+delete in orch.cross_month_aggregates.

    Inserts a row with invariant_code='_probe', reads it back, deletes it,
    and confirms zero probe rows remain.
    """
    with ConnectionBundle.from_env() as bundle:
        cur = bundle.pg_conn.cursor()

        try:
            # Clean up any leftover probe rows from previous runs
            cur.execute("DELETE FROM orch.cross_month_aggregates WHERE invariant_code = '_probe'")
            bundle.pg_conn.commit()

            # Insert probe row
            cur.execute("""
                INSERT INTO orch.cross_month_aggregates (invariant_code, first_observed, last_value)
                VALUES ('_probe', now(), 999)
            """)
            bundle.pg_conn.commit()

            # Read it back
            cur.execute("""
                SELECT invariant_code, last_value
                FROM orch.cross_month_aggregates
                WHERE invariant_code = '_probe'
            """)
            row = cur.fetchone()
            assert row is not None, "Probe row not found after insert"
            assert row[0] == "_probe"
            assert row[1] == 999

            # Count probe rows (should be 1)
            cur.execute("""
                SELECT count(*) FROM orch.cross_month_aggregates
                WHERE invariant_code = '_probe'
            """)
            count_before = cur.fetchone()[0]
            assert count_before == 1, f"Expected 1 probe row, got {count_before}"

            # Delete the probe row
            cur.execute("DELETE FROM orch.cross_month_aggregates WHERE invariant_code = '_probe'")
            bundle.pg_conn.commit()

            # Verify zero probe rows remain
            cur.execute("""
                SELECT count(*) FROM orch.cross_month_aggregates
                WHERE invariant_code = '_probe'
            """)
            count_after = cur.fetchone()[0]
            assert count_after == 0, f"Expected 0 probe rows after delete, got {count_after}"

        except Exception:
            bundle.pg_conn.rollback()
            raise
        finally:
            cur.close()


# ---------------------------------------------------------------------------
# Test 3: Redis roundtrip
# ---------------------------------------------------------------------------


def test_redis_roundtrip() -> None:
    """Redis probe: SET/GET/TTL with 5s expiry.

    SET orch:_probe = 1 EX 5 NX, GET it (should return 1), verify TTL
    is within 6s, then wait for TTL expiry and confirm EXISTS returns 0.
    """
    with ConnectionBundle.from_env() as bundle:
        redis_client = bundle.redis_client
        key = "orch:_probe"

        # Clean up any leftover probe key from previous runs
        redis_client.delete(key)

        # SET with NX (only if not exists) and EX 5 (expire in 5 seconds)
        result = redis_client.set(key, "1", ex=5, nx=True)
        assert result is True, "SET NX returned False (key already exists?)"

        # GET the key (should return "1")
        value = redis_client.get(key)
        assert value in {b"1", "1"}, f"Expected '1', got {value!r}"

        # Check TTL (should be <= 5, and we allow up to 6s for clock skew)
        ttl = redis_client.ttl(key)
        assert ttl is not None and ttl > 0, f"TTL should be positive, got {ttl}"
        assert ttl <= 6, f"TTL should be <= 6s, got {ttl}"

        # Wait for TTL expiry (5 seconds + 1 second buffer)
        time.sleep(6)

        # Verify key no longer exists
        exists = redis_client.exists(key)
        assert exists == 0, f"Expected key to expire (EXISTS=0), got EXISTS={exists}"
