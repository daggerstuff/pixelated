# Slack MCP Server - Quick Start

## ✅ What's Already Configured

The `.mcp.json` file is set up to use the **official Anthropic Slack MCP server**:
```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}",
        "SLACK_CHANNEL_IDS": "${SLACK_CHANNEL_IDS}"
      }
    }
  }
}
```

## 🚀 What You Need to Do

### 1. Create a Slack App
- Visit: https://api.slack.com/apps
- Create new app → "From scratch"
- Name it (e.g., "Zed MCP Assistant")

### 2. Add Required Scopes
Go to **OAuth & Permissions** and add these **Bot Token Scopes**:
```
chat:write          - Send messages
chat:write.public   - Send to channels bot isn't in
channels:read       - Read channel info
groups:read         - Read private channels
mpim:read           - Read group DMs
im:read             - Read direct messages
search:read         - Search messages/files
users:read          - Read user info
```

### 3. Install & Get Credentials
- Click **"Install to Workspace"**
- Copy the **Bot User OAuth Token** (starts with `xoxb-`)
- Go to **Basic Information** → Copy **Team ID** (starts with `T`)
- Get **Channel IDs** from Slack URLs or API

### 4. Set Environment Variables

Create `~/.pixelated-env.mcp-slack` (outside project, not git-tracked):

```bash
export SLACK_BOT_TOKEN="xoxb-your-token-here"
export SLACK_TEAM_ID="T01234567"
export SLACK_CHANNEL_IDS="C01234567,C76543210"
```

### 5. Start Zed

```bash
# Load credentials
source ~/.pixelated-env.mcp-slack

# Start Zed in project directory
cd /home/vivi/pixelated
zed .
```

## ✅ Verify It Works

Ask Zed/Claude:
- "What Slack channels are available?"
- "Send a test message to #general"
- "Search for messages about 'deployment'"

## 📖 Full Documentation

See `docs/slack-mcp-setup.md` for detailed setup instructions, troubleshooting, and security guidance.

## 🔐 Security Notes

- ⚠️ **Never** commit Slack tokens to git
- ✅ The `.env.mcp-slack` file pattern is already in `.gitignore`
- ✅ Store credentials outside project directory when possible
- ✅ Rotate tokens periodically
- ⚠️ The git history shows this file was never committed (safe!)