"""Mongo collection and index setup for the monthly LLM pipeline orchestrator.

Creates the five Mongo collections and their indexes in db='hackathon':

1. ``dispatch_chunks``
   - Compound unique index: ``(month:1, chunk_index:1)``
   - Sparse index: ``(heartbeat_at:1)``

2. ``dispatch_chunk_content``
   - GridFS bucket (creates ``dispatch_chunk_content.files`` and
     ``dispatch_chunk_content.chunks`` collections automatically)

3. ``audit_findings``
   - Sparse index: ``(month:1, finding_code:1)``

4. ``postfix_enrichment``
   - Sparse index: ``(month:1, email_id:1)``

5. ``cross_month_invariants``
   - Sparse index: ``(invariant_code:1)``

Wall budget: 5 minutes total for all index creations.

Returns (raises) on any index creation failure so the orchestrator
can surface the error.

Usage::

    from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle
    from scripts.services.monthly_llm_driver.orch_db_collections import setup_collections

    with ConnectionBundle.from_env() as bundle:
        setup_collections(bundle.mongo_db)
"""

from __future__ import annotations

from pymongo.database import Database
from pymongo.errors import OperationFailure

# Wall budget: 5 minutes for all index creations (MongoDB default
# serverSelectionTimeoutMS is 30s per operation; we don't override
# because index creation is fast on empty collections).
_WALL_BUDGET_MINUTES = 5


def _index_exists_by_signature(
    db: Database, collection_name: str, keys: list, unique: bool = False, sparse: bool = False
) -> bool:
    """Check if an index exists matching the given key signature and flags.

    Matches by (key_signature, unique, sparse) rather than by name.
    This handles the case where GridFS auto-creates indexes with
    auto-generated names (e.g., ``filename_1_uploadDate_1``) that differ
    from the names we would use (e.g., ``filename_uploadDate_idx``).

    Args:
        db: MongoDB database.
        collection_name: Name of the collection.
        keys: List of (field, direction) tuples.
        unique: Whether the index should be unique.
        sparse: Whether the index should be sparse.

    Returns:
        True if a matching index exists, False otherwise.
    """
    try:
        indexes = db[collection_name].index_information()
    except OperationFailure:
        # Collection doesn't exist yet
        return False

    for _idx_name, idx_info in indexes.items():
        idx_key = idx_info.get("key", [])
        idx_unique = idx_info.get("unique", False)
        idx_sparse = idx_info.get("sparse", False)

        # Match by key signature
        if idx_key == keys:
            # Match by flags
            if unique == idx_unique and sparse == idx_sparse:
                return True

    return False


def _ensure_index(
    db: Database, collection_name: str, keys: list, name: str, unique: bool = False, sparse: bool = False
) -> None:
    """Ensure an index exists with the given key signature and flags.

    If an index with matching (key_signature, unique, sparse) already exists,
    this is a no-op (the existing index is kept, regardless of its name).

    If no matching index exists, creates the index with the given name.
    If an index with the same keys but different flags exists, drops it
    and recreates with the canonical spec.

    Args:
        db: MongoDB database.
        collection_name: Name of the collection.
        keys: List of (field, direction) tuples.
        name: Name for the index.
        unique: Whether the index should be unique.
        sparse: Whether the index should be sparse.
    """
    if _index_exists_by_signature(db, collection_name, keys, unique=unique, sparse=sparse):
        # Matching index exists; no-op
        return

    # No matching index; create it.
    # If an index with the same keys but different flags exists, drop it first
    # to avoid IndexOptionsConflict (code 85).
    try:
        indexes = db[collection_name].index_information()
        for idx_name, idx_info in indexes.items():
            idx_key = idx_info.get("key", [])
            if idx_key == keys:
                # Same keys but different flags; drop and recreate
                db[collection_name].drop_index(idx_name)
                break
    except OperationFailure:
        # Collection doesn't exist yet; that's fine
        pass

    db[collection_name].create_index(
        keys,
        unique=unique,
        sparse=sparse,
        name=name,
    )


