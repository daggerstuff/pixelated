# Extracting ByteRover MCP Memories via Cursor

Since ByteRover MCP doesn't support direct HTTP access, you need to use the MCP tools directly from Cursor. Here's how:

## Method 1: Using MCP Tools in Cursor (Recommended)

### Step 1: Retrieve Memories

In Cursor, ask the AI assistant to retrieve all memories:

```
Please retrieve all memories from ByteRover MCP using the byterover-retrieve-knowledge tool with an empty query or a very broad query like "all memories" or "everything".
```

Or use multiple queries to get different categories:

```
Please retrieve memories for:
1. Common errors
2. Best practices
3. Testing
4. Architecture
5. Security
```

### Step 2: Export to JSON

Once you have the memories, ask the AI to format them as JSON:

```
Please format all the retrieved memories as a JSON array and save them to a file called byterover_mcp_export.json
```

### Step 3: Import Using Migration Script

```bash
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json \
  --dry-run

# If dry-run looks good, run without --dry-run
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json
```

## Method 2: Manual Extraction Script

Create a simple script that uses the MCP tools:

```python
# This script should be run in Cursor where MCP tools are available
import json

# Use the MCP tool to retrieve memories
# In Cursor, you can use: byterover-retrieve-knowledge with query=""
memories = []  # Replace with actual MCP tool call results

# Save to file
with open("byterover_mcp_export.json", "w") as f:
    json.dump(memories, f, indent=2)

print(f"Exported {len(memories)} memories to byterover_mcp_export.json")
```

## Method 3: Using Cursor's AI to Generate Export

Ask Cursor's AI assistant:

```
I need to export all my ByteRover MCP memories to a JSON file for migration. 
Please:
1. Retrieve all memories using byterover-retrieve-knowledge
2. Format them as a JSON array
3. Save to byterover_mcp_export.json in the scripts/ directory
```

## Expected JSON Format

The exported JSON should look like:

```json
[
  {
    "id": "memory-id-1",
    "content": "Memory content here",
    "tags": ["tag1", "tag2"],
    "category": "best-practice",
    "createdAt": "2025-01-01T00:00:00Z",
    "metadata": {
      "relatedFiles": [],
      "score": 0.95
    }
  },
  {
    "id": "memory-id-2",
    "content": "Another memory",
    "tags": ["error"],
    "category": "common-error",
    "createdAt": "2025-01-02T00:00:00Z"
  }
]
```

## Troubleshooting

### "No memories found"
- Make sure you're using the correct MCP tool name: `byterover-retrieve-knowledge`
- Try with different queries (empty string, "*", "all")
- Check if you have memories stored in ByteRover MCP

### "MCP tool not available"
- Make sure ByteRover MCP is configured in `.cursor/mcp.json`
- Restart Cursor if MCP tools aren't showing up
- Check the MCP server is running

### "Export format incorrect"
- Make sure the JSON is an array of objects
- Each object should have at least `content` field
- Optional fields: `id`, `tags`, `category`, `createdAt`, `metadata`

