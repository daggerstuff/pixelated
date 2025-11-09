#!/usr/bin/env python3
"""
Migrate memories from ByteRover MCP (2.0) to ByteRover CLI (3.0).

This script extracts memories from the ByteRover MCP server and imports them
into the local ByteRover CLI playbook.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

def map_category_to_section(category: Optional[str], tags: Optional[List[str]] = None) -> str:
    """Map ByteRover MCP category/tags to ByteRover CLI section."""
    tags = tags if tags is not None else []
    category_lower = (category or "").lower()

    # Check tags first (more specific)
    tag_lower = " ".join(tags).lower()

    mapping = {
        "error": "Common Errors",
        "bug": "Common Errors",
        "best practice": "Best Practices",
        "best-practice": "Best Practices",
        "architecture": "Architecture",
        "design": "Architecture",
        "test": "Testing",
        "testing": "Testing",
        "strategy": "Strategies",
        "approach": "Strategies",
        "security": "Security",
        "performance": "Best Practices",
        "code style": "Code Style and Quality",
        "code-quality": "Code Style and Quality",
        "styling": "Styling and Design",
        "design": "Styling and Design",
    }

    # Check tags
    for key, section in mapping.items():
        if key in tag_lower:
            return section

    # Check category
    if category_lower:
        for key, section in mapping.items():
            if key in category_lower or category_lower in key:
                return section

    return "Lessons Learned"


def extract_from_byterover_mcp(mcp_url: str, machine_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Extract memories from ByteRover MCP server.

    ByteRover MCP uses the MCP protocol. This script attempts to retrieve
    memories by making requests to the MCP endpoint.
    """
    all_memories = []

    print(f"📥 Extracting memories from ByteRover MCP ({mcp_url})...")

    # Build MCP request
    # MCP uses JSON-RPC 2.0 format
    mcp_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "byterover-retrieve-knowledge",
            "arguments": {
                "query": "",  # Empty query to get all memories
                "limit": 1000
            }
        }
    }

    try:
        # Try to call MCP endpoint
        response = requests.post(
            mcp_url,
            json=mcp_request,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            # Handle MCP response format
            if "result" in data:
                result = data["result"]
                if isinstance(result, list):
                    all_memories = result
                elif isinstance(result, dict) and "contents" in result:
                    all_memories = result["contents"]
                elif isinstance(result, dict) and "results" in result:
                    all_memories = result["results"]

            print(f"📊 Total memories extracted: {len(all_memories)}")
        else:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to ByteRover MCP: {e}")
        print("\n💡 Alternative: Use the MCP tools directly from Cursor")
        print("   The ByteRover MCP server is configured in .cursor/mcp.json")
        print("   You can manually export memories using the MCP tools in Cursor")

    # If direct MCP call doesn't work, try alternative approach
    if not all_memories:
        print("\n⚠️  Direct MCP extraction failed. Trying alternative method...")
        print("   Using ByteRover MCP tool integration...")

        # This would require MCP client integration
        # For now, we'll provide instructions for manual extraction
        print("\n📋 Manual Extraction Instructions:")
        print("   1. Open Cursor with ByteRover MCP configured")
        print("   2. Use the MCP tools to retrieve memories:")
        print("      - byterover-retrieve-knowledge with empty query")
        print("   3. Export the results to a JSON file")
        print("   4. Use this script with --import-file option")

    return all_memories


def import_from_file(file_path: str) -> List[Dict[str, Any]]:
    """Import memories from a JSON file."""
    print(f"📥 Importing memories from {file_path}...")

    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Handle different formats
        if isinstance(data, list):
            memories = data
        elif isinstance(data, dict):
            memories = data.get("memories", data.get("results", data.get("contents", [])))
        else:
            memories = []

        print(f"📊 Total memories loaded: {len(memories)}")
        return memories

    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON file: {e}")
        return []


def convert_to_byterover_format(memory: Dict[str, Any]) -> Dict[str, Any]:
    """Convert ByteRover MCP memory format to ByteRover CLI format."""
    # Extract memory content - prefer content, but include title if it adds context
    content = (
        memory.get("content") or
        memory.get("memory") or
        memory.get("text") or
        memory.get("message") or
        str(memory.get("data", ""))
    )

    # If we have a title and it's not already in the content, prepend it
    title = memory.get("title", "")
    if title and title not in content and len(title) < 200:
        # Only prepend title if it's different from content start
        if not content.startswith(title[:50]):
            content = f"{title}\n\n{content}"

    # Extract tags and category
    tags = memory.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]

    category = memory.get("category") or memory.get("type")

    # Map to ByteRover section
    section = map_category_to_section(category, tags)

    # Extract metadata
    metadata = {
        "originalId": memory.get("id") or memory.get("bulletId"),
        "originalSource": "ByteRover MCP",
        "createdAt": memory.get("created_at") or memory.get("createdAt") or memory.get("timestamp"),
        "tags": tags,
    }

    # Add related files if present
    if "relatedFiles" in memory or "nodeKeys" in memory:
        metadata["relatedFiles"] = memory.get("relatedFiles") or memory.get("nodeKeys", [])

    # Add score if present (from search results)
    if "score" in memory:
        metadata["score"] = memory.get("score")

    return {
        "content": content,
        "section": section,
        "metadata": metadata
    }


