#!/usr/bin/env python3
"""
Unified migration script for OpenMemory and ByteRover MCP to ByteRover CLI.

This script can migrate memories from:
- OpenMemory (hosted or local)
- ByteRover MCP (2.0)
- Multiple sources in one run
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Import the individual migration modules
import migrate_openmemory_to_byterover as om_migrate
import migrate_byterover_mcp_to_cli as br_mcp_migrate


def migrate_openmemory(
    source_type: str,
    api_key: Optional[str] = None,
    url: Optional[str] = None,
    dry_run: bool = False
) -> List[Dict[str, Any]]:
    """Migrate memories from OpenMemory."""
    print(f"\n{'='*60}")
    print(f"🔄 Migrating from OpenMemory ({source_type})")
    print(f"{'='*60}")

    if source_type == "openmemory-hosted":
        if not api_key:
            api_key = os.getenv("OPENMEMORY_API_KEY")
        if not api_key:
            print("❌ API key required for hosted OpenMemory")
            return []
        if not url:
            url = "https://api.openmemory.dev"
        memories = om_migrate.extract_from_openmemory_hosted(api_key, url)
    else:
        if not url:
            url = "http://localhost:8765"
        memories = om_migrate.extract_from_openmemory_local(url)

    if not memories:
        return []

    # Convert to ByteRover format
    converted = [om_migrate.convert_to_byterover_format(m) for m in memories]

    if not dry_run:
        stats = om_migrate.import_to_byterover(memories, dry_run=False)
        print(f"✓ OpenMemory migration: {stats['success']}/{stats['total']} successful")

    return converted


def migrate_byterover_mcp(
    mcp_url: Optional[str] = None,
    machine_id: Optional[str] = None,
    import_file: Optional[str] = None,
    dry_run: bool = False
) -> List[Dict[str, Any]]:
    """Migrate memories from ByteRover MCP."""
    print(f"\n{'='*60}")
    print("🔄 Migrating from ByteRover MCP")
    print(f"{'='*60}")

    if import_file:
        memories = br_mcp_migrate.import_from_file(import_file)
    elif mcp_url:
        memories = br_mcp_migrate.extract_from_byterover_mcp(mcp_url, machine_id)
    else:
        # Try to load from MCP config
        mcp_config_path = Path.home() / ".cursor" / "mcp.json"
        if mcp_config_path.exists():
            try:
                with open(mcp_config_path, "r") as f:
                    mcp_config = json.load(f)
                    byterover_mcp = mcp_config.get("mcpServers", {}).get("byterover-mcp", {})
                    mcp_url = byterover_mcp.get("url", "")
                    if mcp_url and "machineId=" in mcp_url:
                        machine_id = mcp_url.split("machineId=")[1].split("&")[0]
                    if mcp_url:
                        memories = br_mcp_migrate.extract_from_byterover_mcp(mcp_url, machine_id)
                    else:
                        print("❌ ByteRover MCP URL not found in config")
                        return []
            except Exception as e:
                print(f"❌ Error reading MCP config: {e}")
                return []
        else:
            print("❌ No MCP URL or import file provided")
            return []

    if not memories:
        return []

    # Convert to ByteRover format
    converted = [br_mcp_migrate.convert_to_byterover_format(m) for m in memories]

    if not dry_run:
        stats = br_mcp_migrate.import_to_byterover(memories, dry_run=False)
        print(f"✓ ByteRover MCP migration: {stats['success']}/{stats['total']} successful")

    return converted


def export_combined_memories(memories: List[Dict[str, Any]], output_file: str):
    """Export combined memories to JSON file."""
    print(f"\n📤 Exporting {len(memories)} memories to {output_file}...")

    with open(output_file, "w") as f:
        json.dump(memories, f, indent=2, default=str)

    print(f"✓ Exported to {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Unified migration tool for OpenMemory and ByteRover MCP to ByteRover CLI"
    )

    # Source selection
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=["openmemory-hosted", "openmemory-local", "byterover-mcp", "all"],
        default=["all"],
        help="Sources to migrate from (default: all)"
    )

    # OpenMemory options
    parser.add_argument(
        "--openmemory-api-key",
        help="OpenMemory API key (for hosted)"
    )
    parser.add_argument(
        "--openmemory-url",
        help="OpenMemory URL (default: https://api.openmemory.dev for hosted, http://localhost:8765 for local)"
    )

    # ByteRover MCP options
    parser.add_argument(
        "--byterover-mcp-url",
        help="ByteRover MCP URL"
    )
    parser.add_argument(
        "--byterover-mcp-file",
        help="Import ByteRover MCP memories from JSON file"
    )

    # General options
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview migration without importing"
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Export memories to JSON file without importing"
    )
    parser.add_argument(
        "--output",
        help="Output file for export (default: all_memories_export.json)"
    )
    parser.add_argument(
        "--combine",
        action="store_true",
        help="Combine memories from all sources before importing"
    )

    args = parser.parse_args()

    # Determine sources
    if "all" in args.sources:
        sources = ["openmemory-hosted", "openmemory-local", "byterover-mcp"]
    else:
        sources = args.sources

    all_memories = []
    source_stats = {}

    # Migrate from each source
    for source in sources:
        try:
            if source == "openmemory-hosted":
                memories = migrate_openmemory(
                    "openmemory-hosted",
                    api_key=args.openmemory_api_key,
                    url=args.openmemory_url,
                    dry_run=args.dry_run
                )
                source_stats["openmemory-hosted"] = len(memories)
                if args.combine:
                    all_memories.extend(memories)
                else:
                    all_memories.extend(memories)

            elif source == "openmemory-local":
                memories = migrate_openmemory(
                    "openmemory-local",
                    url=args.openmemory_url,
                    dry_run=args.dry_run
                )
                source_stats["openmemory-local"] = len(memories)
                if args.combine:
                    all_memories.extend(memories)
                else:
                    all_memories.extend(memories)

            elif source == "byterover-mcp":
                memories = migrate_byterover_mcp(
                    mcp_url=args.byterover_mcp_url,
                    import_file=args.byterover_mcp_file,
                    dry_run=args.dry_run
                )
                source_stats["byterover-mcp"] = len(memories)
                if args.combine:
                    all_memories.extend(memories)
                else:
                    all_memories.extend(memories)

        except Exception as e:
            print(f"❌ Error migrating from {source}: {e}")
            continue

    if not all_memories:
        print("\n❌ No memories found to migrate")
        sys.exit(1)

    # Export if requested
    if args.export_only or args.output:
        output_file = args.output or "all_memories_export.json"
        export_combined_memories(all_memories, output_file)
        return

    # Print summary
    print(f"\n{'='*60}")
    print("📊 Migration Summary")
    print(f"{'='*60}")
    for source, count in source_stats.items():
        print(f"  {source}: {count} memories")
    print(f"  Total: {len(all_memories)} memories")

    if args.dry_run:
        print(f"\n🔍 DRY RUN: No memories were imported")
    else:
        print(f"\n✓ Migration complete! Run 'brv push' to sync to ByteRover Cloud")


if __name__ == "__main__":
    main()

