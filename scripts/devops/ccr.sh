#!/usr/bin/env bash
set -e
set -u
set -o pipefail 2>/dev/null || true

# Detect if the script is sourced (works for bash and zsh)
_CCR_SOURCED=0
if [ -n "${ZSH_VERSION:-}" ]; then
  case ${ZSH_EVAL_CONTEXT:-} in *:file) _CCR_SOURCED=1;; esac
elif [ -n "${BASH_VERSION:-}" ]; then
  if [ "${BASH_SOURCE[0]:-}" != "$0" ]; then _CCR_SOURCED=1; fi
fi

_ccr_fail() {
  local code=${1:-1}
  if [[ $_CCR_SOURCED -eq 1 ]]; then
    return "$code"
  else
    exit "$code"
  fi
}

# Configurable settings via env with sensible defaults
: "${CCR_PORT:=3456}"
: "${CCR_CONFIG_PATH:=$HOME/.claude-code-router/config.json}"
: "${CCR_LOG_PATH:=$HOME/ccr.log}"

echo "[CCR] Using port: $CCR_PORT"
echo "[CCR] Config path: $CCR_CONFIG_PATH"
echo "[CCR] Log path: $CCR_LOG_PATH"

# Ensure bun is available (auto-install if missing)
if ! command -v bun >/dev/null 2>&1; then
  echo "[CCR] bun not found. Installing Bun..."
  # Install Bun
  curl -fsSL https://bun.sh/install | bash
  # Add Bun to PATH for this session
  export PATH="$HOME/.bun/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    echo "[CCR] Failed to install bun. Please install from https://bun.sh and re-run."
    exit 1
  fi
else
  # Ensure PATH includes Bun in case it's a fresh install
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Ensure claude CLI is available (optional but helpful)
if ! command -v claude >/dev/null 2>&1; then
  echo "[CCR] Warning: 'claude' CLI not found in PATH. Install Claude Code CLI if you intend to run it here."
fi

# Optionally create CCR config from env if provided, but do NOT overwrite existing config unless explicitly requested
# Set CCR_OVERWRITE_CONFIG=1 to allow overwriting
if [[ -n "${OPENAI_BASE_URL:-}" && -n "${OPENAI_API_KEY:-}" && -n "${OPENAI_MODEL:-}" ]]; then
  mkdir -p "$(dirname "$CCR_CONFIG_PATH")"
  if [[ ! -f "$CCR_CONFIG_PATH" || "${CCR_OVERWRITE_CONFIG:-0}" == "1" ]]; then
    if [[ -f "$CCR_CONFIG_PATH" ]]; then
      echo "[CCR] Overwriting existing config because CCR_OVERWRITE_CONFIG=1"
    fi
    cat > "$CCR_CONFIG_PATH" <<EOF
{
  "log": true,
  "OPENAI_BASE_URL": "${OPENAI_BASE_URL}",
  "OPENAI_API_KEY": "${OPENAI_API_KEY}",
  "OPENAI_MODEL": "${OPENAI_MODEL}"
}
EOF
    echo "[CCR] Wrote config from env to $CCR_CONFIG_PATH"
  else
    echo "[CCR] Existing config found at $CCR_CONFIG_PATH. Not overwriting. Unset OPENAI_* or set CCR_OVERWRITE_CONFIG=1 to regenerate."
  fi
else
  echo "[CCR] Skipping config write (set OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL to auto-generate)"
  if [[ ! -f "$CCR_CONFIG_PATH" ]]; then
    echo "[CCR] No config file found at $CCR_CONFIG_PATH and no provider env present."
    echo "      Export OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL or create the config file."
  fi
fi

# Kill an existing CCR on the same port (best-effort)
if lsof -iTCP:"$CCR_PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "[CCR] Detected process on port $CCR_PORT; attempting to terminate"
  # shellcheck disable=SC2009
  pids=$(ps aux | grep "claude-code-router" | grep -v grep | awk '{print $2}') || true
  if [[ -n "${pids:-}" ]]; then
    echo "$pids" | xargs -r kill || true
    for i in {1..10}; do
      if lsof -iTCP:"$CCR_PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
        sleep 1
      else
        break
      fi
    done
  fi
fi

# Export env for Claude Code to talk to CCR as early as possible, so they persist even if health fails
export ANTHROPIC_BASE_URL="http://localhost:$CCR_PORT"
# Any string works when routing through CCR
export ANTHROPIC_API_KEY="any-string-is-ok"
echo "[CCR] Exported ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo "[CCR] Exported ANTHROPIC_API_KEY=(hidden)"

# Start CCR
echo "[CCR] Starting Claude Code Router..."
nohup bunx @musistudio/claude-code-router@latest start --port "$CCR_PORT" >"$CCR_LOG_PATH" 2>&1 &
CCR_PID=$!
echo "[CCR] PID: $CCR_PID"

# Wait for health
echo "[CCR] Waiting for health..."
for i in {1..180}; do
  if curl -fsS "http://localhost:$CCR_PORT/health" >/dev/null 2>&1 || curl -fsS "http://localhost:$CCR_PORT" >/dev/null 2>&1; then
    echo "[CCR] Healthy on port $CCR_PORT"
    break
  fi
  sleep 1
  if [[ "$i" == 180 ]]; then
    echo "[CCR] Failed to become healthy. Tail of log:" >&2
    tail -n 200 "$CCR_LOG_PATH" || true
    _ccr_fail 1
  fi
done

if [[ $_CCR_SOURCED -eq 1 ]]; then
  # Sourced: exports persist in current shell
  echo "[CCR] Environment exported to current shell."
else
  # Executed: advise how to persist exports
  echo "[CCR] Note: to persist ANTHROPIC_* exports in your shell, source this script instead:"
  echo "  source scripts/dev/ccr.sh"
  echo "[CCR] Or export manually in your shell:"
  echo "  export ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
  echo "  export ANTHROPIC_API_KEY=any-string-is-ok"
fi

echo "[CCR] Ready. Example next steps:"
echo "  claude code"
echo "  # or switch model in-session: /model openai,\"\$OPENAI_MODEL\""