def import_to_byterover(memories: List[Dict[str, Any]], dry_run: bool = False) -> Dict[str, Any]:
    """Import memories to ByteRover CLI."""
    stats = {
        "total": len(memories),
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "errors": []
    }

    if dry_run:
        print(f"\n🔍 DRY RUN: Would import {len(memories)} memories")
        for i, memory in enumerate(memories[:5], 1):  # Show first 5
            converted = convert_to_byterover_format(memory)
            print(f"\n  {i}. Section: {converted['section']}")
            print(f"     Content: {converted['content'][:100]}...")
            print(f"     Tags: {converted['metadata'].get('tags', [])}")
        if len(memories) > 5:
            print(f"\n  ... and {len(memories) - 5} more memories")
        return stats

    print(f"\n📤 Importing {len(memories)} memories to ByteRover CLI...")

    # Check if brv command is available
    try:
        result = subprocess.run(
            ["brv", "status"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            print("❌ ByteRover CLI not found or not authenticated")
            print("   Install: npm install -g @byterover/cli")
            print("   Authenticate: brv login")
            return stats
    except FileNotFoundError:
        print("❌ ByteRover CLI not found")
        print("   Install: npm install -g @byterover/cli")
        return stats

    # Import each memory
    for i, memory in enumerate(memories, 1):
        try:
            converted = convert_to_byterover_format(memory)

            # Skip if content is empty
            if not converted["content"] or not converted["content"].strip():
                stats["skipped"] += 1
                continue

            # Escape content for shell
            content = converted["content"].replace('"', '\\"').replace("$", "\\$")
            section = converted["section"]

            # Run brv add command
            result = subprocess.run(
                [
                    "brv", "add",
                    "--section", section,
                    "--content", content
                ],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                stats["success"] += 1
                if i % 10 == 0:
                    print(f"  ✓ Imported {i}/{len(memories)} memories...")
            else:
                stats["failed"] += 1
                error_msg = result.stderr.strip() or result.stdout.strip()
                stats["errors"].append({
                    "memory_id": memory.get("id"),
                    "error": error_msg
                })
                if i <= 5:  # Show first 5 errors
                    print(f"  ✗ Failed to import memory {i}: {error_msg[:100]}")

            # Rate limiting
            time.sleep(0.2)

        except Exception as e:
            stats["failed"] += 1
            stats["errors"].append({
                "memory_id": memory.get("id"),
                "error": str(e)
            })
            if i <= 5:
                print(f"  ✗ Error importing memory {i}: {e}")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Migrate memories from ByteRover MCP to ByteRover CLI"
    )
    parser.add_argument(
        "--mcp-url",
        help="ByteRover MCP URL (default: from .cursor/mcp.json)"
    )
    parser.add_argument(
        "--machine-id",
        help="ByteRover machine ID (default: from .cursor/mcp.json)"
    )
    parser.add_argument(
        "--import-file",
        help="Import memories from JSON file (manual extraction)"
    )
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
        help="Output file for export (default: byterover_mcp_export.json)"
    )

    args = parser.parse_args()

    # Load MCP config if not provided
    if not args.mcp_url:
        mcp_config_path = Path.home() / ".cursor" / "mcp.json"
        if mcp_config_path.exists():
            try:
                with open(mcp_config_path, "r") as f:
                    mcp_config = json.load(f)
                    byterover_mcp = mcp_config.get("mcpServers", {}).get("byterover-mcp", {})
                    args.mcp_url = byterover_mcp.get("url", "")
                    if args.mcp_url and "machineId=" in args.mcp_url:
                        args.machine_id = args.mcp_url.split("machineId=")[1].split("&")[0]
            except Exception as e:
                print(f"⚠️  Could not read MCP config: {e}")

    # Import from file if provided
    if args.import_file:
        memories = import_from_file(args.import_file)
    elif args.mcp_url:
        memories = extract_from_byterover_mcp(args.mcp_url, args.machine_id)
    else:
        print("❌ No MCP URL or import file provided")
        print("   Use --mcp-url or --import-file")
        sys.exit(1)

    if not memories:
        print("❌ No memories found to migrate")
        print("\n💡 Tip: If MCP extraction failed, try manual extraction:")
        print("   1. Use Cursor's MCP tools to retrieve memories")
        print("   2. Export to JSON file")
        print("   3. Use --import-file option")
        sys.exit(1)

    # Export to JSON if requested
    if args.export_only or args.output:
        output_file = args.output or "byterover_mcp_export.json"
        with open(output_file, "w") as f:
            json.dump(memories, f, indent=2, default=str)
        print(f"\n✓ Exported {len(memories)} memories to {output_file}")
        return

    # Import to ByteRover
    stats = import_to_byterover(memories, dry_run=args.dry_run)

    # Print summary
    print(f"\n{'='*60}")
    print("📊 Migration Summary")
    print(f"{'='*60}")
    print(f"Total memories: {stats['total']}")
    print(f"Successfully imported: {stats['success']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped: {stats['skipped']}")

    if stats['errors']:
        print(f"\n❌ Errors ({len(stats['errors'])}):")
        for error in stats['errors'][:5]:  # Show first 5 errors
            print(f"  - {error['memory_id']}: {error['error'][:100]}")
        if len(stats['errors']) > 5:
            print(f"  ... and {len(stats['errors']) - 5} more errors")

    if stats['success'] > 0:
        print(f"\n✓ Migration complete! Run 'brv push' to sync to ByteRover Cloud")


if __name__ == "__main__":
    main()

