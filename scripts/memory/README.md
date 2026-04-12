# Foresight MCP Server

## Quick Start

```bash
# Copy config
cp scripts/memory/mcp-config.json .mcp.json

# Edit .mcp.json:
# 1. Update "cwd" to your pixelated repo path
# 2. Update "FORESIGHT_DB_PATH" to where you want memories stored
# 3. Update "FORESIGHT_USER_ID" to your username
```

## Minimal Config

```json
{
  "mcpServers": {
    "foresight": {
      "command": "uv",
      "args": ["run", "python", "-m", "ai.foresight.app"],
      "cwd": "/absolute/path/to/pixelated",
      "env": {
        "FORESIGHT_DB_PATH": "/home/user/.foresight/memory.db",
        "FORESIGHT_USER_ID": "username"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FORESIGHT_DB_PATH` | No | `~/.foresight/memory.db` | Where to store memories |
| `FORESIGHT_USER_ID` | No | System username | Your user ID |

## Tools

- `foresight_store_memory` - Store memory
- `foresight_query_memories` - Search memories  
- `foresight_list_memories` - List memories
- `foresight_delete_memory` - Delete memory
- `foresight_memory_status` - System status
