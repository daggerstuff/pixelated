#!/bin/bash
# Helper script to extract ByteRover MCP memories using Cursor's MCP tools
# This script provides instructions and a template for manual extraction

set -euo pipefail

echo "============================================================"
echo "ByteRover MCP Memory Extraction Helper"
echo "============================================================"
echo ""
echo "Since ByteRover MCP doesn't support direct HTTP access,"
echo "you need to use MCP tools directly from Cursor."
echo ""
echo "OPTION 1: Use Cursor AI Assistant (Recommended)"
echo "------------------------------------------------------------"
echo "In Cursor, ask the AI assistant:"
echo ""
echo '  "Please retrieve all memories from ByteRover MCP using'
echo '   multiple queries to get different categories. Use queries like:'
echo '   - \"memory\"'
echo '   - \"best practices\"'
echo '   - \"error\"'
echo '   - \"testing\"'
echo '   - \"architecture\"'
echo '   - \"security\"'
echo '   - etc.'
echo '   Then format all results as a JSON array and save to'
echo '   byterover_mcp_export.json"'
echo ""
echo "OPTION 2: Manual Extraction"
echo "------------------------------------------------------------"
echo "1. Open Cursor"
echo "2. Use the byterover-retrieve-knowledge tool with different queries"
echo "3. Collect all results"
echo "4. Format as JSON array"
echo "5. Save to byterover_mcp_export.json"
echo ""
echo "OPTION 3: Use Python Helper Script"
echo "------------------------------------------------------------"
echo "python scripts/export_byterover_mcp_helper.py template"
echo ""
echo "Then fill in the template with your memories and run:"
echo "python scripts/migrate_byterover_mcp_to_cli.py --import-file byterover_mcp_export.json"
echo ""
echo "============================================================"

# Create template file if requested
if [[ "${1:-}" == "template" ]]; then
    python3 scripts/export_byterover_mcp_helper.py template
fi

