#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
PROXY_SCRIPT="$PROJECT_DIR/scripts/proxy/nim-proxy.mjs"
PROXY_PID_FILE="$PROJECT_DIR/.nim-proxy.pid"
PROXY_PORT=8080
NIM_DIRECT="https://integrate.api.nvidia.com/v1"
NIM_PROXY="http://127.0.0.1:${PROXY_PORT}/v1"

is_proxy_running() {
  [ -f "$PROXY_PID_FILE" ] && ps -p "$(cat "$PROXY_PID_FILE")" >/dev/null 2>&1
}

start_proxy() {
  if is_proxy_running; then
    echo "Proxy already running on port $PROXY_PORT"
    return
  fi
  nohup node "$PROXY_SCRIPT" > "$PROJECT_DIR/.nim-proxy.log" 2>&1 &
  echo $! > "$PROXY_PID_FILE"
  sleep 1
  if ! is_proxy_running; then
    echo "Failed to start proxy"
    exit 1
  fi
  echo "Proxy started (pid $(cat "$PROXY_PID_FILE"))"
}

stop_proxy() {
  if is_proxy_running; then
    kill "$(cat "$PROXY_PID_FILE")" || true
    rm -f "$PROXY_PID_FILE"
    echo "Proxy stopped"
  else
    echo "Proxy not running"
  fi
}

set_direct() {
  stop_proxy >/dev/null 2>&1 || true
  if [ -f "$ENV_FILE" ]; then
    sed -i "s|^NIM_BASE_URL=.*|NIM_BASE_URL=${NIM_DIRECT}|" "$ENV_FILE" || echo "NIM_BASE_URL=${NIM_DIRECT}" >> "$ENV_FILE"
    sed -i "s|^NVIDIA_BASE_URL=.*|NVIDIA_BASE_URL=${NIM_DIRECT}|" "$ENV_FILE" || echo "NVIDIA_BASE_URL=${NIM_DIRECT}" >> "$ENV_FILE"
  else
    echo "NIM_BASE_URL=${NIM_DIRECT}" > "$ENV_FILE"
    echo "NVIDIA_BASE_URL=${NIM_DIRECT}" >> "$ENV_FILE"
  fi
  echo "Switched Cursor NIM target to direct: $NIM_DIRECT"
}

set_proxied() {
  start_proxy
  if [ -f "$ENV_FILE" ]; then
    sed -i "s|^NIM_BASE_URL=.*|NIM_BASE_URL=${NIM_PROXY}|" "$ENV_FILE" || echo "NIM_BASE_URL=${NIM_PROXY}" >> "$ENV_FILE"
    sed -i "s|^NVIDIA_BASE_URL=.*|NVIDIA_BASE_URL=${NIM_PROXY}|" "$ENV_FILE" || echo "NVIDIA_BASE_URL=${NIM_PROXY}" >> "$ENV_FILE"
  else
    echo "NIM_BASE_URL=${NIM_PROXY}" > "$ENV_FILE"
    echo "NVIDIA_BASE_URL=${NIM_PROXY}" >> "$ENV_FILE"
  fi
  echo "Switched Cursor NIM target to proxy: $NIM_PROXY"
}

status() {
  if is_proxy_running; then
    echo "Proxy running on http://127.0.0.1:${PROXY_PORT}"
  else
    echo "Proxy not running"
  fi
  echo "Current .env NIM settings:"
  grep -E '^(NIM_BASE_URL|NVIDIA_BASE_URL)=' "$ENV_FILE" 2>/dev/null || true
}

case "${1:-}" in
  direct)
    set_direct
    ;;
  proxy)
    set_proxied
    ;;
  stop)
    stop_proxy
    ;;
  start)
    start_proxy
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {direct|proxy|start|stop|status}"
    exit 1
    ;;
esac
