#!/usr/bin/env bash
# Start Cipher MCP server in a detached tmux session
SESSION_NAME="cipher_mcp"
AGENT_CONFIG="memAgent/cipher.yml"

# Check if session exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "🔔 tmux session '$SESSION_NAME' already running"
else
  echo "🚀 Starting tmux session '$SESSION_NAME' with Cipher MCP server"
  tmux new-session -d -s "$SESSION_NAME" "cipher --agent $AGENT_CONFIG --mode mcp"
  echo "✅ Cipher MCP server started in tmux session '$SESSION_NAME'"
fi
