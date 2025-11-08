#!/usr/bin/env python3
"""
Migrate memories from Mem0 Platform and OpenMemory to ByteRover CLI

Usage:
    # From Mem0 Platform
    python scripts/migrate_mem0_to_byterover.py --source mem0 --api-key YOUR_MEM0_API_KEY

    # From OpenMemory
    python scripts/migrate_mem0_to_byterover.py --source openmemory --api-key YOUR_KEY

    # Dry run
    python scripts/migrate_mem0_to_byterover.py --source mem0 --api-key KEY --dry-run
"""
# ruff: noqa: T201

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import requests


class Mem0Migrator:
    def __init__(
        self, source: str, api_key: str | None = None, url: str | None = None, dry_run: bool = False
    ):
        self.source = source
        self.api_key = api_key
        self.url = url or "http://localhost:8765"
        self.dry_run = dry_run
        self.mem0_base_url = "https://api.mem0.ai/v2"

    def fetch_mem0_memories(self, page: int = 1, page_size: int = 100) -> dict[str, Any]:
        """Fetch memories from Mem0 Platform API"""
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }

        # Use v2 endpoint with pagination in query params and filters in body
        # Based on official SDK: client.post("/v2/memories/", json=params, params=query_params)
        # Filters are required - use wildcard to match all
        payload = {"filters": {"user_id": "*"}}  # Wildcard to match all users
        query_params = {"page": page, "page_size": page_size}

        response = requests.post(
            f"{self.mem0_base_url}/memories/",
            headers=headers,
            json=payload,
            params=query_params,
        )
        response.raise_for_status()
        return response.json()

    def fetch_openmemory_items(self) -> list[dict[str, Any]]:
        """Fetch memories from OpenMemory"""
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        response = requests.get(f"{self.url}/memories", headers=headers)
        response.raise_for_status()
        return response.json()

    def categorize_memory(self, memory: dict[str, Any]) -> str:
        """Map Mem0 categories to ByteRover sections"""
        categories = memory.get("categories")
        if not categories or not isinstance(categories, list):
            return "Lessons Learned"

        # Map categories to sections
        category_map = {
            ("error", "bug"): "Common Errors",
            ("best", "practice"): "Best Practices",
            ("architecture", "design"): "Architecture",
            ("test",): "Testing",
            ("strategy", "approach"): "Strategies",
        }

        for cat in categories:
            cat_lower = cat.lower()
            for keywords, section in category_map.items():
                if any(keyword in cat_lower for keyword in keywords):
                    return section

        return "Lessons Learned"

    def export_all_memories(self) -> list[dict[str, Any]]:
        """Export all memories from source"""
        print(f"📥 Exporting memories from {self.source}...")
        all_memories = []

        if self.source == "mem0":
            page = 1
            while True:
                print(f"  Fetching page {page}...")
                data = self.fetch_mem0_memories(page=page)
                memories = data.get("results", [])

                if not memories:
                    break

                for mem in memories:
                    categories = mem.get("categories")
                    categories_list = (
                        categories if categories and isinstance(categories, list) else []
                    )

                    all_memories.append(
                        {
                            "content": mem["memory"],
                            "section": self.categorize_memory(mem),
                            "metadata": {
                                "originalId": mem["id"],
                                "source": "mem0",
                                "createdAt": mem.get("created_at"),
                                "updatedAt": mem.get("updated_at"),
                                "userId": mem.get("user_id"),
                                "agentId": mem.get("agent_id"),
                                "categories": categories_list,
                                "tags": ["migrated-from-mem0", *categories_list],
                            },
                        }
                    )

                # Check if there are more pages
                if len(memories) < 100:
                    break
                page += 1

        elif self.source in ["openmemory", "openmemory-local"]:
            items = self.fetch_openmemory_items()

            for item in items:
                all_memories.append(
                    {
                        "content": item.get("content", item.get("memory", "")),
                        "section": "Lessons Learned",
                        "metadata": {
                            "originalId": item.get("id"),
                            "source": "openmemory",
                            "timestamp": item.get("timestamp", item.get("created_at")),
                            "tags": ["migrated-from-openmemory"],
                        },
                    }
                )

        print(f"✅ Exported {len(all_memories)} memories")
        return all_memories

    def import_to_byterover(self, memories: list[dict[str, Any]]):
        """Import memories to ByteRover using brv CLI"""
        print(f"\n📤 Importing {len(memories)} memories to ByteRover...")

        if self.dry_run:
            print("\n🔍 DRY RUN - Preview of memories to import:\n")
            for idx, mem in enumerate(memories[:5], 1):
                content_preview = mem["content"][:100]
                print(f"{idx}. [{mem['section']}] {content_preview}...")
            print(f"\n... and {len(memories) - 5} more")
            return

        success_count = 0
        error_count = 0

        for mem in memories:
            try:
                # Escape quotes in content
                content = mem["content"].replace('"', '\\"')
                section = mem["section"]

                # Run brv add command
                cmd = ["brv", "add", "--section", section, "--content", content]
                subprocess.run(cmd, check=True, capture_output=True, text=True)

                success_count += 1
                if success_count % 10 == 0:
                    print(f"  Imported {success_count}/{len(memories)}...")

            except OSError as e:
                print(
                    f"  ❌ Error: Failed to execute 'brv' CLI. Is it installed and in your PATH? Details: {e}"
                )
                error_count += 1
            except subprocess.CalledProcessError as e:
                print(f"  ❌ Failed to import: {mem['content'][:50]}...")
                print(f"     Error: {e.stderr}")
                error_count += 1

        print("\n✅ Migration complete!")
        print(f"   Success: {success_count}")
        print(f"   Errors: {error_count}")

        # Save backup with timestamp to avoid overwriting previous backups
        from datetime import datetime

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = Path.cwd() / ".brv" / f"migration-backup_{timestamp}.json"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        with open(backup_path, "w") as f:
            json.dump(memories, f, indent=2)
        print(f"\n💾 Backup saved to: {backup_path}")

    def migrate(self):
        """Run the full migration"""
        try:
            memories = self.export_all_memories()
            self.import_to_byterover(memories)
        except requests.exceptions.HTTPError as e:
            print(f"❌ Migration failed: HTTP {e.response.status_code}", file=sys.stderr)
            print(f"Response: {e.response.text}", file=sys.stderr)
            print("\nTroubleshooting:")
            print("  1. Verify your API key is correct")
            print("  2. Check if you have access to the Mem0 API")
            print(
                f"  3. Try the check script first: python scripts/check-mem0-memories.py --source {self.source} --api-key YOUR_KEY"
            )
            sys.exit(1)
        except Exception as e:
            import traceback  # noqa: PLC0415

            print(f"❌ Migration failed: {e}", file=sys.stderr)
            traceback.print_exc()
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Migrate memories from Mem0/OpenMemory to ByteRover CLI"
    )
    parser.add_argument(
        "--source",
        required=True,
        choices=["mem0", "openmemory", "openmemory-local"],
        help="Source type",
    )
    parser.add_argument("--api-key", help="API key for Mem0 or OpenMemory")
    parser.add_argument(
        "--url",
        default="http://localhost:8765",
        help="Custom URL for local OpenMemory",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")

    args = parser.parse_args()

    if not args.api_key and args.source != "openmemory-local":
        print("❌ --api-key is required", file=sys.stderr)
        sys.exit(1)

    migrator = Mem0Migrator(
        source=args.source,
        api_key=args.api_key,
        url=args.url,
        dry_run=args.dry_run,
    )
    migrator.migrate()


if __name__ == "__main__":
    main()
