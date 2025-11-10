#!/usr/bin/env python3
"""
Migrate memories from OpenMemory to ByteRover CLI.

Supports both hosted OpenMemory (app.openmemory.dev) and local OpenMemory instances.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests


def map_category_to_section(category: Optional[str]) -> str:
    """Map OpenMemory/Mem0 category to ByteRover section."""
    if not category:
        return "Lessons Learned"

    category_lower = category.lower()

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
    }

    # Check exact matches first
    if category_lower in mapping:
        return mapping[category_lower]

    # Check partial matches
    for key, section in mapping.items():
        if key in category_lower or category_lower in key:
            return section

    return "Lessons Learned"


def extract_from_openmemory_hosted(api_key: str, base_url: str = "https://api.openmemory.dev") -> List[Dict[str, Any]]:
    """Extract all memories from hosted OpenMemory."""
    # OpenMemory hosted uses Mem0 API format
    # Try different authentication methods and endpoints
    all_memories = []
    page = 1
    page_size = 100

    print(f"📥 Extracting memories from hosted OpenMemory ({base_url})...")

    # Try different base URLs - OpenMemory hosted might use Mem0 API
    api_urls = [
        "https://api.mem0.ai",  # Mem0 API (OpenMemory hosted uses this)
        "https://api.openmemory.dev",  # Direct OpenMemory API
        base_url  # User-provided URL
    ]

    auth_headers = [
        {"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        {"X-API-Key": api_key, "Content-Type": "application/json"},
    ]

    for api_url in api_urls:
        for headers in auth_headers:
            try:
                print(f"  Trying {api_url} with {headers.get('Authorization', headers.get('X-API-Key', 'unknown'))[:20]}...")

                # Try Mem0 v2 API format (POST)
                response = requests.post(
                    urljoin(api_url, "/v2/memories/"),
                    headers=headers,
                    json={"filters": {}, "page": page, "page_size": page_size},
                    timeout=30
                )

                if response.status_code == 200:
                    data = response.json()

                    # Handle different response formats
                    if isinstance(data, dict):
                        memories = data.get("results", data.get("memories", []))
                        if memories:
                            print(f"  ✓ Successfully connected to {api_url}")
                            # Fetch all pages
                            while True:
                                all_memories.extend(memories)
                                print(f"  ✓ Fetched page {page} ({len(memories)} memories)")

                                if len(memories) < page_size:
                                    break

                                page += 1
                                response = requests.post(
                                    urljoin(api_url, "/v2/memories/"),
                                    headers=headers,
                                    json={"filters": {}, "page": page, "page_size": page_size},
                                    timeout=30
                                )
                                if response.status_code != 200:
                                    break
                                data = response.json()
                                memories = data.get("results", data.get("memories", []))

                            break
                    elif isinstance(data, list):
                        if data:
                            print(f"  ✓ Successfully connected to {api_url}")
                            all_memories = data
                            break

                elif response.status_code == 401:
                    continue  # Try next auth method
                elif response.status_code == 404:
                    continue  # Try next URL

            except requests.exceptions.RequestException:
                continue  # Try next combination

        if all_memories:
            break

    if not all_memories:
        print("❌ Could not connect to OpenMemory API")
        print("   Tried multiple endpoints and authentication methods")
        print("   Please check:")
        print("   1. Your API key is correct")
        print("   2. Your API key has the right permissions")
        print("   3. The API endpoint is accessible")
        print("\n💡 Alternative: Use OpenMemory MCP tools in Cursor to export memories")

    print(f"📊 Total memories extracted: {len(all_memories)}")
    return all_memories


def extract_from_openmemory_local(base_url: str = "http://localhost:8765") -> List[Dict[str, Any]]:
    """Extract all memories from local OpenMemory instance."""
    all_memories = []

    print(f"📥 Extracting memories from local OpenMemory ({base_url})...")

    try:
        # OpenMemory local uses MCP protocol over HTTP
        # Try to list all memories using search with empty query
        response = requests.post(
            urljoin(base_url, "/mcp/list_memories"),
            json={},
            timeout=30
        )

        if response.status_code == 404:
            # Try alternative endpoint
            response = requests.get(
                urljoin(base_url, "/memories"),
                timeout=30
            )

        response.raise_for_status()
        data = response.json()

        # Handle MCP response format
        if isinstance(data, dict) and "contents" in data:
            all_memories = data["contents"]
        elif isinstance(data, list):
            all_memories = data
        elif isinstance(data, dict) and "results" in data:
            all_memories = data["results"]

        print(f"📊 Total memories extracted: {len(all_memories)}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to local OpenMemory: {e}")
        print("   Make sure OpenMemory is running: docker ps | grep openmemory")
        print("   Or start it with: curl -sL https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/run.sh | bash")

    return all_memories


def extract_from_openmemory_mcp() -> List[Dict[str, Any]]:
    """
    Extract memories from OpenMemory via MCP protocol.
    This requires MCP client setup in Cursor/Claude Desktop.
    """
    # Note: This would require MCP client integration
    # For now, we'll document this approach but use HTTP API instead
    print("⚠️  MCP extraction not implemented. Using HTTP API instead.")
    return []


def convert_to_byterover_format(memory: Dict[str, Any]) -> Dict[str, Any]:
    """Convert OpenMemory memory format to ByteRover format."""
    # Extract memory content
    content = memory.get("memory") or memory.get("content") or memory.get("text", "")

    # Extract category
    categories = memory.get("categories", [])
    category = categories[0] if categories else memory.get("category")

    # Map to ByteRover section
    section = map_category_to_section(category)

    # Extract metadata
    metadata = {
        "originalId": memory.get("id"),
        "originalSource": "OpenMemory",
        "createdAt": memory.get("created_at") or memory.get("createdAt"),
        "userId": memory.get("user_id") or memory.get("userId"),
        "tags": memory.get("tags", []),
    }

    # Add categories as tags if not already present
    if categories and "tags" not in metadata:
        metadata["tags"] = categories

    return {
        "content": content,
        "section": section,
        "metadata": metadata
    }


def get_already_imported_memory_ids() -> set:
    """Get set of memory IDs that have already been imported."""
    imported_ids = set()

    # Check .brv directory for imported memories
    brv_dir = os.path.join(os.getcwd(), ".brv", "ace", "bullets")
    if not os.path.exists(brv_dir):
        return imported_ids

    # Read all markdown files and extract original IDs from metadata
    for root, dirs, files in os.walk(brv_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Look for originalId in metadata
                        if "originalId" in content:
                            # Extract ID using simple regex
                            import re
                            match = re.search(r'originalId["\']?\s*:\s*["\']?([^"\'\s,}]+)', content)
                            if match:
                                imported_ids.add(match.group(1))
                except Exception:
                    continue

    return imported_ids


def find_brv_command() -> Optional[str]:
    """Find the brv command in PATH or common locations."""
    # Try shutil.which first (uses PATH)
    brv_path = shutil.which("brv")
    if brv_path:
        return brv_path

    # Try common pnpm locations
    pnpm_locations = [
        os.path.expanduser("~/.local/share/pnpm/brv"),
        os.path.expanduser("~/.local/bin/brv"),
        "/usr/local/bin/brv",
        "/usr/bin/brv",
    ]

    for path in pnpm_locations:
        if os.path.exists(path) and os.access(path, os.X_OK):
            return path

    return None


def import_to_byterover(memories: List[Dict[str, Any]], dry_run: bool = False, resume: bool = True) -> Dict[str, Any]:
    """Import memories to ByteRover CLI with resume capability."""
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
            print(f"     Metadata: {converted['metadata']}")
        if len(memories) > 5:
            print(f"\n  ... and {len(memories) - 5} more memories")
        return stats

    print(f"\n📤 Importing {len(memories)} memories to ByteRover CLI...")

    # Find brv command
    brv_cmd = find_brv_command()
    if not brv_cmd:
        print("❌ ByteRover CLI not found")
        print("   Install: npm install -g @byterover/cli")
        print("   Or: pnpm add -g @byterover/cli")
        return stats

    # Check if brv command works
    try:
        result = subprocess.run(
            [brv_cmd, "status"],
            capture_output=True,
            text=True,
            timeout=10,
            env=os.environ.copy()  # Preserve environment
        )
        if result.returncode != 0:
            print("❌ ByteRover CLI not authenticated")
            print("   Authenticate: brv login")
            print(f"   Error: {result.stderr.strip()}")
            return stats
    except Exception as e:
        print(f"❌ Error checking ByteRover CLI: {e}")
        return stats

    # Get already imported memory IDs if resuming
    already_imported = set()
    if resume:
        print("🔍 Checking for already imported memories...")
        already_imported = get_already_imported_memory_ids()
        if already_imported:
            print(f"   Found {len(already_imported)} already imported memories")
            stats["skipped"] = len(already_imported)

    # Import each memory
    start_time = time.time()
    for i, memory in enumerate(memories, 1):
        memory_id = memory.get("id")

        # Skip if already imported
        if resume and memory_id in already_imported:
            continue

        try:
            converted = convert_to_byterover_format(memory)

            # Escape content for shell
            content = converted["content"].replace('"', '\\"').replace("$", "\\$")
            section = converted["section"]

            # Run brv add command
            result = subprocess.run(
                [
                    brv_cmd, "add",
                    "--section", section,
                    "--content", content
                ],
                capture_output=True,
                text=True,
                timeout=30,
                env=os.environ.copy()  # Preserve environment
            )

            if result.returncode == 0:
                stats["success"] += 1
                if i % 50 == 0 or stats["success"] % 50 == 0:
                    elapsed = time.time() - start_time
                    rate = stats["success"] / elapsed if elapsed > 0 else 0
                    remaining = (stats["total"] - stats["success"] - stats["skipped"]) / rate if rate > 0 else 0
                    print(f"  ✓ Imported {stats['success']}/{stats['total'] - stats['skipped']} new memories "
                          f"({stats['skipped']} skipped) | "
                          f"Rate: {rate:.1f}/s | "
                          f"ETA: {remaining/60:.1f}m")
            else:
                stats["failed"] += 1
                error_msg = result.stderr.strip() or result.stdout.strip()
                stats["errors"].append({
                    "memory_id": memory_id,
                    "error": error_msg
                })
                if stats["failed"] <= 10:  # Only show first 10 errors
                    print(f"  ✗ Failed to import memory {i}: {error_msg[:100]}")

            # Rate limiting
            time.sleep(0.2)

        except Exception as e:
            stats["failed"] += 1
            stats["errors"].append({
                "memory_id": memory_id,
                "error": str(e)
            })
            if stats["failed"] <= 10:  # Only show first 10 errors
                print(f"  ✗ Error importing memory {i}: {e}")

    return stats


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
            # Try different possible keys
            memories = (
                data.get("memories") or
                data.get("results") or
                data.get("contents") or
                data.get("data") or
                data.get("items") or
                []
            )
            # If it's a single memory object, wrap it in a list
            if not isinstance(memories, list) and isinstance(memories, dict):
                memories = [memories]
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


def main():
    parser = argparse.ArgumentParser(
        description="Migrate memories from OpenMemory to ByteRover CLI"
    )
    parser.add_argument(
        "--source",
        choices=["openmemory-hosted", "openmemory-local"],
        default="openmemory-hosted",
        help="OpenMemory source type"
    )
    parser.add_argument(
        "--api-key",
        help="OpenMemory API key (required for hosted)"
    )
    parser.add_argument(
        "--url",
        help="OpenMemory base URL (default: https://api.openmemory.dev for hosted, http://localhost:8765 for local)"
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
        help="Output file for export (default: openmemory_export.json)"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Resume import by skipping already imported memories (default: True)"
    )
    parser.add_argument(
        "--no-resume",
        dest="resume",
        action="store_false",
        help="Disable resume functionality (re-import all memories)"
    )

    args = parser.parse_args()

    # Import from file if provided
    if args.import_file:
        memories = import_from_file(args.import_file)
        if not memories:
            print("❌ No memories found in file")
            print("   Make sure the file contains memory data, not just categories")
            sys.exit(1)
    else:
        # Validate arguments for API extraction
        if args.source == "openmemory-hosted" and not args.api_key:
            api_key = os.getenv("OPENMEMORY_API_KEY")
            if not api_key:
                print("❌ API key required for hosted OpenMemory")
                print("   Use --api-key or set OPENMEMORY_API_KEY environment variable")
                sys.exit(1)
            args.api_key = api_key

        # Set default URL
        if not args.url:
            if args.source == "openmemory-hosted":
                args.url = "https://api.openmemory.dev"
            else:
                args.url = "http://localhost:8765"

        # Extract memories
        if args.source == "openmemory-hosted":
            memories = extract_from_openmemory_hosted(args.api_key, args.url)
        else:
            memories = extract_from_openmemory_local(args.url)

        if not memories:
            print("❌ No memories found to migrate")
            sys.exit(1)

    # Export to JSON if requested
    if args.export_only or args.output:
        output_file = args.output or "openmemory_export.json"
        with open(output_file, "w") as f:
            json.dump(memories, f, indent=2, default=str)
        print(f"\n✓ Exported {len(memories)} memories to {output_file}")
        return

    # Import to ByteRover
    stats = import_to_byterover(memories, dry_run=args.dry_run, resume=args.resume)

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
        print("\n✓ Migration complete! Run 'brv push' to sync to ByteRover Cloud")


if __name__ == "__main__":
    main()

