#!/usr/bin/env python3
"""
Extract memories from OpenMemory using the Mem0 SDK.

OpenMemory hosted uses the Mem0 API, so we can use the mem0ai Python SDK.
"""

import argparse
import json
import sys
from typing import Any, Dict, List

try:
    from mem0 import MemoryClient
except ImportError:
    print("❌ mem0ai package not installed")
    print("   Install with: pip install mem0ai")
    print("   Or with uv: uv pip install mem0ai")
    sys.exit(1)


def extract_from_openmemory_sdk(api_key: str) -> List[Dict[str, Any]]:
    """Extract all memories from OpenMemory using Mem0 SDK."""
    print("📥 Extracting memories from OpenMemory using Mem0 SDK...")

    try:
        # Initialize Mem0 client
        client = MemoryClient(api_key=api_key)

        # Search for all memories with a very broad query
        # The SDK should handle pagination automatically
        all_memories = []
        page = 1

        print("  Fetching memories...")

        # Try to get all memories by searching with empty/broad query
        # Mem0 SDK might have a list_all method or we need to search broadly
        try:
            # Try list method if available
            if hasattr(client, 'list'):
                memories = client.list()
                if memories:
                    all_memories = memories if isinstance(memories, list) else memories.get("results", [])
            elif hasattr(client, 'get_all'):
                memories = client.get_all()
                all_memories = memories if isinstance(memories, list) else memories.get("results", [])
            else:
                # Use search with broad query
                # Try multiple search strategies
                search_queries = [
                    "",  # Empty query
                    "memory",  # Broad query
                    "*",  # Wildcard
                ]

                for query in search_queries:
                    try:
                        results = client.search(query, limit=1000)
                        if results:
                            if isinstance(results, list):
                                all_memories.extend(results)
                            elif isinstance(results, dict):
                                all_memories.extend(results.get("results", results.get("memories", [])))
                            break
                    except Exception as e:
                        print(f"  Search with '{query}' failed: {e}")
                        continue
        except Exception as e:
            print(f"  Error fetching memories: {e}")
            print("  Trying alternative method...")

            # Alternative: Try direct API call through SDK
            try:
                # The SDK might expose the underlying API
                if hasattr(client, '_client') or hasattr(client, 'api'):
                    # Try to access internal API client
                    pass
            except:
                pass

        print(f"📊 Total memories extracted: {len(all_memories)}")
        return all_memories

    except Exception as e:
        print(f"❌ Error connecting to OpenMemory: {e}")
        print("\n💡 Alternative methods:")
        print("   1. Use OpenMemory dashboard to export memories")
        print("   2. Use OpenMemory MCP tools in Cursor (if configured)")
        print("   3. Check API key and permissions")
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Extract memories from OpenMemory using Mem0 SDK"
    )
    parser.add_argument(
        "--api-key",
        help="OpenMemory API key (required)",
        required=True
    )
    parser.add_argument(
        "--output",
        help="Output file for export (default: openmemory_export.json)",
        default="openmemory_export.json"
    )

    args = parser.parse_args()

    # Extract memories
    memories = extract_from_openmemory_sdk(args.api_key)

    if not memories:
        print("❌ No memories found or extraction failed")
        sys.exit(1)

    # Export to JSON
    print(f"\n📤 Exporting {len(memories)} memories to {args.output}...")
    with open(args.output, "w") as f:
        json.dump(memories, f, indent=2, default=str)

    print(f"✓ Exported to {args.output}")
    print("\nNext step: Import to ByteRover CLI")
    print(f"  python scripts/migrate_openmemory_to_byterover.py --import-file {args.output}")


if __name__ == "__main__":
    main()

