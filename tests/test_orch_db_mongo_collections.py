"""Tests for ``scripts.services.monthly_llm_driver.orch_db_collections``.

Verifies the Mongo collection + index setup used by the monthly LLM
pipeline orchestrator.  All tests require MongoDB to be reachable on
127.0.0.1:27017 (dev credentials documented in ``orch_db.py``).

Test cases:
    collections_exist          -- all 5 collections created
    indexes_match_expected     -- all indexes have correct keys/flags
    idempotent_recreate        -- calling setup_collections twice is safe
"""

import contextlib

import pymongo
import pytest

from scripts.services.monthly_llm_driver.orch_db_collections import (
    setup_collections,
    verify_collections,
)


@pytest.fixture
def mongo_db():
    """Provide a ``pymongo.database.Database`` for db ``hackathon``.

    Uses a dedicated test database to avoid mutating the production
    ``hackathon`` database.  The test db is dropped after each test.
    """
    client = pymongo.MongoClient(
        "mongodb://127.0.0.1:27017",
        serverSelectionTimeoutMS=5000,
    )
    client.server_info()
    db = client["hackathon_test_collections"]
    yield db
    client.drop_database("hackathon_test_collections")
    client.close()


# ---------------------------------------------------------------------------
# Test 1: All 5 collections exist after setup
# ---------------------------------------------------------------------------


def test_collections_exist(mongo_db):
    """``setup_collections`` must create all 5 collections."""
    setup_collections(mongo_db)

    existing = mongo_db.list_collection_names()

    # dispatch_chunks
    assert "dispatch_chunks" in existing, "dispatch_chunks collection missing"

    # GridFS bucket creates two collections
    assert "dispatch_chunk_content.files" in existing, "dispatch_chunk_content.files collection missing"
    assert "dispatch_chunk_content.chunks" in existing, "dispatch_chunk_content.chunks collection missing"

    # audit_findings
    assert "audit_findings" in existing, "audit_findings collection missing"

    # postfix_enrichment
    assert "postfix_enrichment" in existing, "postfix_enrichment collection missing"

    # cross_month_invariants
    assert "cross_month_invariants" in existing, "cross_month_invariants collection missing"


# ---------------------------------------------------------------------------
# Test 2: Indexes match expected specifications
# ---------------------------------------------------------------------------


def test_indexes_match_expected(mongo_db):
    """All indexes must have the correct keys, unique, and sparse flags."""
    setup_collections(mongo_db)

    # -- dispatch_chunks ---------------------------------------------------
    dc_indexes = mongo_db["dispatch_chunks"].index_information()

    # Compound unique index on (month, chunk_index)
    month_chunk_found = False
    for _name, info in dc_indexes.items():
        key = info.get("key", [])
        if key == [("month", 1), ("chunk_index", 1)]:
            assert info.get("unique") is True, "dispatch_chunks(month, chunk_index) must be unique"
            month_chunk_found = True
            break
    assert month_chunk_found, "Missing compound unique index on (month, chunk_index)"

    # Sparse index on heartbeat_at
    heartbeat_found = False
    for _name, info in dc_indexes.items():
        key = info.get("key", [])
        if key == [("heartbeat_at", 1)]:
            assert info.get("sparse") is True, "dispatch_chunks(heartbeat_at) must be sparse"
            heartbeat_found = True
            break
    assert heartbeat_found, "Missing sparse index on heartbeat_at"

    # -- audit_findings ----------------------------------------------------
    af_indexes = mongo_db["audit_findings"].index_information()
    month_finding_found = False
    for _name, info in af_indexes.items():
        key = info.get("key", [])
        if key == [("month", 1), ("finding_code", 1)]:
            assert info.get("sparse") is True, "audit_findings(month, finding_code) must be sparse"
            month_finding_found = True
            break
    assert month_finding_found, "Missing sparse index on audit_findings(month, finding_code)"

    # -- postfix_enrichment ------------------------------------------------
    pe_indexes = mongo_db["postfix_enrichment"].index_information()
    month_email_found = False
    for _name, info in pe_indexes.items():
        key = info.get("key", [])
        if key == [("month", 1), ("email_id", 1)]:
            assert info.get("sparse") is True, "postfix_enrichment(month, email_id) must be sparse"
            month_email_found = True
            break
    assert month_email_found, "Missing sparse index on postfix_enrichment(month, email_id)"

    # -- cross_month_invariants --------------------------------------------
    cmi_indexes = mongo_db["cross_month_invariants"].index_information()
    invariant_found = False
    for _name, info in cmi_indexes.items():
        key = info.get("key", [])
        if key == [("invariant_code", 1)]:
            assert info.get("sparse") is True, "cross_month_invariants(invariant_code) must be sparse"
            invariant_found = True
            break
    assert invariant_found, "Missing sparse index on cross_month_invariants(invariant_code)"

    # -- GridFS bucket verification ----------------------------------------
    # GridFS creates its own indexes on files collection
    fs_files_indexes = mongo_db["dispatch_chunk_content.files"].index_information()
    # GridFS always creates a compound index on (files_id, n) for chunks
    # and on filename for files.  Just verify the collections exist.
    assert len(fs_files_indexes) >= 1, "GridFS files collection has no indexes"


