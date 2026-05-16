#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

if [[ $# -eq 0 ]]; then
  cat <<'EOF'
Usage: ccr-safe-run.sh <command...>

Runs a command through a cleaned Claude Code Router environment.
This wrapper:
- Kills stale CCR code-mode helper processes,
- Forces a long API timeout value used by the toolchain,
- Restores non-interactive mode,
- Ensures CCR is running.
EOF
  exit 1
fi

export API_TIMEOUT_MS=1800000
export NON_INTERACTIVE_MODE=true
unset CLAUDE_CODE_USE_BEDROCK 2>/dev/null || true

# Clean up stale long-running code-mode wrapper processes that can keep old state.
pkill -f "dist/cli.js code --dangerously-skip-permissions --continue" || true

# Ensure ccr service is available for routing.
if command -v ccr >/dev/null 2>&1; then
  if ! ccr status 2>/dev/null | grep -q "Status: Running"; then
    ccr start || ccr restart
  fi
fi

export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-http://127.0.0.1:3456}"
export NO_PROXY="${NO_PROXY:-127.0.0.1}"
export DISABLE_TELEMETRY="${DISABLE_TELEMETRY:-true}"
export DISABLE_COST_WARNINGS="${DISABLE_COST_WARNINGS:-true}"

# Keep this output for visibility when the wrapper is used interactively.
echo "ccr-safe-run: API_TIMEOUT_MS=${API_TIMEOUT_MS}"
echo "ccr-safe-run: ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"

cd "$REPO_ROOT"
exec "$@"
