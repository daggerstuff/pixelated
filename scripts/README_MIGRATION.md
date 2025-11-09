# Memory Migration Scripts

Scripts to migrate memories from Mem0, OpenMemory, and ByteRover MCP to ByteRover CLI (3.0).

## Quick Start

### Migrate All Sources

```bash
# Dry run first
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key $OPENMEMORY_API_KEY \
  --dry-run

# Actual migration
python scripts/migrate_all_to_byterover.py \
  --sources all \
  --openmemory-api-key $OPENMEMORY_API_KEY
```

### Individual Scripts

#### OpenMemory (Hosted)
```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-hosted \
  --api-key $OPENMEMORY_API_KEY
```

#### OpenMemory (Local)
```bash
python scripts/migrate_openmemory_to_byterover.py \
  --source openmemory-local \
  --url http://localhost:8765
```

#### ByteRover MCP
```bash
# Option 1: Direct (if supported)
python scripts/migrate_byterover_mcp_to_cli.py

# Option 2: Manual extraction + import
# 1. Export memories from Cursor using MCP tools
# 2. Save to JSON file
# 3. Import
python scripts/migrate_byterover_mcp_to_cli.py \
  --import-file byterover_mcp_export.json
```

## Scripts Overview

### `migrate_all_to_byterover.py`
Unified migration script that can migrate from multiple sources at once.

**Features:**
- Migrate from OpenMemory (hosted/local)
- Migrate from ByteRover MCP
- Combine memories from multiple sources
- Export to JSON
- Dry run mode

### `migrate_openmemory_to_byterover.py`
Migrate memories from OpenMemory (hosted or local).

**Features:**
- Support for hosted OpenMemory (API key required)
- Support for local OpenMemory (Docker)
- Automatic category mapping
- Rate limiting
- Error handling

### `migrate_byterover_mcp_to_cli.py`
Migrate memories from ByteRover MCP (2.0) to ByteRover CLI (3.0).

**Features:**
- Direct MCP extraction (if supported)
- Import from JSON file (manual extraction)
- Automatic section mapping
- Metadata preservation

### `export_byterover_mcp_memories.py`
Helper script for exporting ByteRover MCP memories.

**Usage:**
```bash
# Generate template
python scripts/export_byterover_mcp_memories.py template

# Instructions for manual export
python scripts/export_byterover_mcp_memories.py
```

## Requirements

```bash
# Install Python dependencies
pip install requests

# Or use uv
uv pip install requests
```

## Common Options

All scripts support:

- `--dry-run`: Preview migration without importing
- `--export-only`: Export to JSON without importing
- `--output FILE`: Specify output file for export

## Troubleshooting

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed troubleshooting.

## Documentation

- [Full Migration Guide](./MIGRATION_GUIDE.md)
- [ByteRover CLI Docs](https://docs.byterover.dev/beta)
- [OpenMemory Docs](https://docs.mem0.ai/openmemory/overview)