def setup_collections(db: Database) -> None:
    """Create all five collections and their indexes in ``db``.

    Idempotent: safe to call multiple times. Index creation uses
    ``create_index`` which is a no-op if the index already exists
    with the same specification.

    Raises on any index creation failure (return-to-orchestrator signal).

    Args:
        db: ``pymongo.database.Database`` for db ``hackathon``.
    """
    # -- dispatch_chunks ---------------------------------------------------
    dispatch_chunks = db["dispatch_chunks"]

    # Compound unique index on (month, chunk_index)
    dispatch_chunks.create_index(
        [("month", 1), ("chunk_index", 1)],
        unique=True,
        name="month_chunk_unique",
    )

    # Sparse index on heartbeat_at
    dispatch_chunks.create_index(
        [("heartbeat_at", 1)],
        sparse=True,
        name="heartbeat_at_sparse",
    )

    # -- dispatch_chunk_content (GridFS) -----------------------------------
    # GridFS uses two collections: ``<bucket>.files`` and ``<bucket>.chunks``.
    # pymongo's ``gridfs.GridFS`` constructor is lazy — it does NOT create
    # the underlying collections until the first write.  We explicitly
    # create them here so the acceptance check
    #   mongo hackathon --eval 'db.dispatch_chunk_content.files.findOne()'
    # succeeds even before any data is written.
    from pymongo.errors import CollectionInvalid

    for _gridfs_coll in ("dispatch_chunk_content.files", "dispatch_chunk_content.chunks"):
        try:
            db.create_collection(_gridfs_coll)
        except CollectionInvalid:
            # Collection already exists; this is fine (idempotent)
            pass

    # Create standard GridFS indexes explicitly.  GridFS is lazy about
    # index creation (only on first write), so we create them here to
    # ensure they exist from the start.  Use _ensure_index which matches
    # by (key_signature, unique, sparse) rather than by name, so it is
    # idempotent against DBs where GridFS auto-created indexes with
    # auto-generated names (e.g. ``filename_1_uploadDate_1``).
    _ensure_index(
        db,
        "dispatch_chunk_content.files",
        [("filename", 1), ("uploadDate", 1)],
        name="filename_uploadDate_idx",
    )
    _ensure_index(
        db,
        "dispatch_chunk_content.chunks",
        [("files_id", 1), ("n", 1)],
        name="files_id_n_unique_idx",
        unique=True,
    )

    # -- audit_findings ----------------------------------------------------
    audit_findings = db["audit_findings"]

    # Sparse index on (month, finding_code)
    audit_findings.create_index(
        [("month", 1), ("finding_code", 1)],
        sparse=True,
        name="month_finding_sparse",
    )

    # -- postfix_enrichment ------------------------------------------------
    postfix_enrichment = db["postfix_enrichment"]

    # Sparse index on (month, email_id)
    postfix_enrichment.create_index(
        [("month", 1), ("email_id", 1)],
        sparse=True,
        name="month_email_sparse",
    )

    # -- cross_month_invariants --------------------------------------------
    cross_month_invariants = db["cross_month_invariants"]

    # Sparse index on invariant_code
    cross_month_invariants.create_index(
        [("invariant_code", 1)],
        sparse=True,
        name="invariant_code_sparse",
    )


