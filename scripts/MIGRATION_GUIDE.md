# Memory Migration Guide: Mem0, OpenMemory, and ByteRover MCP → ByteRover CLI

This guide helps you migrate your memories from Mem0 Platform, OpenMemory, and ByteRover MCP to ByteRover CLI (3.0).

## 🎯 What Gets Migrated

- ✅ All memory content
- ✅ Categories → ByteRover sections mapping
- ✅ Metadata (timestamps, user IDs, tags)
- ✅ Original IDs (preserved in metadata)
- ✅ Related files (if available)

## 📋 Prerequisites

1. **ByteRover CLI** installed and authenticated
   ```bash
   brv status  # Should show "Logged in"
   ```

2. **API Keys** from your sources:
   - **Mem0 Platform**: Get from [app.mem0.ai/settings/api-keys](https://app.mem0.ai/settings/api-keys)
   - **OpenMemory Hosted**: Get from [app.openmemory.dev](https://app.openmemory.dev/)
   - **OpenMemory Local**: No key needed if running locally
   - **ByteRover MCP**: Uses MCP URL from `.cursor/mcp.json`

3. **Dependencies**:
   ```bash
   # Install Python dependencies
   pip install requests
   
   # Or use uv (recommended)
   uv pip install requests
   ```

## 🚀 Migration Methods

### Method 1: Unified Migration Script (Recommended)

Migrate from all sources at once:

```bash
# Dry run first (preview without importing)
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --dry-run

# Migrate from all sources
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key YOUR_OPENMEMORY_API_KEY

# Migrate from specific sources
python scripts/migrate_all_to_byterover.py \
  --sources openmemory-hosted byterover-mcp \
  --openmemory-api-key YOUR_OPENMEMORY_API_KEY
```

### Method 2: Individual Migration Scripts

#### OpenMemory Migration

**Hosted OpenMemory:**
```bash
# Dry run
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key YOUR_OPENMEMORY_API_KEY \
  --dry-run

# Actual migration
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key YOUR_OPENMEMORY_API_KEY
```

**Local OpenMemory:**
```bash
# Make sure OpenMemory is running locally
docker ps | grep openmemory

# Migrate
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-local \
  --url http://localhost:8765
```

#### ByteRover MCP Migration

**Option 1: Direct MCP Extraction (if supported)**
```bash
python scripts/migrate_byterover_mcp_to_cli.py \
  --dry-run
```

**Option 2: Manual Extraction + Import**

1. **Extract memories using MCP tools in Cursor:**
   - Open Cursor
   - Use the `byterover-retrieve-knowledge` tool with an empty query to get all memories
   - Export the results to a JSON file

2. **Import the exported file:**
   ```bash
   python scripts/migrate_byterover_mcp_to_cli.py \
     --import-file byterover_mcp_export.json \
     --dry-run
   ```

### Method 3: Export + Manual Import

#### Step 1: Export Memories

**OpenMemory:**
```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key YOUR_KEY \
  --export-only \
  --output openmemory_export.json
```

**ByteRover MCP:**
```bash
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json \
  --export-only \
  --output byterover_mcp_export.json
```

#### Step 2: Import to ByteRover

```bash
# Import OpenMemory memories
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --import-file openmemory_export.json

# Import ByteRover MCP memories
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json
```

## 📊 Category Mapping

Memories are automatically mapped to ByteRover sections based on categories and tags:

| Source Category/Tag | ByteRover Section |
|---------------------|-------------------|
| error, bug | Common Errors |
| best practice, best-practice | Best Practices |
| architecture, design | Architecture |
| test, testing | Testing |
| strategy, approach | Strategies |
| security | Security |
| performance | Best Practices |
| code style, code-quality | Code Style and Quality |
| styling, design | Styling and Design |
| *default* | Lessons Learned |

## 🔧 Advanced Options

### Filter by User/Agent

```bash
# Modify the scripts to add filters (requires code changes)
# Or filter the exported JSON file before importing
```

### Custom Batch Size

The scripts automatically handle batching with rate limiting. For large datasets, you can modify the `page_size` parameter in the scripts.

### Migrate from Multiple Sources

```bash
# Migrate from all sources and combine
python scripts/migrate_all_to_byterover.py \
  --sources openmemory-hosted byterover-mcp \
  --openmemory-api-key YOUR_KEY \
  --combine
```

### Export Only (No Import)

```bash
# Export all memories to JSON
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key YOUR_KEY \
  --export-only \
  --output all_memories.json
```

## 🛡️ Safety Features

1. **Dry Run**: Always test with `--dry-run` first
2. **Backup**: Export memories before importing
3. **Error Handling**: Failed imports are logged, successful ones continue
4. **Metadata Preservation**: Original IDs and timestamps preserved
5. **Rate Limiting**: Automatic delays between requests

## 🔍 Verification

After migration, verify your memories:

```bash
# Check status
brv status

# View playbook
cat .brv/ace/playbook.json | jq

# Search for migrated memories
brv retrieve --query "test query"
```

## 🐛 Troubleshooting

### "API key is invalid"
- Verify your API key from the dashboard
- Check if key has proper permissions
- Try regenerating the key

### "brv command not found"
```bash
# Install ByteRover CLI
npm install -g @byterover/cli

# Or use npx
npx @byterover/cli status
```

### "Rate limit exceeded"
- Scripts automatically add delays
- Reduce batch size if needed
- Contact support for rate limit increase

### "Memory content too long"
- ByteRover has content limits
- Scripts automatically skip empty memories
- Split long memories manually if needed

### "OpenMemory connection failed" (Local)
```bash
# Check if OpenMemory is running
docker ps | grep openmemory

# Start OpenMemory if not running
curl -sL https://raw.githubusercontent.com/mem0ai/mem0/main/openmemory/run.sh | bash

# Or start manually
docker run -d -p 8765:8765 -e OPENAI_API_KEY=your_key openmemory
```

### "ByteRover MCP extraction failed"
- **This is expected**: ByteRover MCP doesn't support direct HTTP access
- **Solution**: Use MCP tools from Cursor to extract memories
- **Steps**:
  1. Open Cursor
  2. Ask AI assistant to retrieve all memories using `byterover-retrieve-knowledge` tool
  3. Use multiple queries: "memory", "best practices", "error", "testing", etc.
  4. Format results as JSON array
  5. Save to `byterover_mcp_export.json`
  6. Import using: `python scripts/migrate_byterover_mcp_to_cli.py --import-file byterover_mcp_export.json`
- See [EXTRACTION_GUIDE.md](./EXTRACTION_GUIDE.md) for detailed instructions

### "OpenMemory connection failed" (Hosted)
- The script tries multiple API endpoints automatically
- If all fail, check:
  1. Your API key is correct
  2. Your API key has the right permissions
  3. The API endpoint is accessible
- **Alternative**: Use OpenMemory MCP tools in Cursor to export memories
- See [EXTRACTION_GUIDE.md](./EXTRACTION_GUIDE.md) for detailed instructions

## 📝 Post-Migration

1. **Push to ByteRover Cloud**:
   ```bash
   brv push
   ```

2. **Clean up old MCP config** (optional):
   ```bash
   # Remove Mem0/OpenMemory from .cursor/mcp.json if no longer needed
   ```

3. **Test retrieval**:
   ```bash
   brv retrieve --query "test query"
   ```

4. **Verify all memories**:
   ```bash
   # Count memories in playbook
   cat .brv/ace/playbook.json | jq '.bullets | length'
   ```

## 💡 Tips

- **Start with dry run**: Always preview first
- **Migrate in batches**: If you have thousands of memories, migrate in chunks
- **Review categories**: Check if category mapping makes sense for your use case
- **Keep backup**: Don't delete source data until you verify ByteRover migration
- **Update workflows**: Update any scripts/tools that reference old memory APIs
- **Test retrieval**: Verify that migrated memories can be retrieved correctly

## 🔄 Migration Workflow

### Recommended Workflow

1. **Backup existing memories** (export to JSON)
2. **Dry run migration** to preview changes
3. **Migrate in stages** (one source at a time)
4. **Verify migration** (check playbook and test retrieval)
5. **Push to cloud** (sync with ByteRover Cloud)
6. **Clean up** (remove old MCP configs if desired)

### Example Complete Workflow

```bash
# 1. Backup
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key YOUR_KEY \
  --export-only \
  --output backup_openmemory.json

# 2. Dry run
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key YOUR_KEY \
  --dry-run

# 3. Migrate
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key YOUR_KEY

# 4. Verify
brv status
brv retrieve --query "test"

# 5. Push
brv push
```

## 🆘 Need Help?

- **ByteRover Docs**: [docs.byterover.dev](https://docs.byterover.dev/)
- **ByteRover Beta Docs**: [docs.byterover.dev/beta](https://docs.byterover.dev/beta)
- **Mem0 API Docs**: [docs.mem0.ai/api-reference](https://docs.mem0.ai/api-reference)
- **OpenMemory Docs**: [docs.mem0.ai/openmemory](https://docs.mem0.ai/openmemory)

## 📚 Additional Resources

- [ByteRover CLI Reference](.kiro/steering/agent-context-engineering.md)
- [Mem0 Platform API](https://docs.mem0.ai/api-reference/memory/v2-get-memories)
- [OpenMemory MCP](https://docs.mem0.ai/openmemory/overview)
- [ByteRover MCP](https://docs.byterover.dev/)

## 🎯 Quick Reference

### OpenMemory Hosted
```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key $OPENMEMORY_API_KEY
```

### OpenMemory Local
```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-local \
  --url http://localhost:8765
```

### ByteRover MCP
```bash
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json
```

### All Sources
```bash
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key $OPENMEMORY_API_KEY
```

---

*Last updated: 2025-01-22*

