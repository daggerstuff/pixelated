#!/usr/bin/env python3
"""Optimized Memory Synchronization Tool for Mem0 and OpenMemory"""

import asyncio
import json
import logging
import re
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import hashlib
import httpx
import os

MEM0_API_KEY = os.getenv("MEM0_API_KEY")
OPENMEMORY_API_KEY = os.getenv("OPENMEMORY_API_KEY")
MEM0_BASE_URL = "https://api.mem0.ai/v1"
OPENMEMORY_BASE_URL = os.getenv("OPENMEMORY_BASE_URL", "http://localhost:8000")
# Validate URL format to prevent SSRF
from urllib.parse import urlparse

try:
    parsed = urlparse(OPENMEMORY_BASE_URL)
    if parsed.scheme not in ["http", "https"]:
        raise ValueError("Invalid URL scheme")
except Exception:
    raise ValueError(f"Invalid OPENMEMORY_BASE_URL: {OPENMEMORY_BASE_URL}")

# Rate limiting
RATE_LIMIT_BATCH_SIZE = 10
RATE_LIMIT_DELAY = 0.5
MAX_RETRIES = 3
TIMEOUT = 30

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


@dataclass
class MemoryRecord:
    """Unified memory record structure"""

    id: Optional[str] = None
    content: str = ""
    metadata: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    source: str = "unknown"

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        self.content_hash = self._generate_hash()

    def _generate_hash(self) -> str:
        """Generate content hash for deduplication"""
        content_str = f"{self.content}{json.dumps(self.metadata, sort_keys=True)}"
        return hashlib.sha256(content_str.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BaseMemoryService:
    """Base class for memory services"""

    def __init__(self, api_key: str, base_url: str, service_name: str):
        self.api_key = api_key
        self.base_url = base_url
        self.service_name = service_name
        self.client = None

    @asynccontextmanager
    async def get_client(self):
        """Async context manager for HTTP client"""
        if not self.client:
            self.client = httpx.AsyncClient(
                timeout=httpx.Timeout(TIMEOUT), headers=self._get_headers()
            )
        try:
            yield self.client
        finally:
            pass  # Keep client alive for reuse

    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None

    def _get_headers(self) -> Dict[str, str]:
        """Get service-specific headers"""
        return {"Authorization": f"Bearer {self.api_key}"}

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with retry logic"""
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"

        for attempt in range(MAX_RETRIES):
            try:
                async with self.get_client() as client:
                    response = await client.request(method, url, **kwargs)
                    response.raise_for_status()
                    return response.json() if response.content else {}
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    logger.error(f"{self.service_name} request failed: {e}")
                    raise
                await asyncio.sleep(2**attempt)

        return {}

    async def add_memory(self, memory: MemoryRecord) -> bool:
        """Add memory - to be implemented by subclasses"""
        raise NotImplementedError

    async def delete_all_memories(self) -> bool:
        """Delete all memories - to be implemented by subclasses"""
        raise NotImplementedError


class Mem0Service(BaseMemoryService):
    """Mem0 API service with v2 endpoints"""

    def __init__(self, api_key: str):
        super().__init__(api_key, MEM0_BASE_URL, "Mem0")

    async def get_all_memories(self, user_id: str = "default") -> List[MemoryRecord]:
        """Get all memories using v2 API"""
        try:
            data = await self._make_request(
                "POST", "v2/memories/", json={"user_id": user_id, "limit": 1000}
            )

            memories = [
                MemoryRecord(
                    id=item.get("id"),
                    content=item.get("memory", ""),
                    metadata=item.get("metadata", {}),
                    user_id=item.get("user_id"),
                    created_at=item.get("created_at"),
                    updated_at=item.get("updated_at"),
                    source="mem0",
                )
                for item in data.get("memories", [])
            ]

            logger.info(f"Retrieved {len(memories)} memories from Mem0")
            return memories

        except Exception as e:
            logger.error(f"Failed to get Mem0 memories: {e}")
            return []

    async def add_memory(self, memory: MemoryRecord) -> bool:
        """Add memory to Mem0"""
        try:
            await self._make_request(
                "POST",
                "memories/",
                json={
                    "messages": [{"role": "user", "content": memory.content}],
                    "user_id": memory.user_id or "default",
                    "metadata": memory.metadata,
                },
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add memory to Mem0: {e}")
            return False

    async def search_memories(
        self, query: str, user_id: str = "default", limit: int = 10
    ) -> List[MemoryRecord]:
        """Search memories using v2 API"""
        try:
            data = await self._make_request(
                "POST",
                "v2/memories/search/",
                json={"query": query, "user_id": user_id, "limit": limit},
            )

            return [
                MemoryRecord(
                    id=item.get("id"),
                    content=item.get("memory", ""),
                    metadata=item.get("metadata", {}),
                    user_id=item.get("user_id"),
                    source="mem0",
                )
                for item in data.get("memories", [])
            ]
        except Exception as e:
            logger.error(f"Failed to search Mem0 memories: {e}")
            return []

    async def delete_all_memories(self, user_id: str = "default") -> bool:
        """Delete all memories for a user"""
        try:
            await self._make_request("DELETE", "memories/", json={"user_id": user_id})
            return True
        except Exception as e:
            logger.error(f"Failed to delete Mem0 memories: {e}")
            return False


class OpenMemoryService(BaseMemoryService):
    """OpenMemory MCP service"""

    def __init__(self, api_key: str):
        super().__init__(api_key, OPENMEMORY_BASE_URL, "OpenMemory")

    def _get_headers(self) -> Dict[str, str]:
        """OpenMemory uses different auth header"""
        return {"X-API-Key": self.api_key} if self.api_key else {}

    async def get_all_memories(self) -> List[MemoryRecord]:
        """Get all memories from OpenMemory with response validation"""
        try:
            data = await self._make_request("GET", "memories")

            # Validate the response structure
            if not self._validate_api_response(data):
                logger.error("OpenMemory API returned invalid response format")
                return []

            memories = []
            invalid_count = 0

            for item in data.get("memories", []):
                # Validate each memory item
                if not isinstance(item, dict):
                    invalid_count += 1
                    continue

                content = item.get("content", "")

                # Skip if content appears to be HTML or invalid
                if self._is_invalid_content(str(content)):
                    invalid_count += 1
                    logger.warning(f"Skipping invalid memory content: {str(content)[:50]}...")
                    continue

                memory = MemoryRecord(
                    id=item.get("id"),
                    content=content,
                    metadata=item.get("metadata", {}),
                    created_at=item.get("created_at"),
                    source="openmemory",
                )
                memories.append(memory)

            if invalid_count > 0:
                logger.warning(
                    f"Filtered out {invalid_count} invalid memories from OpenMemory response"
                )

            logger.info(f"Retrieved {len(memories)} valid memories from OpenMemory")
            return memories

        except Exception as e:
            logger.error(f"Failed to get OpenMemory memories: {e}")
            return []

    def _validate_api_response(self, data: Any) -> bool:
        """Validate that API response has expected structure"""
        if not isinstance(data, dict):
            return False

        # Convert to string to check for HTML content
        data_str = str(data)

        # Check if response contains HTML
        html_indicators = [
            "<!DOCTYPE html>",
            "<html",
            "<head>",
            "<body>",
            "<script>",
            "adblockkey",
            "window.park",
        ]

        for indicator in html_indicators:
            if indicator.lower() in data_str.lower():
                logger.warning(f"API response contains HTML indicator: {indicator}")
                return False

        return True

    def _is_invalid_content(self, content: str) -> bool:
        """Check if content appears to be invalid (HTML, ads, errors)"""
        if not content or len(content.strip()) < 5:
            return True

        content_lower = content.lower()

        # Check for HTML content
        html_patterns = [
            "<!doctype",
            "<html",
            "<head>",
            "<body>",
            "<script",
            "<div",
        ]

        for pattern in html_patterns:
            if pattern in content_lower:
                return True

        # Check for ad-block and parking page content
        invalid_patterns = [
            "adblockkey",
            "window.park",
            "data-adblockkey",
            "park-domain",
            "parked domain",
            "/bVNwubFKv.js",
            "404 not found",
            "500 internal server error",
            "access denied",
            "forbidden request",
            "lorem ipsum",
            "placeholder content",
        ]

        return any(pattern in content_lower for pattern in invalid_patterns)

    async def add_memory(self, memory: MemoryRecord) -> bool:
        """Add memory to OpenMemory"""
        try:
            await self._make_request(
                "POST", "memories", json={"content": memory.content, "metadata": memory.metadata}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add memory to OpenMemory: {e}")
            return False

    async def search_memories(self, query: str, limit: int = 10) -> List[MemoryRecord]:
        """Search memories in OpenMemory"""
        try:
            data = await self._make_request(
                "POST", "memories/search", json={"query": query, "limit": limit}
            )

            return [
                MemoryRecord(
                    id=item.get("id"),
                    content=item.get("content", ""),
                    metadata=item.get("metadata", {}),
                    source="openmemory",
                )
                for item in data.get("memories", [])
            ]
        except Exception as e:
            logger.error(f"Failed to search OpenMemory memories: {e}")
            return []

    async def delete_all_memories(self) -> bool:
        """Delete all memories from OpenMemory"""
        try:
            await self._make_request("DELETE", "memories")
            return True
        except Exception as e:
            logger.error(f"Failed to delete OpenMemory memories: {e}")
            return False


class MemorySyncManager:
    """Manages bidirectional synchronization between memory services"""

    def __init__(self):
        if not MEM0_API_KEY:
            raise ValueError("MEM0_API_KEY environment variable required")

        self.mem0_service = Mem0Service(MEM0_API_KEY)
        self.openmemory_service = OpenMemoryService(OPENMEMORY_API_KEY or "")
        self.backup_dir = Path("memory_backups")
        self.backup_dir.mkdir(exist_ok=True)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.mem0_service.close()
        await self.openmemory_service.close()

    def deduplicate_memories(self, memories: List[MemoryRecord]) -> List[MemoryRecord]:
        """Remove duplicate memories based on content hash"""
        seen_hashes: Set[str] = set()
        unique_memories = []

        for memory in memories:
            if memory.content_hash not in seen_hashes:
                seen_hashes.add(memory.content_hash)
                unique_memories.append(memory)
            else:
                logger.debug(f"Skipping duplicate: {memory.content[:50]}...")

        logger.info(f"Deduplicated {len(memories)} -> {len(unique_memories)} memories")
        return unique_memories

    def _validate_memory_content(self, memory: MemoryRecord) -> bool:
        """Validate memory content for integrity and authenticity"""
        content = str(memory.content).strip()

        # Check minimum content length
        if len(content) < 10:
            logger.warning(f"Memory content too short: {len(content)} characters")
            return False

        # Patterns that indicate invalid content (error pages, placeholders, ads)
        invalid_patterns = [
            # Ad-block detection and parking pages
            r"adblockkey",
            r"window\.park\s*=",
            r"data-adblockkey",
            r"park\-domain",
            r"parked.*domain",
            r"/bVNwubFKv\.js",  # Specific pattern from corrupted backup
            # HTML content indicators
            r"<!DOCTYPE\s+html",
            r"<html[^>]*>",
            r"<head[^>]*>",
            r"<body[^>]*>",
            r"<script[^>]*>",
            r"<div[^>]*>",
            # Error page content
            r"404.*not.*found",
            r"500.*internal.*server.*error",
            r"503.*service.*unavailable",
            r"access.*denied",
            r"forbidden.*request",
            r"unauthorized.*access",
            # Parking/placeholder page content
            r"domain.*parked",
            r"page.*under.*construction",
            r"temporarily.*unavailable",
            r"lorem\s+ipsum",
            r"placeholder.*content",
            r"test.*data",
            # Empty or minimal responses
            r"^\s*$",
            r"^null$",
            r"^undefined$",
        ]

        # Check for invalid patterns
        content_lower = content.lower()
        if any(re.search(pattern, content_lower, re.IGNORECASE) for pattern in invalid_patterns):
            logger.warning(f"Memory contains invalid patterns: {content[:100]}...")
            return False

        # Check if content appears to be HTML
        html_indicators = [
            r"<!DOCTYPE",
            r"<html",
            r"<head>",
            r"<body>",
            r"<script",
            r"<div",
        ]

        for indicator in html_indicators:
            if re.search(indicator, content_lower, re.IGNORECASE):
                logger.warning(f"Memory appears to contain HTML content: {content[:100]}...")
                return False

        return True

    def save_backup(self, memories: List[MemoryRecord], filename: str) -> Path:
        """Save memories to backup file with content validation"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self.backup_dir / f"{filename}_{timestamp}.json"

        # Validate and filter memories before saving
        valid_memories = []
        invalid_count = 0

        for memory in memories:
            if self._validate_memory_content(memory):
                valid_memories.append(memory)
            else:
                invalid_count += 1
                logger.warning(f"Skipping invalid memory: {memory.content[:50]}...")

        if invalid_count > 0:
            logger.warning(f"Filtered out {invalid_count} invalid memories from backup")

        if not valid_memories:
            logger.error("No valid memories to save - all memories failed validation")
            raise ValueError("No valid memories to backup")

        # Save only valid memories
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(
                [memory.to_dict() for memory in valid_memories], f, indent=2, ensure_ascii=False
            )

        logger.info(
            f"Backup saved: {backup_path} ({len(valid_memories)} valid memories, {invalid_count} filtered)"
        )
        return backup_path

    async def export_all_memories(self, user_id: str = "default") -> List[MemoryRecord]:
        """Export memories from both services concurrently"""
        logger.info("🔄 Exporting memories from both services...")

        # Export from both services concurrently
        results = await asyncio.gather(
            self.mem0_service.get_all_memories(user_id),
            self.openmemory_service.get_all_memories(),
            return_exceptions=True,
        )

        # Handle results
        mem0_memories = results[0] if isinstance(results[0], list) else []
        openmemory_memories = results[1] if isinstance(results[1], list) else []

        if isinstance(results[0], Exception):
            logger.error(f"❌ Mem0 export failed: {results[0]}")
        if isinstance(results[1], Exception):
            logger.error(f"❌ OpenMemory export failed: {results[1]}")

        # Combine and deduplicate
        all_memories = mem0_memories + openmemory_memories
        unique_memories = self.deduplicate_memories(all_memories)

        # Save backup
        backup_path = self.save_backup(unique_memories, "export")

        logger.info(f"✅ Export complete: {len(unique_memories)} unique memories")
        logger.info(f"   📊 Mem0: {len(mem0_memories)} | OpenMemory: {len(openmemory_memories)}")
        logger.info(f"   💾 Backup: {backup_path}")

        return unique_memories

    async def sync_to_service(
        self,
        memories: List[MemoryRecord],
        service: BaseMemoryService,
        clear_first: bool = True,
        user_id: str = "default",
    ) -> int:
        """Sync memories to service with batching and rate limiting"""
        service_name = service.service_name
        logger.info(f"🔄 Syncing {len(memories)} memories to {service_name}...")

        if clear_first:
            logger.info(f"🗑️  Clearing existing memories from {service_name}...")
            if isinstance(service, Mem0Service):
                await service.delete_all_memories(user_id)
            else:
                await service.delete_all_memories()

        # Process in batches with rate limiting
        success_count = 0
        total_batches = (len(memories) + RATE_LIMIT_BATCH_SIZE - 1) // RATE_LIMIT_BATCH_SIZE

        for i in range(0, len(memories), RATE_LIMIT_BATCH_SIZE):
            batch = memories[i : i + RATE_LIMIT_BATCH_SIZE]
            current_batch = (i // RATE_LIMIT_BATCH_SIZE) + 1

            logger.info(f"📦 Batch {current_batch}/{total_batches} ({len(batch)} memories)")

            # Process batch concurrently
            tasks = [service.add_memory(memory) for memory in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            batch_success = len([r for r in results if r is True])
            success_count += batch_success

            if batch_success < len(batch):
                failed = len(batch) - batch_success
                logger.warning(f"⚠️  {failed} memories failed in batch {current_batch}")

            # Rate limiting
            if current_batch < total_batches:
                await asyncio.sleep(RATE_LIMIT_DELAY)

            progress = min(i + RATE_LIMIT_BATCH_SIZE, len(memories))
            logger.info(
                f"📈 Progress: {progress}/{len(memories)} ({progress/len(memories)*100:.1f}%)"
            )

        logger.info(f"✅ Sync complete: {success_count}/{len(memories)} to {service_name}")
        return success_count

    async def full_bidirectional_sync(self, user_id: str = "default") -> Dict[str, int]:
        """Perform complete bidirectional synchronization"""
        logger.info("🚀 === Starting Full Bidirectional Memory Sync ===")

        try:
            # Export all memories
            all_memories = await self.export_all_memories(user_id)

            if not all_memories:
                logger.warning("⚠️  No memories found to sync")
                return {"mem0": 0, "openmemory": 0}

            # Sync to both services concurrently
            results = await asyncio.gather(
                self.sync_to_service(
                    all_memories, self.mem0_service, clear_first=True, user_id=user_id
                ),
                self.sync_to_service(all_memories, self.openmemory_service, clear_first=True),
                return_exceptions=True,
            )

            mem0_count = results[0] if isinstance(results[0], int) else 0
            openmemory_count = results[1] if isinstance(results[1], int) else 0

            logger.info("🎉 === Bidirectional Sync Complete ===")
            logger.info(f"📊 Results: Mem0={mem0_count}, OpenMemory={openmemory_count}")

            return {"mem0": mem0_count, "openmemory": openmemory_count}

        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            raise

    async def smart_sync(self, user_id: str = "default") -> Dict[str, Any]:
        """Intelligent sync that only transfers missing memories"""
        logger.info("🧠 Starting smart sync (differential)...")

        # Get memories from both services
        mem0_memories = await self.mem0_service.get_all_memories(user_id)
        openmemory_memories = await self.openmemory_service.get_all_memories()

        # Create hash sets for comparison
        mem0_hashes = {m.content_hash for m in mem0_memories}
        openmemory_hashes = {m.content_hash for m in openmemory_memories}

        # Find missing memories
        missing_in_mem0 = [m for m in openmemory_memories if m.content_hash not in mem0_hashes]
        missing_in_openmemory = [
            m for m in mem0_memories if m.content_hash not in openmemory_hashes
        ]

        logger.info(
            f"📊 Missing: Mem0={len(missing_in_mem0)}, OpenMemory={len(missing_in_openmemory)}"
        )

        # Sync missing memories
        results = await asyncio.gather(
            self.sync_to_service(
                missing_in_mem0, self.mem0_service, clear_first=False, user_id=user_id
            ),
            self.sync_to_service(missing_in_openmemory, self.openmemory_service, clear_first=False),
            return_exceptions=True,
        )

        mem0_added = results[0] if isinstance(results[0], int) else 0
        openmemory_added = results[1] if isinstance(results[1], int) else 0

        return {
            "mem0_added": mem0_added,
            "openmemory_added": openmemory_added,
            "total_mem0": len(mem0_memories) + mem0_added,
            "total_openmemory": len(openmemory_memories) + openmemory_added,
        }


class MemorySyncCLI:
    """Command-line interface for memory synchronization"""

    def __init__(self):
        self.manager = None

    async def get_manager(self) -> MemorySyncManager:
        """Get or create manager instance"""
        if not self.manager:
            self.manager = MemorySyncManager()
        return self.manager

    async def handle_discover(self, user_id: str = "default"):
        """Discover and display memory statistics"""
        logger.info("🔍 Discovering memories across services...")

        async with await self.get_manager() as manager:
            mem0_memories = await manager.mem0_service.get_all_memories(user_id)
            openmemory_memories = await manager.openmemory_service.get_all_memories()

            logger.info("📊 Memory Statistics:")
            logger.info("   🔹 Mem0: {len(mem0_memories)} memories")
            logger.info("   🔹 OpenMemory: {len(openmemory_memories)} memories")

            # Show sample memories
            if mem0_memories:
                logger.info("\n📝 Sample Mem0 memories:")
                for i, memory in enumerate(mem0_memories[:3]):
                    logger.info(f"   {i+1}. {memory.content[:60]}...")

            if openmemory_memories:
                logger.info("\n📝 Sample OpenMemory memories:")
                for i, memory in enumerate(openmemory_memories[:3]):
                    logger.info(f"   {i+1}. {memory.content[:60]}...")

    async def handle_import(
        self, backup_file: str, target_service: str = "both", user_id: str = "default"
    ):
        """Import memories from backup file"""
        if not backup_file or not Path(backup_file).exists():
            logger.error(f"❌ Backup file not found: {backup_file}")
            return

        logger.info(f"📥 Importing memories from {backup_file}...")

        try:
            with open(backup_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            memories = [MemoryRecord(**item) for item in data]
            logger.info(f"📦 Loaded {len(memories)} memories from backup")

            async with await self.get_manager() as manager:
                if target_service in {"mem0", "both"}:
                    count = await manager.sync_to_service(
                        memories, manager.mem0_service, clear_first=False, user_id=user_id
                    )
                    logger.info(f"✅ Imported {count} memories to Mem0")

                if target_service in {"openmemory", "both"}:
                    count = await manager.sync_to_service(
                        memories, manager.openmemory_service, clear_first=False
                    )
                    logger.info(f"✅ Imported {count} memories to OpenMemory")

        except Exception as e:
            logger.error(f"❌ Import failed: {e}")

    async def handle_search(self, query: str, service: str = "both", user_id: str = "default"):
        """Search memories across services"""
        logger.info(f"🔍 Searching for: '{query}'")

        async with await self.get_manager() as manager:
            if service in {"mem0", "both"}:
                mem0_results = await manager.mem0_service.search_memories(query, user_id)
                logger.info(f"\n🔹 Mem0 Results ({len(mem0_results)}):")
                for i, memory in enumerate(mem0_results):
                    logger.info(f"   {i+1}. {memory.content}")

            if service in {"openmemory", "both"}:
                om_results = await manager.openmemory_service.search_memories(query)
                logger.info(f"\n🔹 OpenMemory Results ({len(om_results)}):")
                for i, memory in enumerate(om_results):
                    logger.info(f"   {i+1}. {memory.content}")

    async def handle_export(self, user_id: str = "default"):
        """Export all memories to backup"""
        async with await self.get_manager() as manager:
            memories = await manager.export_all_memories(user_id)
            logger.info(f"✅ Exported {len(memories)} unique memories")

    async def handle_sync_full(self, user_id: str = "default"):
        """Perform full bidirectional sync"""
        async with await self.get_manager() as manager:
            results = await manager.full_bidirectional_sync(user_id)
            logger.info(f"🎉 Full sync complete: {results}")

    async def handle_sync_smart(self, user_id: str = "default"):
        """Perform smart differential sync"""
        async with await self.get_manager() as manager:
            results = await manager.smart_sync(user_id)
            logger.info(f"🧠 Smart sync complete: {results}")

    async def cleanup(self):
        """Cleanup resources"""
        if self.manager:
            await self.manager.__aexit__(None, None, None)


async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="🔄 Advanced Memory Synchronization Tool for Mem0 and OpenMemory",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --discover                    # Show memory statistics
  %(prog)s --sync-full                   # Full bidirectional sync
  %(prog)s --sync-smart                  # Smart differential sync
  %(prog)s --export                      # Export all memories
  %(prog)s --search "python code"        # Search across services
  %(prog)s --import backup.json          # Import from backup
        """,
    )

    # Main actions
    parser.add_argument(
        "--discover", action="store_true", help="Discover and show memory statistics"
    )
    parser.add_argument(
        "--sync-full", action="store_true", help="Perform full bidirectional sync (destructive)"
    )
    parser.add_argument(
        "--sync-smart", action="store_true", help="Perform smart differential sync (recommended)"
    )
    parser.add_argument("--export", action="store_true", help="Export all memories to backup")
    parser.add_argument("--import", dest="import_file", help="Import memories from backup file")
    parser.add_argument("--search", help="Search memories across services")

    # Options
    parser.add_argument(
        "--user-id", default="default", help="User ID for Mem0 operations (default: 'default')"
    )
    parser.add_argument(
        "--service",
        choices=["mem0", "openmemory", "both"],
        default="both",
        help="Target service for operations",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Validate environment
    if not MEM0_API_KEY:
        logger.error("❌ MEM0_API_KEY environment variable required")
        sys.exit(1)

    cli = MemorySyncCLI()

    try:
        if args.discover:
            await cli.handle_discover(args.user_id)
        elif args.sync_full:
            await cli.handle_sync_full(args.user_id)
        elif args.sync_smart:
            await cli.handle_sync_smart(args.user_id)
        elif args.export:
            await cli.handle_export(args.user_id)
        elif args.import_file:
            await cli.handle_import(args.import_file, args.service, args.user_id)
        elif args.search:
            await cli.handle_search(args.search, args.service, args.user_id)
        else:
            # Default: show help and basic stats
            parser.print_help()
            print("\n" + "=" * 50)
            await cli.handle_discover(args.user_id)

    except KeyboardInterrupt:
        logger.info("\n⏹️  Operation interrupted by user")
    except Exception as e:
        logger.error(f"❌ Operation failed: {e}")
        if args.verbose:
            import traceback

            traceback.print_exc()
        sys.exit(1)
    finally:
        await cli.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