def verify_collections(db: Database) -> dict[str, list[dict]]:
    """Verify all five collections and their indexes exist.

    Returns a dict mapping collection names to their index specs.
    Raises if any expected collection or index is missing.

    Args:
        db: ``pymongo.database.Database`` for db ``hackathon``.

    Returns:
        Dict mapping collection name to list of index info dicts.
    """
    expected_collections = [
        "dispatch_chunks",
        "dispatch_chunk_content.files",
        "dispatch_chunk_content.chunks",
        "audit_findings",
        "postfix_enrichment",
        "cross_month_invariants",
    ]

    existing = db.list_collection_names()
    for coll_name in expected_collections:
        if coll_name not in existing:
            raise RuntimeError(f"Missing collection: {coll_name}")

    result = {}

    # dispatch_chunks: verify compound unique + sparse
    dispatch_chunks = db["dispatch_chunks"]
    indexes = dispatch_chunks.index_information()
    result["dispatch_chunks"] = []

    # Check for compound unique index on (month, chunk_index)
    month_chunk_idx = None
    for _idx_name, idx_info in indexes.items():
        key = idx_info.get("key", [])
        if key == [("month", 1), ("chunk_index", 1)]:
            month_chunk_idx = idx_info
            break
    if month_chunk_idx is None:
        raise RuntimeError("Missing compound unique index on dispatch_chunks(month, chunk_index)")
    if not month_chunk_idx.get("unique"):
        raise RuntimeError("Index on dispatch_chunks(month, chunk_index) must be unique")
    result["dispatch_chunks"].append(
        {
            "name": month_chunk_idx.get("name"),
            "key": month_chunk_idx.get("key"),
            "unique": True,
        }
    )

    # Check for sparse index on heartbeat_at
    heartbeat_idx = None
    for _idx_name, idx_info in indexes.items():
        key = idx_info.get("key", [])
        if key == [("heartbeat_at", 1)]:
            heartbeat_idx = idx_info
            break
    if heartbeat_idx is None:
        raise RuntimeError("Missing sparse index on dispatch_chunks(heartbeat_at)")
    if not heartbeat_idx.get("sparse"):
        raise RuntimeError("Index on dispatch_chunks(heartbeat_at) must be sparse")
    result["dispatch_chunks"].append(
        {
            "name": heartbeat_idx.get("name"),
            "key": heartbeat_idx.get("key"),
            "sparse": True,
        }
    )

    # audit_findings: verify sparse index on (month, finding_code)
    audit_findings = db["audit_findings"]
    indexes = audit_findings.index_information()
    result["audit_findings"] = []
    month_finding_idx = None
    for _idx_name, idx_info in indexes.items():
        key = idx_info.get("key", [])
        if key == [("month", 1), ("finding_code", 1)]:
            month_finding_idx = idx_info
            break
    if month_finding_idx is None:
        raise RuntimeError("Missing sparse index on audit_findings(month, finding_code)")
    if not month_finding_idx.get("sparse"):
        raise RuntimeError("Index on audit_findings(month, finding_code) must be sparse")
    result["audit_findings"].append(
        {
            "name": month_finding_idx.get("name"),
            "key": month_finding_idx.get("key"),
            "sparse": True,
        }
    )

    # postfix_enrichment: verify sparse index on (month, email_id)
    postfix_enrichment = db["postfix_enrichment"]
    indexes = postfix_enrichment.index_information()
    result["postfix_enrichment"] = []
    month_email_idx = None
    for _idx_name, idx_info in indexes.items():
        key = idx_info.get("key", [])
        if key == [("month", 1), ("email_id", 1)]:
            month_email_idx = idx_info
            break
    if month_email_idx is None:
        raise RuntimeError("Missing sparse index on postfix_enrichment(month, email_id)")
    if not month_email_idx.get("sparse"):
        raise RuntimeError("Index on postfix_enrichment(month, email_id) must be sparse")
    result["postfix_enrichment"].append(
        {
            "name": month_email_idx.get("name"),
            "key": month_email_idx.get("key"),
            "sparse": True,
        }
    )

    # cross_month_invariants: verify sparse index on invariant_code
    cross_month_invariants = db["cross_month_invariants"]
    indexes = cross_month_invariants.index_information()
    result["cross_month_invariants"] = []
    invariant_idx = None
    for _idx_name, idx_info in indexes.items():
        key = idx_info.get("key", [])
        if key == [("invariant_code", 1)]:
            invariant_idx = idx_info
            break
    if invariant_idx is None:
        raise RuntimeError("Missing sparse index on cross_month_invariants(invariant_code)")
    if not invariant_idx.get("sparse"):
        raise RuntimeError("Index on cross_month_invariants(invariant_code) must be sparse")
    result["cross_month_invariants"].append(
        {
            "name": invariant_idx.get("name"),
            "key": invariant_idx.get("key"),
            "sparse": True,
        }
    )

    # GridFS bucket verification (files + chunks collections exist)
    result["dispatch_chunk_content"] = {
        "files_exists": "dispatch_chunk_content.files" in db.list_collection_names(),
        "chunks_exists": "dispatch_chunk_content.chunks" in db.list_collection_names(),
    }

    return result
