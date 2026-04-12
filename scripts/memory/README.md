# Hindsight MCP Server Setup

## Quick Start

**1. Copy the config template:**

```bash
cp scripts/memory/mcp-config.json .mcp.json
```

**2. Edit `.mcp.json` and update:**
- `cwd`: Path to your pixelated repository
- `HINDSIGHT_LOCAL_DB_PATH`: Path where you want to store memories
- `HINDSIGHT_COMPAT_DEFAULT_USER_ID`: Your username

**3. Enable the MCP server:**

Add to your `~/.claude/settings.json` or project's `.claude.json`:

```json
{
  "mcpServers": {
    "hindsight": {
      "command": "uv",
      "args": ["run", "python", "-m", "ai.api.mcp_server.fastmcp_v2_app"],
      "cwd": "/absolute/path/to/pixelated",
      "env": {
        "MEMORY_PROVIDER": "local_hindsight",
        "HINDSIGHT_LOCAL_DB_PATH": "/home/your-user/memory.db",
        "HINDSIGHT_BANK_ID": "default",
        "HINDSIGHT_MCP_STDIO_TRUST": "true",
        "HINDSIGHT_COMPAT_DEFAULT_USER_ID": "your-username",
        "LOCAL_MEMORY_ACTOR_TOKENS_JSON": "{}",
        "LOCAL_MEMORY_ACTOR_POLICIES_JSON": "{}"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MEMORY_PROVIDER` | Yes | Set to `local_hindsight` |
| `HINDSIGHT_LOCAL_DB_PATH` | Yes | Path to SQLite database |
| `HINDSIGHT_BANK_ID` | Yes | Bank identifier (e.g., "default") |
| `HINDSIGHT_MCP_STDIO_TRUST` | Yes | Set to "true" for local |
| `HINDSIGHT_COMPAT_DEFAULT_USER_ID` | Yes | Your username |
| `LOCAL_MEMORY_ACTOR_TOKENS_JSON` | Yes | JSON object (can be "{}") |
| `LOCAL_MEMORY_ACTOR_POLICIES_JSON` | Yes | JSON object (can be "{}") |

## Available Tools

| Tool | Description |
|------|-------------|
| `hindsight_store_memory` | Store a memory with category |
| `hindsight_query_memories` | Search memories by query |
| `hindsight_get_memory` | Get a specific memory by ID |
| `hindsight_list_memories` | List all memories with pagination |
| `hindsight_update_memory` | Update an existing memory |
| `hindsight_delete_memory` | Delete a memory by ID |
| `hindsight_memory_status` | Get memory system status |

## Example Usage

After configuring, use in conversation:

```
/hindsight_store_memory content="User prefers TypeScript" category="preference"
/hindsight_query_memories query="TypeScript preferences" limit=5
/hindsight_list_memories limit=10
```

## Troubleshooting

**Server not starting?**
- Ensure `uv` is installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Check paths in config are absolute paths
- Verify `.env.local` exists with required variables

**Memory not persisting?**
- Check `HINDSIGHT_LOCAL_DB_PATH` is writable
- Verify `LOCAL_MEMORY_ACTOR_POLICIES_JSON` is valid JSON
