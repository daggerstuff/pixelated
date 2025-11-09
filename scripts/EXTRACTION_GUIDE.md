# Memory Extraction Guide

This guide explains how to extract memories from OpenMemory and ByteRover MCP when direct API access doesn't work.

## ByteRover MCP Extraction

ByteRover MCP doesn't support direct HTTP access, so you need to use MCP tools from Cursor.

### Method 1: Using Cursor AI Assistant (Easiest)

**Step 1:** In Cursor, ask the AI assistant:

```
Please retrieve all memories from ByteRover MCP using the byterover-retrieve-knowledge tool. 
Use multiple queries to get all memories:
- "memory"
- "best practices"  
- "error"
- "testing"
- "architecture"
- "security"
- "performance"
- "code style"

Collect all results and format them as a JSON array with this structure:
[
  {
    "content": "memory content here",
    "tags": ["tag1", "tag2"],
    "createdAt": "2025-01-01T00:00:00Z",
    "metadata": {}
  }
]

Save the results to byterover_mcp_export.json in the scripts/ directory.
```

**Step 2:** Once you have the JSON file, import it:

```bash
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file scripts/byterover_mcp_export.json \
  --dry-run

# If dry-run looks good, run without --dry-run
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file scripts/byterover_mcp_export.json
```

### Method 2: Manual Query Extraction

If you want to extract memories manually:

1. **Open Cursor**
2. **Use MCP tools** with different queries:
   - `byterover-retrieve-knowledge` with query "memory"
   - `byterover-retrieve-knowledge` with query "best practices"
   - `byterover-retrieve-knowledge` with query "error"
   - etc.

3. **Collect all results** and format as JSON
4. **Save to file**: `byterover_mcp_export.json`

### Method 3: Using Template

1. **Generate template**:
   ```bash
   python scripts/export_byterover_mcp_helper.py template
   ```

2. **Fill in memories** from ByteRover MCP
3. **Import**:
   ```bash
   python scripts/migrate_byterover_mcp_to_cli.py \
     --import-file byterover_mcp_export.json
   ```

## OpenMemory Extraction

### Hosted OpenMemory

The script will try multiple API endpoints and authentication methods automatically:

```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key YOUR_API_KEY
```

If automatic extraction fails, you can:

1. **Check API key**: Make sure it's correct and has proper permissions
2. **Try different endpoint**: The script tries `api.mem0.ai` and `api.openmemory.dev`
3. **Use MCP tools**: If OpenMemory is configured as MCP in Cursor, use MCP tools to export

### Local OpenMemory

1. **Start OpenMemory**:
   ```bash
   docker ps | grep openmemory
   # Or start it:
   curl -sL https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/run.sh | bash
   ```

2. **Extract memories**:
   ```bash
   python scripts/migrate_openmemory_to_byterover.py \
     --source openmemory-local \
     --url http://localhost:8765
   ```

## Expected JSON Format

The exported JSON should be an array of memory objects:

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
    "content": "Another memory",
    "tags": ["error"],
    "category": "common-error"
  }
]
```

**Required fields:**
- `content` (or `memory`, `text`) - The memory content

**Optional fields:**
- `id` - Memory ID
- `tags` - Array of tags
- `category` - Category name
- `createdAt` - Creation timestamp
- `metadata` - Additional metadata

## Troubleshooting

### "No memories found"
- Make sure you're using the correct MCP tool
- Try with different queries
- Check if you have memories stored

### "MCP tool not available"
- Make sure ByteRover MCP is configured in `.cursor/mcp.json`
- Restart Cursor
- Check the MCP server is running

### "Export format incorrect"
- Make sure JSON is an array of objects
- Each object should have at least `content` field
- Validate JSON syntax

### "OpenMemory API failed"
- Check API key is correct
- Try different authentication methods
- Use MCP tools if available
- Check network connectivity

## Quick Reference

```bash
# Extract ByteRover MCP (via Cursor MCP tools)
# 1. Use Cursor AI to extract memories
# 2. Save to byterover_mcp_export.json
# 3. Import:
python scripts/migrate_byterover_mcp_to_cli.py --import-file byterover_mcp_export.json

# Extract OpenMemory Hosted
python scripts/migrate_openmemory_to_byterover.py --source openmemory-hosted --api-key KEY

# Extract OpenMemory Local  
python scripts/migrate_openmemory_to_byterover.py --source openmemory-local

# Extract All Sources
python scripts/migrate_all_to_byterover.py --sources all --openmemory-api-key KEY
```

## Next Steps

After extraction:
1. **Dry run**: Always test with `--dry-run` first
2. **Import**: Run migration script
3. **Verify**: Check with `brv status` and `brv retrieve`
4. **Push**: Sync to cloud with `brv push`

