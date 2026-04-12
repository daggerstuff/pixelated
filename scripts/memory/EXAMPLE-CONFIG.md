# Hindsight MCP Server - Simple Setup

## Option 1: Add to your existing settings.json

Add this to your `~/.claude/settings.json` or project's `.mcp.json`:

```json
{
  "mcpServers": {
    "hindsight": {
      "command": "uv",
      "args": ["run", "python", "-m", "ai.api.mcp_server.fastmcp_v2_app"],
      "cwd": "/home/your-user/path/to/pixelated",
      "env": {
        "MEMORY_PROVIDER": "local_hindsight",
        "HINDSIGHT_LOCAL_DB_PATH": "/home/your-user/path/to/memory.db",
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

**Required changes:**
1. Replace `/home/your-user/path/to/pixelated` with absolute path to this repo
2. Replace `/home/your-user/path/to/memory.db` with where you want to store memories
3. Replace `your-username` with your username

## Option 2: Use the template file

```bash
# Copy template
cp scripts/memory/mcp-config.json .mcp.json

# Edit with your paths
# Then add to your settings or keep as project config
```

## Verify it works

After adding to settings, you should see Hindsight tools available:
- `hindsight_store_memory`
- `hindsight_query_memories`
- `hindsight_list_memories`
- etc.

Try: `/hindsight_list_memories`
