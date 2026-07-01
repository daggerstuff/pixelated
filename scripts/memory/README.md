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

| Variable              | Default                  | Description      |
| --------------------- | ------------------------ | ---------------- |
| `FORESIGHT_DB_PATH`   | `~/.foresight/memory.db` | Database path    |
| `FORESIGHT_USER_ID`   | System user              | User identifier  |

## Tools

- `manage_memories` - Store, update, delete, or archive memories
- `search_memories` - Search or retrieve memories
- `manage_context_blocks` - Manage continuity blocks
- `process_session_transcript` - Extract memories from a transcript
- `manage_curation_runs` - Manage reviewable curation runs
- `inject_context` - Inject relevant context
- `query_memories_temporal` - Query memory trends by time window
- `get_system_status` - System status

Use the nested `foresight-mcp` CLI or Python API for expert and maintenance
workflows that are not exposed through MCP.
