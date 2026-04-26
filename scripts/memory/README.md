# Foresight MCP Server

## Quick Start

Foresight is now a standalone package. Install it separately:

```bash
# Clone the standalone repo
git clone https://github.com/vectorize-ai/foresight-mcp.git
cd foresight-mcp

# Install with uv
uv sync

# Run the server
uv run foresight-mcp

# Or use the workspace wrapper script
/home/vivi/pixelated/scripts/memory/foresight-mcp-server.sh
```

## Add to Claude Code

After installing foresight-mcp package:

```json
{
  "mcpServers": {
    "foresight": {
      "command": "/home/vivi/pixelated/scripts/memory/foresight-mcp-server.sh",
      "args": [],
      "cwd": "/path/to/foresight-mcp",
      "env": {
        "FORESIGHT_DB_PATH": "/home/user/.foresight/memory.db",
        "FORESIGHT_USER_ID": "username"
      }
    }
  }
}
```

## Environment Variables

| Variable              | Default                   | Description      |
|-----------------------|--------------------------|------------------|
| `FORESIGHT_DB_PATH`   | `~/.foresight/memory.db` | Database path    |
| `FORESIGHT_USER_ID`   | System user              | User identifier  |

## Tools

- `store_memory` - Store memory
- `query_memories` - Search memories
- `list_memories` - List memories
- `get_memory` - Get specific memory
- `update_memory` - Update memory
- `delete_memory` - Delete memory
- `memory_status` - System status
