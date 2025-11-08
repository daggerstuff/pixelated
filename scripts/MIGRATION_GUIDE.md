# Mem0 → ByteRover Migration Guide

This guide helps you migrate your memories from Mem0 Platform and OpenMemory to ByteRover CLI.

## 🎯 What Gets Migrated

- ✅ All memory content
- ✅ Categories → ByteRover sections mapping
- ✅ Metadata (timestamps, user IDs, tags)
- ✅ Original IDs (preserved in metadata)

## 📋 Prerequisites

1. **ByteRover CLI** installed and authenticated
   ```bash
   brv status  # Should show "Logged in"
   ```

2. **API Keys** from your source:
   - **Mem0 Platform**: Get from [app.mem0.ai/settings/api-keys](https://app.mem0.ai/settings/api-keys)
   - **OpenMemory Hosted**: Get from [app.openmemory.dev](https://app.openmemory.dev/)
   - **OpenMemory Local**: No key needed if running locally

3. **Dependencies**:
   ```bash
   # For TypeScript version
   pnpm install
   
   # For Python version
   pip install requests
   ```

## 🚀 Migration Methods

### Method 1: Using TypeScript Script (Recommended)

```bash
# Dry run first (preview without importing)
tsx scripts/migrate-mem0-to-byterover.ts \
  --source mem0 \
  --api-key YOUR_MEM0_API_KEY \
  --dry-run

# Actual migration
tsx scripts/migrate-mem0-to-byterover.ts \
  --source mem0 \
  --api-key YOUR_MEM0_API_KEY
```

### Method 2: Using Python Script

```bash
# Dry run
python scripts/migrate_mem0_to_byterover.py \
  --source mem0 \
  --api-key YOUR_MEM0_API_KEY \
  --dry-run

# Actual migration
python scripts/migrate_mem0_to_byterover.py \
  --source mem0 \
  --api-key YOUR_MEM0_API_KEY
```

### Method 3: Manual Export + Import

If the scripts don't work, you can manually export and import:

#### Step 1: Export from Mem0 Platform

```python
# export_mem0.py
import requests
import json

API_KEY = "your-mem0-api-key"
headers = {"Authorization": f"Token {API_KEY}"}

all_memories = []
page = 1

while True:
    response = requests.post(
        "https://api.mem0.ai/v2/memories/",
        headers=headers,
        json={"filters": {}, "page": page, "page_size": 100}
    )
    data = response.json()
    memories = data.get("results", [])
    
    if not memories:
        break
    
    all_memories.extend(memories)
    page += 1

with open("mem0_export.json", "w") as f:
    json.dump(all_memories, f, indent=2)

print(f"Exported {len(all_memories)} memories")
```

#### Step 2: Import to ByteRover

```bash
# import_to_byterover.sh
#!/bin/bash

while IFS= read -r line; do
  memory=$(echo "$line" | jq -r '.memory')
  section="Lessons Learned"  # Or map based on categories
  
  brv add --section "$section" --content "$memory"
done < <(jq -c '.[]' mem0_export.json)
```

## 📊 Category Mapping

Mem0 categories are automatically mapped to ByteRover sections:

| Mem0 Category | ByteRover Section |
|---------------|-------------------|
| error, bug | Common Errors |
| best practice | Best Practices |
| architecture, design | Architecture |
| test, testing | Testing |
| strategy, approach | Strategies |
| *default* | Lessons Learned |

## 🔧 Advanced Options

### Filter by User/Agent

```bash
# Modify the script to add filters
tsx scripts/migrate-mem0-to-byterover.ts \
  --source mem0 \
  --api-key YOUR_KEY \
  --filters '{"user_id": "user123"}'
```

### Custom Batch Size

```bash
tsx scripts/migrate-mem0-to-byterover.ts \
  --source mem0 \
  --api-key YOUR_KEY \
  --batch-size 50
```

### Migrate from Local OpenMemory

```bash
# Make sure OpenMemory is running locally
docker ps | grep openmemory

# Migrate
tsx scripts/migrate-mem0-to-byterover.ts \
  --source openmemory-local \
  --url http://localhost:8765
```

## 🛡️ Safety Features

1. **Dry Run**: Always test with `--dry-run` first
2. **Backup**: Automatic backup saved to `.brv/migration-backup.json`
3. **Error Handling**: Failed imports are logged, successful ones continue
4. **Metadata Preservation**: Original IDs and timestamps preserved

## 🔍 Verification

After migration, verify your memories:

```bash
# Check status
brv status

# View playbook
cat .brv/ace/playbook.json | jq

# Search for migrated memories
brv retrieve --query "your search term"
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
- Add delays between requests
- Reduce batch size: `--batch-size 10`
- Contact Mem0 support for rate limit increase

### "Memory content too long"
- ByteRover has content limits
- Split long memories into multiple bullets
- Summarize before importing

## 📝 Post-Migration

1. **Push to ByteRover Cloud**:
   ```bash
   brv push
   ```

2. **Clean up old MCP config** (optional):
   ```bash
   # Remove Mem0/OpenMemory from .kiro/settings/mcp.json
   ```

3. **Test retrieval**:
   ```bash
   brv retrieve --query "test query"
   ```

## 💡 Tips

- **Start with dry run**: Always preview first
- **Migrate in batches**: If you have thousands of memories, migrate in chunks
- **Review categories**: Check if category mapping makes sense for your use case
- **Keep backup**: Don't delete Mem0 data until you verify ByteRover migration
- **Update workflows**: Update any scripts/tools that reference Mem0 APIs

## 🆘 Need Help?

- ByteRover Docs: Check ByteRover documentation
- Mem0 API Docs: [docs.mem0.ai/api-reference](https://docs.mem0.ai/api-reference)
- OpenMemory Docs: [docs.mem0.ai/openmemory](https://docs.mem0.ai/openmemory)

## 📚 Additional Resources

- [ByteRover CLI Reference](.kiro/steering/agent-context-engineering.md)
- [Mem0 Platform API](https://docs.mem0.ai/api-reference/memory/v2-get-memories)
- [OpenMemory MCP](https://docs.mem0.ai/openmemory/overview)
