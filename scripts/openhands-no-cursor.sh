#!/usr/bin/env bash
# Wrapper script to run OpenHands without reading Cursor's MCP config

set -euo pipefail

OPENHANDS_BIN="$HOME/Downloads/openhands"

if [ ! -f "$OPENHANDS_BIN" ]; then
  echo "❌ OpenHands binary not found at $OPENHANDS_BIN"
  exit 1
fi

# Temporarily rename Cursor's MCP config so OpenHands can't find it
CURSOR_MCP="$HOME/pixelated/.cursor/mcp.json"
CURSOR_MCP_BACKUP="${CURSOR_MCP}.openhands-temp"

if [ -f "$CURSOR_MCP" ]; then
  echo "🔒 Temporarily hiding Cursor's MCP config from OpenHands..."
  mv "$CURSOR_MCP" "$CURSOR_MCP_BACKUP"
  trap "mv '$CURSOR_MCP_BACKUP' '$CURSOR_MCP' 2>/dev/null || true" EXIT
fi

# Also check for global Cursor config
GLOBAL_CURSOR_MCP="$HOME/.cursor/mcp.json"
GLOBAL_CURSOR_MCP_BACKUP="${GLOBAL_CURSOR_MCP}.openhands-temp"

if [ -f "$GLOBAL_CURSOR_MCP" ]; then
  echo "🔒 Temporarily hiding global Cursor MCP config from OpenHands..."
  mv "$GLOBAL_CURSOR_MCP" "$GLOBAL_CURSOR_MCP_BACKUP"
  trap "mv '$GLOBAL_CURSOR_MCP_BACKUP' '$GLOBAL_CURSOR_MCP' 2>/dev/null || true" EXIT
fi

echo "✅ Running OpenHands (Cursor MCP configs hidden)..."
echo ""

# Run OpenHands
exec "$OPENHANDS_BIN" "$@"

