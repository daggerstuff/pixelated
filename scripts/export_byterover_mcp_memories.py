#!/usr/bin/env python3
"""
Helper script to export ByteRover MCP memories using MCP tools.

This script can be used in Cursor to export memories from ByteRover MCP
when direct MCP extraction is not available via HTTP.
"""

import json
import sys
from typing import Any, Dict, List

# This script is designed to be run in an environment where MCP tools are available
# For example, in Cursor where ByteRover MCP is configured

def export_memories_via_mcp_tool() -> List[Dict[str, Any]]:
    """
    Export memories using MCP tools.

    This function should be called from an environment where MCP tools are available.
    In Cursor, you can use the MCP tools directly via the AI assistant.

    Instructions:
    1. In Cursor, ask the AI to retrieve all memories using byterover-retrieve-knowledge
    2. Export the results to a JSON file
    3. Use migrate_byterover_mcp_to_cli.py with --import-file option
    """
    print("📋 Instructions for exporting ByteRover MCP memories:")
    print("\n1. In Cursor, use the MCP tools to retrieve memories:")
    print("   - Use 'byterover-retrieve-knowledge' with an empty or broad query")
    print("   - Or use 'byterover-list-memories' if available")
    print("\n2. Export the results:")
    print("   - Copy the memory data")
    print("   - Save to a JSON file (e.g., byterover_mcp_export.json)")
    print("\n3. Import using the migration script:")
    print("   python scripts/migrate_byterover_mcp_to_cli.py --import-file byterover_mcp_export.json")

    return []


def create_export_template() -> Dict[str, Any]:
    """Create a template JSON file for manual memory export."""
    template = {
        "memories": [
            {
                "id": "example-memory-id",
                "content": "Example memory content",
                "tags": ["tag1", "tag2"],
                "category": "best-practice",
                "createdAt": "2025-01-01T00:00:00Z",
                "metadata": {
                    "relatedFiles": [],
                    "score": 0.95
                }
            }
        ],
        "exportedAt": "2025-01-22T00:00:00Z",
        "source": "ByteRover MCP"
    }

    return template


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "template":
        # Generate template file
        template = create_export_template()
        output_file = "byterover_mcp_export_template.json"
        with open(output_file, "w") as f:
            json.dump(template, f, indent=2)
        print(f"✓ Created template file: {output_file}")
        print("\nFill in your memories and use:")
        print(f"  python scripts/migrate_byterover_mcp_to_cli.py --import-file {output_file}")
    else:
        export_memories_via_mcp_tool()


if __name__ == "__main__":
    main()