# ---------------------------------------------------------------------------
# Test 3: setup_collections is idempotent
# ---------------------------------------------------------------------------


def test_idempotent_recreate(mongo_db):
    """Calling ``setup_collections`` twice must not raise."""
    # First call: creates collections and indexes
    setup_collections(mongo_db)

    # Verify state after first call
    result1 = verify_collections(mongo_db)
    assert result1 is not None

    # Second call: must succeed without raising (idempotent)
    setup_collections(mongo_db)

    # Verify state is unchanged after second call
    result2 = verify_collections(mongo_db)
    assert result2 is not None

    # Both results should have the same structure
    assert set(result1.keys()) == set(result2.keys())


# ---------------------------------------------------------------------------
# Test 4: verify_collections raises on missing collection
# ---------------------------------------------------------------------------


def test_verify_collections_raises_on_missing(mongo_db):
    """``verify_collections`` must raise if expected collections are missing."""
    # Don't call setup_collections; collections don't exist yet
    with pytest.raises(RuntimeError, match="Missing collection"):
        verify_collections(mongo_db)


# ---------------------------------------------------------------------------
# Test 5: setup_collections is idempotent against pre-existing GridFS indexes
# ---------------------------------------------------------------------------


def test_setup_collections_idempotent_against_preexisting_gridfs(mongo_db):
    """setup_collections must not raise IndexOptionsConflict (code 85) when
    GridFS indexes already exist with auto-generated names.

    Simulates the case where a partial GridFS initialization has already
    created indexes with names like ``filename_1_uploadDate_1`` and
    ``files_id_1_n_1``, which differ from the names we would use
    (``filename_uploadDate_idx``, ``files_id_n_unique_idx``).

    The fix matches existing indexes by (key_signature, unique, sparse)
    rather than by name, so setup_collections is a no-op when the matching
    index already exists.
    """
    # Simulate pre-existing GridFS indexes with auto-generated names
    # (as if GridFS was partially initialized before setup_collections ran)
    from pymongo.errors import CollectionInvalid

    # Create the GridFS collections first (simulating partial GridFS init)
    for coll_name in ("dispatch_chunk_content.files", "dispatch_chunk_content.chunks"):
        with contextlib.suppress(CollectionInvalid):
            mongo_db.create_collection(coll_name)

    # Create indexes with auto-generated names (as GridFS would)
    mongo_db["dispatch_chunk_content.files"].create_index(
        [("filename", 1), ("uploadDate", 1)],
        name="filename_1_uploadDate_1",  # auto-generated name
    )
    mongo_db["dispatch_chunk_content.chunks"].create_index(
        [("files_id", 1), ("n", 1)],
        unique=True,
        name="files_id_1_n_1",  # auto-generated name
    )

    # Now call setup_collections; it must NOT raise IndexOptionsConflict
    # because it matches by (key_signature, unique, sparse) and finds
    # the pre-existing indexes.
    setup_collections(mongo_db)

    # Verify collections are set up correctly
    result = verify_collections(mongo_db)
    assert result is not None

    # Verify the indexes still exist (either the pre-existing ones or
    # newly created ones with our names)
    fs_files_indexes = mongo_db["dispatch_chunk_content.files"].index_information()
    fs_chunks_indexes = mongo_db["dispatch_chunk_content.chunks"].index_information()

    # Check that an index with the correct key signature exists
    files_key_found = False
    for _name, info in fs_files_indexes.items():
        if info.get("key") == [("filename", 1), ("uploadDate", 1)]:
            files_key_found = True
            break
    assert files_key_found, "Missing index on dispatch_chunk_content.files(filename, uploadDate)"

    chunks_key_found = False
    for _name, info in fs_chunks_indexes.items():
        if info.get("key") == [("files_id", 1), ("n", 1)]:
            assert info.get("unique") is True, "Index on chunks(files_id, n) must be unique"
            chunks_key_found = True
            break
    assert chunks_key_found, "Missing index on dispatch_chunk_content.chunks(files_id, n)"

    # Call setup_collections again to verify idempotency
    setup_collections(mongo_db)
