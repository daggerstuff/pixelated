#!/usr/bin/env bash
# Start Cipher MCP server in a detached tmux session
SESSION_NAME="cipher_mcp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_CONFIG="$PROJECT_ROOT/memAgent/cipher.yml"

# Check if session exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "🔔 tmux session '$SESSION_NAME' already running"
else
  echo "🚀 Starting tmux session '$SESSION_NAME' with Cipher MCP server"
  # Export all environment variables from .env to the tmux session
  tmux new-session -d -s "$SESSION_NAME" "cd $PROJECT_ROOT && set -a && source .env && set +a && cipher --agent $AGENT_CONFIG --mode mcp"
  echo "✅ Cipher MCP server started in tmux session '$SESSION_NAME'"
fi
