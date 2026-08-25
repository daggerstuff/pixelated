#!/usr/bin/env python3
"""Backfill 27 on-disk M02 (2025-10) chunks into MongoDB.

Reads each /tmp/wayfarer_smoke/chunks/2025-10_chunk_*.json file, classifies
via dispatch_resume_gate, and upserts dispatch_chunks documents with full
metadata. Raw chunk content is stored in GridFS bucket dispatch_chunk_content.

Wall budget: 10 minutes.

Acceptance criteria:
- db.dispatch_chunks.countDocuments({month:'2025-10'}) == 27
- db.dispatch_chunk_content.files.countDocuments({}) >= 27

Idempotent: rerunning is a no-op if all 27 chunks are already present.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import gridfs

# Add parent directory to path for skill imports
_script_dir = Path(__file__).parent.resolve()
_project_root = _script_dir.parent
sys.path.insert(0, str(_project_root))

from scripts.services.monthly_llm_driver.dispatch_resume_gate import scan
from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

CHUNKS_DIR = Path("/tmp/wayfarer_smoke/chunks")
MONTH = "2025-10"
EXPECTED_CHUNKS = 27


def extract_chunk_metadata(chunk_data: dict) -> dict:
    """Extract metadata fields from chunk JSON for dispatch_chunks doc.

    Args:
        chunk_data: Parsed chunk JSON from disk.

    Returns:
        Dict with fields for dispatch_chunks collection.
    """
    stream_meta = chunk_data.get("stream_meta", [])

    # Derive attempt_no from the number of stream_meta entries
    attempt_no = len(stream_meta) if stream_meta else 1

    # Extract first_token_latency_seconds from first successful attempt
    first_token_latency_seconds = None
    for meta in stream_meta:
        ftl = meta.get("first_token_latency_s")
        if ftl is not None:
            first_token_latency_seconds = ftl
            break

    # Extract content_chars from stream_meta
    content_chars = sum(meta.get("content_chars", 0) for meta in stream_meta)

    # Parse counts from the chunk data
    parse_emails_count = len(chunk_data.get("emails", []))
    parse_chats_count = len(chunk_data.get("chat_bursts", []))

    # Use wall_seconds from chunk data (sum of all attempt elapsed_s)
    wall_seconds = chunk_data.get("wall_seconds", 0.0)

    # Dispatch timestamps (use current time as approximation since chunk
    # files don't store explicit start/complete timestamps)
    now = datetime.utcnow()

    return {
        "month": chunk_data.get("month", MONTH),
        "chunk_index": chunk_data.get("chunk_index"),
        "transport_requested": chunk_data.get("transport_requested"),
        "transport_used": chunk_data.get("transport_used"),
        "status": chunk_data.get("status"),
        "wall_seconds": wall_seconds,
        "content_chars": content_chars,
        "parse_emails_count": parse_emails_count,
        "parse_chats_count": parse_chats_count,
        "first_token_latency_seconds": first_token_latency_seconds,
        "stream_meta_hash": chunk_data.get("stream_meta_hash"),
        "attempt_no": attempt_no,
        "dispatch_started_at": now,
        "dispatch_completed_at": now,
        "resume_indicator": "original",
        "heartbeat_at": now,
    }


def backfill_m02_chunks() -> dict:
    """Backfill all 27 M02 chunks into MongoDB.

    Returns:
        Dict with backfill statistics:
        - chunks_processed: number of chunks processed
        - chunks_upserted: number of chunks upserted
        - gridfs_files_written: number of GridFS files written
        - already_present: number of chunks already in DB (idempotent skip)
    """
    # Verify all 27 chunk files exist on disk
    chunk_files = sorted(CHUNKS_DIR.glob(f"{MONTH}_chunk_*.json"))
    if len(chunk_files) != EXPECTED_CHUNKS:
        raise RuntimeError(f"Expected {EXPECTED_CHUNKS} chunk files, found {len(chunk_files)}")

    # Run dispatch_resume_gate scan to classify chunks
    report = scan(MONTH, CHUNKS_DIR)

    # Verify classification matches expectations (all 27 should be 'ok')
    if len(report.ok) != EXPECTED_CHUNKS:
        raise RuntimeError(f"Expected {EXPECTED_CHUNKS} 'ok' chunks, got {len(report.ok)}. Report: {report.to_dict()}")

    # Connect to MongoDB
    with ConnectionBundle.from_env() as bundle:
        db = bundle.mongo_db
        dispatch_chunks = db["dispatch_chunks"]

        # Create GridFS bucket for raw chunk content
        fs = gridfs.GridFS(db, collection="dispatch_chunk_content")

        stats = {
            "chunks_processed": 0,
            "chunks_upserted": 0,
            "gridfs_files_written": 0,
            "already_present": 0,
        }

        # Process each chunk file
        for chunk_file in chunk_files:
            stats["chunks_processed"] += 1

            # Read and parse chunk JSON
            chunk_data = json.loads(chunk_file.read_text())
            chunk_index = chunk_data.get("chunk_index")
            transport_used = chunk_data.get("transport_used")

            # Check if chunk already exists in DB (idempotent check)
            existing = dispatch_chunks.find_one({"month": MONTH, "chunk_index": chunk_index})

            if existing:
                # Chunk already present; skip upsert (idempotent)
                stats["already_present"] += 1

                # Check if GridFS file exists
                gridfs_filename = f"{MONTH}_chunk_{chunk_index:02d}_{transport_used}.json"
                existing_gridfs = fs.find_one({"filename": gridfs_filename})
                if existing_gridfs:
                    # Both dispatch_chunks doc and GridFS file exist; skip
                    continue

            # Extract metadata for dispatch_chunks doc
            metadata = extract_chunk_metadata(chunk_data)

            # Store raw chunk content in GridFS
            gridfs_filename = f"{MONTH}_chunk_{chunk_index:02d}_{transport_used}.json"
            raw_content = chunk_file.read_text()

            # Delete existing GridFS file if present (to avoid duplicates)
            existing_gridfs = fs.find_one({"filename": gridfs_filename})
            if existing_gridfs:
                fs.delete(existing_gridfs._id)

            # Write new GridFS file
            gridfs_id = fs.put(
                raw_content.encode("utf-8"),
                filename=gridfs_filename,
                content_type="application/json",
            )

            stats["gridfs_files_written"] += 1

            # Add raw_content_id (GridFS file ObjectId) to metadata
            metadata["raw_content_id"] = gridfs_id

            # Upsert dispatch_chunks document
            dispatch_chunks.update_one(
                {"month": MONTH, "chunk_index": chunk_index},
                {"$set": metadata},
                upsert=True,
            )

            stats["chunks_upserted"] += 1

        # Verify acceptance criteria
        final_count = dispatch_chunks.count_documents({"month": MONTH})
        gridfs_count = db["dispatch_chunk_content.files"].count_documents({})

        # Verify acceptance criteria
        if final_count != EXPECTED_CHUNKS:
            raise RuntimeError(
                f"Acceptance criteria failed: dispatch_chunks count = {final_count}, expected {EXPECTED_CHUNKS}"
            )

        if gridfs_count < EXPECTED_CHUNKS:
            raise RuntimeError(
                f"Acceptance criteria failed: GridFS files count = {gridfs_count}, expected >= {EXPECTED_CHUNKS}"
            )

        # Verify aggregate shape matches on-disk classification
        aggregate = list(
            dispatch_chunks.aggregate(
                [
                    {"$match": {"month": MONTH}},
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                    {"$sort": {"_id": 1}},
                ]
            )
        )

        # All chunks should be 'ok' status
        status_counts = {item["_id"]: item["count"] for item in aggregate}
        if status_counts.get("ok", 0) != EXPECTED_CHUNKS:
            raise RuntimeError(
                f"Aggregate shape mismatch: expected {EXPECTED_CHUNKS} 'ok' chunks, "
                f"got {status_counts}. Aggregate: {aggregate}"
            )

        return stats


def main() -> int:
    """Main entry point."""

    try:
        backfill_m02_chunks()
        return 0
    except Exception:
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
