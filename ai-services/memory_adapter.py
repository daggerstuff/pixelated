"""
AI Services — Unified Memory Adapter (MongoDB)

Translates between the ai-services MongoDB database and the UnifiedMemory
canonical schema. Allows ai-services to read/write memories in the same
format understood by Foresight and the Astro frontend.

Sprint 1 — ADHD-320: Update AI Services Memory Integration
Epic: ADHD-3 Foresight Memory Architecture
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

# Import UnifiedMemory from the foresight_mcp package.
# We rely on foresight_mcp being installed in the same Python environment,
# or available via PYTHONPATH (set in docker-compose / Procfile).
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "foresight-mcp"))
    from foresight_mcp.schema import (
        CreateMemoryInput,
        EmotionalContext,
        EmpathyMetrics,
        MemoryScope,
        RetentionPolicy,
        SourceService,
        StrengthTrend,
        UnifiedMemory,
        UpdateMemoryInput,
    )

    _SCHEMA_IMPORT_ERR: ImportError | None = None
except ImportError as _e:
    _SCHEMA_IMPORT_ERR = _e

from database import DatabaseService

logger = logging.getLogger(__name__)


def _require_schema() -> None:
    """Raise a descriptive RuntimeError when the schema package is unavailable.

    Called once in __init__ so the error surfaces at construction time rather
    than silently swallowing the ImportError and then raising an opaque
    RuntimeError on the first method call.
    """
    if _SCHEMA_IMPORT_ERR is not None:
        raise RuntimeError(
            "foresight_mcp package not available — cannot use UnifiedMemoryAdapter. "
            f"Underlying import error: {_SCHEMA_IMPORT_ERR}. "
            "Ensure foresight-mcp is in PYTHONPATH."
        )


class UnifiedMemoryAdapter:
    """
    Adapter that reads and writes UnifiedMemory documents to/from the
    ai-services MongoDB database.

    Usage::

        db = DatabaseService(uri=os.environ["MONGODB_URI"])
        db.connect()
        adapter = UnifiedMemoryAdapter(db)
        adapter.ensure_indexes()  # call once at startup

        # Store a new memory
        memory = UnifiedMemory.create(
            content="Patient disclosed history of childhood trauma.",
            user_id="user-123",
            category="crisis",
            source_service=SourceService.AI_SERVICES,
        )
        memory_id = adapter.save_memory(memory)

        # Retrieve
        memory = adapter.get_memory(memory_id)

        # Partial update — only writes the provided fields
        updated = adapter.update_memory(memory_id, UpdateMemoryInput(importance=0.9))

        # Touch (record retrieval event without mutating content)
        adapter.touch_memory(memory_id)

        # List session memories
        memories = adapter.list_session_memories(session_id="session-abc")
    """

    # The MongoDB collection name for unified memories
    COLLECTION = "unified_memories"

    def __init__(self, db_service: DatabaseService) -> None:
        _require_schema()
        self.db = db_service

    def _collection(self):
        return self.db.get_collection(self.COLLECTION)

    # -------------------------------------------------------------------------
    # Index management
    # -------------------------------------------------------------------------

    def ensure_indexes(self) -> None:
        """
        Create the recommended indexes on the unified_memories collection.

        Safe to call repeatedly — MongoDB ignores requests to recreate
        an index that already exists with the same specification.
        Call once at service startup before handling traffic.
        """
        col = self._collection()

        # Primary lookup patterns
        col.create_index("userId")
        col.create_index("tenantId")
        col.create_index([("userId", 1), ("tenantId", 1)])
        col.create_index([("userId", 1), ("tenantId", 1), ("category", 1)])

        # Session-scoped queries
        col.create_index("sessionId")
        col.create_index([("sessionId", 1), ("userId", 1)])

        # Decay scheduler: find stale / low-importance memories efficiently
        col.create_index([("strengthTrend", 1), ("importance", 1)])
        col.create_index([("retention", 1), ("importance", 1)])

        # Temporal sort (most common cursor sort)
        col.create_index([("createdAt", -1)])
        col.create_index([("userId", 1), ("createdAt", -1)])

        # Ghost node queries
        col.create_index([("isGhost", 1), ("userId", 1)])

        logger.info("unified_memories indexes ensured")

    # -------------------------------------------------------------------------
    # Write operations
    # -------------------------------------------------------------------------

    def save_memory(self, memory: UnifiedMemory, session_id: str | None = None) -> str:
        """
        Persist a UnifiedMemory to MongoDB (upsert by id).

        Returns the document _id as a string.
        """
        doc = memory.to_mongo_doc()
        # Add session_id at the top level for easy querying
        if session_id:
            doc["sessionId"] = session_id

        # HIPAA: mark that content may contain PHI — encryption handled at DB layer
        doc["_hipaaCompliant"] = True
        doc["_storedAt"] = datetime.now(timezone.utc).isoformat()

        # Audit log
        if session_id:
            self.db._log_audit_event("save_unified_memory", session_id, memory.user_id)

        collection = self._collection()
        try:
            collection.replace_one(
                {"_id": memory.id},
                doc,
                upsert=True,
            )
            return memory.id
        except Exception as e:
            logger.error(f"save_memory failed: {e}")
            raise

    def update_memory(
        self,
        memory_id: str,
        updates: UpdateMemoryInput,
        user_id: str | None = None,
    ) -> UnifiedMemory | None:
        """
        Apply a partial update to an existing memory.

        Only fields explicitly set on ``updates`` are written; all other fields
        remain unchanged.  Automatically bumps ``version`` and sets ``updatedAt``.

        Returns the updated UnifiedMemory, or None if not found.
        """
        query: dict[str, Any] = {"_id": memory_id}
        if user_id:
            query["userId"] = user_id

        # Map UpdateMemoryInput fields → MongoDB camelCase keys
        scalar_fields: dict[str, str] = {
            "content": "content",
            "scope": "scope",
            "retention": "retention",
            "category": "category",
            "tags": "tags",
            "importance": "importance",
        }
        set_doc: dict[str, Any] = {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        for py_field, mongo_field in scalar_fields.items():
            value = getattr(updates, py_field, None)
            if value is not None:
                # Enums: store their .value string
                set_doc[mongo_field] = value.value if hasattr(value, "value") else value

        # Nullable sub-objects: include only when explicitly provided
        if updates.emotional_context is not None:
            set_doc["emotionalContext"] = updates.emotional_context.to_camel_dict()
        if updates.empathy_metrics is not None:
            set_doc["empathyMetrics"] = updates.empathy_metrics.to_camel_dict()

        if len(set_doc) == 1:
            # Only updatedAt — nothing substantive to change
            logger.debug(f"update_memory({memory_id}): no fields to update")
            return self.get_memory(memory_id, user_id)

        try:
            result = self._collection().find_one_and_update(
                query,
                {
                    "$set": set_doc,
                    "$inc": {"version": 1},
                },
                return_document=True,
            )
        except Exception as e:
            logger.error(f"update_memory failed for {memory_id}: {e}")
            raise

        if result is None:
            return None
        if result.get("_encrypted"):
            result = self.db._decrypt_phi(result)
        return UnifiedMemory.from_mongo_doc(result)

    def touch_memory(self, memory_id: str, user_id: str | None = None) -> bool:
        """
        Record a retrieval event on a memory without mutating its content.

        - Sets ``accessedAt`` and ``lastRetrievedAt`` to now
        - Increments ``activationCount`` and ``retrievalCount``
        - Re-evaluates ``strengthTrend`` based on updated activation count

        Returns True if the document was found and updated.
        """
        query: dict[str, Any] = {"_id": memory_id}
        if user_id:
            query["userId"] = user_id

        # Peek at current activation count to decide on new trend
        doc = self._collection().find_one(query, {"activationCount": 1})
        if doc is None:
            return False

        new_activation_count = (doc.get("activationCount") or 0) + 1

        # Heuristic: 3+ activations → strengthening; 0 → stale; else stable
        if new_activation_count >= 3:
            new_trend = StrengthTrend.STRENGTHENING.value
        elif new_activation_count == 0:
            new_trend = StrengthTrend.STALE.value
        else:
            new_trend = StrengthTrend.STABLE.value

        now = datetime.now(timezone.utc).isoformat()
        try:
            result = self._collection().update_one(
                query,
                {
                    "$set": {
                        "accessedAt": now,
                        "lastRetrievedAt": now,
                        "strengthTrend": new_trend,
                    },
                    "$inc": {
                        "activationCount": 1,
                        "retrievalCount": 1,
                    },
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"touch_memory failed for {memory_id}: {e}")
            raise

    def delete_memory(self, memory_id: str, user_id: str | None = None) -> bool:
        """Delete a unified memory. Returns True if deleted."""
        query: dict[str, Any] = {"_id": memory_id}
        if user_id:
            query["userId"] = user_id
        result = self._collection().delete_one(query)
        return result.deleted_count > 0

    # -------------------------------------------------------------------------
    # Read operations
    # -------------------------------------------------------------------------

    def get_memory(self, memory_id: str, user_id: str | None = None) -> UnifiedMemory | None:
        """Retrieve a unified memory by ID."""
        query: dict[str, Any] = {"_id": memory_id}
        if user_id:
            query["userId"] = user_id

        doc = self._collection().find_one(query)
        if doc is None:
            return None

        # Decrypt if encrypted (delegates to existing db layer)
        if doc.get("_encrypted"):
            doc = self.db._decrypt_phi(doc)

        return UnifiedMemory.from_mongo_doc(doc)

    def get_memory_count(
        self,
        user_id: str,
        tenant_id: str = "default",
        category: str | None = None,
    ) -> int:
        """
        Return the number of memories for a user.

        Useful for pagination headers (``X-Total-Count``) and lightweight
        health checks. Uses ``count_documents`` rather than a full cursor scan.
        """
        query: dict[str, Any] = {"userId": user_id, "tenantId": tenant_id}
        if category:
            query["category"] = category
        return self._collection().count_documents(query)

    def list_session_memories(
        self,
        session_id: str,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[UnifiedMemory]:
        """List all unified memories for a session, newest first."""
        query: dict[str, Any] = {"sessionId": session_id}
        if user_id:
            query["userId"] = user_id

        cursor = self._collection().find(query).sort("createdAt", -1).limit(limit)

        results = []
        for doc in cursor:
            try:
                results.append(UnifiedMemory.from_mongo_doc(doc))
            except Exception as e:
                logger.warning(f"Skipping malformed memory doc {doc.get('_id')}: {e}")

        return results

    def list_user_memories(
        self,
        user_id: str,
        tenant_id: str = "default",
        category: str | None = None,
        scope: MemoryScope | None = None,
        min_importance: float | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[UnifiedMemory]:
        """
        List memories for a user with optional filters.

        Args:
            user_id:        Target user.
            tenant_id:      Tenant for hard isolation.
            category:       Filter by category label (e.g. 'crisis', 'fact').
            scope:          Filter by memory scope (session / arc / trait / fact).
            min_importance: Only return memories with importance ≥ this value.
            limit:          Maximum number of results.
            offset:         Number of documents to skip (for pagination).
        """
        query: dict[str, Any] = {"userId": user_id, "tenantId": tenant_id}
        if category:
            query["category"] = category
        if scope is not None:
            query["scope"] = scope.value
        if min_importance is not None:
            query["importance"] = {"$gte": min_importance}

        cursor = self._collection().find(query).sort("createdAt", -1).skip(offset).limit(limit)

        results = []
        for doc in cursor:
            try:
                results.append(UnifiedMemory.from_mongo_doc(doc))
            except Exception as e:
                logger.warning(f"Skipping malformed memory doc {doc.get('_id')}: {e}")

        return results

    def list_stale_memories(
        self,
        tenant_id: str | None = None,
        max_importance: float = 0.2,
        limit: int = 500,
    ) -> list[UnifiedMemory]:
        """
        Return memories flagged as stale or below an importance threshold.

        Intended for the decay scheduler — call periodically to find candidates
        for eviction, ghost-node compression, or manual review.

        Args:
            tenant_id:      Restrict scan to a single tenant (None = all tenants).
            max_importance: Upper bound on importance; only memories at or below
                            this value are returned.
            limit:          Cap results to avoid cursor timeout on large collections.
        """
        query: dict[str, Any] = {
            "$or": [
                {"strengthTrend": StrengthTrend.STALE.value},
                {"importance": {"$lte": max_importance}},
            ]
        }
        if tenant_id:
            query["tenantId"] = tenant_id

        cursor = (
            self._collection()
            .find(query)
            .sort("importance", 1)  # lowest importance first
            .limit(limit)
        )

        results = []
        for doc in cursor:
            try:
                results.append(UnifiedMemory.from_mongo_doc(doc))
            except Exception as e:
                logger.warning(f"Skipping malformed stale doc {doc.get('_id')}: {e}")

        return results

    # -------------------------------------------------------------------------
    # Migration: convert legacy ai-services documents to unified format
    # -------------------------------------------------------------------------

    def migrate_analysis_results(
        self,
        limit: int = 1000,
        dry_run: bool = True,
    ) -> dict[str, int]:
        """
        One-time migration: read legacy ``analysis_results`` collection and
        write equivalent UnifiedMemory documents to ``unified_memories``.

        Args:
            limit:   Max documents to migrate per call.
            dry_run: If True, only count/preview — no writes are performed.
                     A summary of what *would* be migrated is still logged.

        Returns:
            {'migrated': N, 'skipped': N, 'errors': N}
        """
        legacy_col = self.db.get_collection("analysis_results")
        stats: dict[str, int] = {"migrated": 0, "skipped": 0, "errors": 0}

        cursor = legacy_col.find({}).limit(limit)

        for doc in cursor:
            # Skip already-migrated docs
            existing = self._collection().find_one({"_id": str(doc.get("_id", ""))})
            if existing:
                stats["skipped"] += 1
                continue

            try:
                # Decrypt if needed
                data = doc.get("data", {})
                if isinstance(data, dict) and data.get("_encrypted"):
                    data = self.db._decrypt_phi(data)

                content = data.get("content") or data.get("text") or data.get("response") or str(data)[:500]

                analysis_type = doc.get("type", "general")
                category_map = {
                    "therapy_session": "conversation",
                    "crisis_detection": "crisis",
                    "mental_health": "fact",
                }
                category = category_map.get(analysis_type, "general")

                memory = UnifiedMemory.create(
                    content=content,
                    user_id=str(doc.get("user_id", "unknown")),
                    tenant_id="default",
                    bank_id=str(doc.get("session_id", "default")),
                    scope=MemoryScope.ARC,
                    retention=RetentionPolicy.LONG_TERM,
                    category=category,
                    source_service=SourceService.AI_SERVICES,
                )

                if not dry_run:
                    self.save_memory(memory, session_id=str(doc.get("session_id")))

                stats["migrated"] += 1

            except Exception as e:
                logger.error(f"Migration error for doc {doc.get('_id')}: {e}")
                stats["errors"] += 1

        action = "Would migrate" if dry_run else "Migrated"
        logger.info(
            f"{action} {stats['migrated']} docs, "
            f"skipped {stats['skipped']}, "
            f"errors {stats['errors']}" + (" [DRY RUN — no writes performed]" if dry_run else "")
        )
        return stats


def get_adapter(db_service: DatabaseService) -> UnifiedMemoryAdapter:
    """Convenience factory for the memory adapter."""
    return UnifiedMemoryAdapter(db_service)
