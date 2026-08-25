"""Tests for M02 (2025-10) backfill into MongoDB.

Verifies the backfill of 27 on-disk chunks into the dispatch_chunks collection
and GridFS bucket dispatch_chunk_content. All tests require MongoDB to be
reachable on 127.0.0.1:27017 (dev credentials documented in orch_db.py).

Test cases:
    count_must_be_27               -- dispatch_chunks has exactly 27 docs
    idempotent_rerun_noop           -- running backfill twice is a no-op
    gridfs_files_count_at_least_27  -- GridFS has >= 27 files
    aggregate_shape_matches_on_disk -- status aggregate matches on-disk classification
"""

import sys
from pathlib import Path

import pytest

# Add parent directory to path for skill imports
_test_dir = Path(__file__).parent.resolve()
_project_root = _test_dir.parent
sys.path.insert(0, str(_project_root))

from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

# Import the backfill script functions
sys.path.insert(0, str(_project_root / "scripts"))
from orch_db_backfill_2025_10 import EXPECTED_CHUNKS, MONTH, backfill_m02_chunks

# ---------------------------------------------------------------------------
# Test 1: dispatch_chunks count must be exactly 27
# ---------------------------------------------------------------------------


def test_count_must_be_27() -> None:
    """dispatch_chunks collection must have exactly 27 documents for 2025-10."""
    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        count = db["dispatch_chunks"].count_documents({"month": MONTH})

    assert count == EXPECTED_CHUNKS, f"Expected {EXPECTED_CHUNKS} dispatch_chunks documents for {MONTH}, found {count}"


# ---------------------------------------------------------------------------
# Test 2: Idempotent rerun is a no-op
# ---------------------------------------------------------------------------


def test_idempotent_rerun_noop() -> None:
    """Running backfill twice must be idempotent (no-op on second run)."""
    # First run: perform backfill
    stats1 = backfill_m02_chunks()

    # Second run: should skip all chunks (already present)
    stats2 = backfill_m02_chunks()

    # Verify second run skipped all chunks
    assert stats2["chunks_upserted"] == 0, (
        f"Second backfill run upserted {stats2['chunks_upserted']} chunks, expected 0 (idempotent)"
    )

    assert stats2["gridfs_files_written"] == 0, (
        f"Second backfill run wrote {stats2['gridfs_files_written']} GridFS files, expected 0 (idempotent)"
    )

    assert stats2["already_present"] == EXPECTED_CHUNKS, (
        f"Second backfill run found {stats2['already_present']} chunks already present, expected {EXPECTED_CHUNKS}"
    )

    # Verify final counts are unchanged
    assert stats2["chunks_processed"] == EXPECTED_CHUNKS
    assert stats1["chunks_processed"] == EXPECTED_CHUNKS


# ---------------------------------------------------------------------------
# Test 3: GridFS files count must be at least 27
# ---------------------------------------------------------------------------


def test_gridfs_files_count_at_least_27() -> None:
    """GridFS bucket dispatch_chunk_content must have >= 27 files."""
    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        count = db["dispatch_chunk_content.files"].count_documents({})

    assert count >= EXPECTED_CHUNKS, f"Expected >= {EXPECTED_CHUNKS} GridFS files, found {count}"


# ---------------------------------------------------------------------------
# Test 4: Aggregate shape matches on-disk classification
# ---------------------------------------------------------------------------


def test_aggregate_shape_matches_on_disk() -> None:
    """Status aggregate must match on-disk classification (all 27 chunks are 'ok')."""
    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        aggregate = list(
            db["dispatch_chunks"].aggregate(
                [
                    {"$match": {"month": MONTH}},
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                    {"$sort": {"_id": 1}},
                ]
            )
        )

    # All 27 chunks should have status 'ok'
    status_counts = {item["_id"]: item["count"] for item in aggregate}

    assert status_counts.get("ok", 0) == EXPECTED_CHUNKS, (
        f"Expected {EXPECTED_CHUNKS} chunks with status 'ok', got {status_counts}. Aggregate: {aggregate}"
    )

    # No other statuses should be present
    assert len(aggregate) == 1, f"Expected exactly 1 status group ('ok'), found {len(aggregate)}: {aggregate}"


# ---------------------------------------------------------------------------
# Test 5: All chunk documents have required fields
# ---------------------------------------------------------------------------


def test_chunk_docs_have_required_fields() -> None:
    """All dispatch_chunks documents must have the required metadata fields."""
    required_fields = [
        "month",
        "chunk_index",
        "transport_requested",
        "transport_used",
        "status",
        "wall_seconds",
        "content_chars",
        "parse_emails_count",
        "parse_chats_count",
        "first_token_latency_seconds",
        "stream_meta_hash",
        "attempt_no",
        "dispatch_started_at",
        "dispatch_completed_at",
        "resume_indicator",
        "raw_content_id",
    ]

    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        docs = list(db["dispatch_chunks"].find({"month": MONTH}))

    assert len(docs) == EXPECTED_CHUNKS, f"Expected {EXPECTED_CHUNKS} documents, found {len(docs)}"

    for doc in docs:
        for field in required_fields:
            assert field in doc, f"Document for chunk_index={doc.get('chunk_index')} missing required field: {field}"

        # Verify month field is correct
        assert doc["month"] == MONTH, f"Document month={doc['month']}, expected {MONTH}"

        # Verify chunk_index is in valid range
        assert 1 <= doc["chunk_index"] <= EXPECTED_CHUNKS, (
            f"chunk_index={doc['chunk_index']} out of range [1, {EXPECTED_CHUNKS}]"
        )

        # Verify raw_content_id is an ObjectId (GridFS reference)
        assert doc["raw_content_id"] is not None, f"raw_content_id is None for chunk_index={doc['chunk_index']}"


# ---------------------------------------------------------------------------
# Test 6: GridFS files can be read back
# ---------------------------------------------------------------------------


def test_gridfs_files_readable() -> None:
    """All GridFS files must be readable and contain valid JSON."""
    import json

    import gridfs

    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        fs = gridfs.GridFS(db, collection="dispatch_chunk_content")

        # Find all GridFS files for 2025-10
        files = list(db["dispatch_chunk_content.files"].find({"filename": {"$regex": f"^{MONTH}_chunk_"}}))

    assert len(files) >= EXPECTED_CHUNKS, f"Expected >= {EXPECTED_CHUNKS} GridFS files for {MONTH}, found {len(files)}"

    # Verify each file is readable and contains valid JSON
    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        fs = gridfs.GridFS(db, collection="dispatch_chunk_content")

        for file_doc in files:
            gridfs_file = fs.get(file_doc["_id"])
            content = gridfs_file.read().decode("utf-8")

            # Verify content is valid JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                pytest.fail(f"GridFS file {file_doc['filename']} contains invalid JSON: {e}")

            # Verify required fields in GridFS content
            assert "chunk_index" in data, f"GridFS file {file_doc['filename']} missing 'chunk_index' field"
            assert "emails" in data, f"GridFS file {file_doc['filename']} missing 'emails' field"
            assert "chat_bursts" in data, f"GridFS file {file_doc['filename']} missing 'chat_bursts' field"
