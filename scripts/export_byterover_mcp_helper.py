#!/usr/bin/env python3
"""
Helper script to extract ByteRover MCP memories using MCP tools in Cursor.

This script should be run in Cursor where MCP tools are available.
It provides a template and instructions for extracting memories.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

def create_mcp_extraction_instructions():
    """Print instructions for extracting memories via MCP tools."""
    print("=" * 60)
    print("ByteRover MCP Memory Extraction Instructions")
    print("=" * 60)
    print()
    print("Since ByteRover MCP doesn't support direct HTTP access,")
    print("you need to use MCP tools directly from Cursor.")
    print()
    print("STEP 1: In Cursor, ask the AI assistant:")
    print("-" * 60)
    print()
    print('  "Please retrieve all memories from ByteRover MCP using')
    print('   the byterover-retrieve-knowledge tool with an empty')
    print('   query or a very broad query like \'all memories\'."')
    print()
    print("STEP 2: Format the results as JSON")
    print("-" * 60)
    print()
    print('  "Please format all the retrieved memories as a JSON array')
    print('   and save them to a file called byterover_mcp_export.json"')
    print()
    print("STEP 3: Import using migration script")
    print("-" * 60)
    print()
    print("  python scripts/migrate_byterover_mcp_to_cli.py \\")
    print("    --import-file byterover_mcp_export.json \\")
    print("    --dry-run")
    print()
    print("=" * 60)
    print()

def create_template_file():
    """Create a template JSON file for manual memory export."""
    template = {
        "memories": [
            {
                "id": "example-memory-id-1",
                "content": "Example memory content - this is what you learned",
                "tags": ["tag1", "tag2", "best-practice"],
                "category": "best-practice",
                "createdAt": "2025-01-01T00:00:00Z",
                "metadata": {
                    "relatedFiles": ["src/file1.ts", "src/file2.ts"],
                    "score": 0.95
                }
            },
            {
                "id": "example-memory-id-2",
                "content": "Another memory - common error to avoid",
                "tags": ["error", "common-error"],
                "category": "common-error",
                "createdAt": "2025-01-02T00:00:00Z",
                "metadata": {
                    "relatedFiles": [],
                    "score": 0.90
                }
            }
        ],
        "exportedAt": "2025-01-22T00:00:00Z",
        "source": "ByteRover MCP",
        "note": "Replace example memories with your actual memories from ByteRover MCP"
    }

    output_file = Path("byterover_mcp_export_template.json")
    with open(output_file, "w") as f:
        json.dump(template, f, indent=2)

    print(f"✓ Created template file: {output_file}")
    print()
    print("Next steps:")
    print("1. Extract memories from ByteRover MCP using Cursor MCP tools")
    print("2. Replace the example memories in the template with your actual memories")
    print("3. Save the file as byterover_mcp_export.json")
    print("4. Run: python scripts/migrate_byterover_mcp_to_cli.py --import-file byterover_mcp_export.json")

def validate_export_file(file_path: str) -> bool:
    """Validate an exported JSON file format."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Handle different formats
        if isinstance(data, list):
            memories = data
        elif isinstance(data, dict):
            memories = data.get("memories", data.get("results", []))
        else:
            print("❌ Invalid format: Expected array or object with 'memories' key")
            return False

        if not memories:
            print("⚠️  No memories found in file")
            return False

        # Validate memory structure
        valid_count = 0
        for i, memory in enumerate(memories):
            if not isinstance(memory, dict):
                print(f"⚠️  Memory {i} is not an object")
                continue
            if "content" not in memory and "memory" not in memory:
                print(f"⚠️  Memory {i} missing 'content' field")
                continue
            valid_count += 1

        print(f"✓ Validated {valid_count}/{len(memories)} memories")
        return valid_count > 0

    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "template":
            create_template_file()
        elif sys.argv[1] == "validate" and len(sys.argv) > 2:
            validate_export_file(sys.argv[2])
        elif sys.argv[1] == "instructions":
            create_mcp_extraction_instructions()
        else:
            print("Usage:")
            print("  python scripts/export_byterover_mcp_helper.py template")
            print("  python scripts/export_byterover_mcp_helper.py validate <file>")
            print("  python scripts/export_byterover_mcp_helper.py instructions")
    else:
        create_mcp_extraction_instructions()
        print()
        print("To create a template file, run:")
        print("  python scripts/export_byterover_mcp_helper.py template")

if __name__ == "__main__":
    main()

