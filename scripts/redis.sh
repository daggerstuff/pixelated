#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="pixelated-redis"
LOCAL_IMAGE="redis:7-alpine"
REDIS_TEST_CMD=(
  pnpm
  vitest
  -c
  config/vitest.config.ts
  src/lib/services/redis/__tests__/RedisService.test.ts
  --coverage.enabled=false
)

load_env_file() {
  if [ -f ".env" ]; then
    # shellcheck disable=SC1090
    set -a
    source ".env"
    set +a
  fi
}

load_env_file

usage() {
  cat <<'EOF'
Usage:
  ./scripts/redis.sh local [command...]
  ./scripts/redis.sh remote [command...]
  ./scripts/redis.sh start
  ./scripts/redis.sh ping
  ./scripts/redis.sh health

Examples:
  ./scripts/redis.sh start
  ./scripts/redis.sh local
  ./scripts/redis.sh remote vitest src/lib/services/redis/__tests__/Analytics.integration.test.ts
EOF
}

ensure_local_redis_running() {
  local redis_password="${REDIS_PASSWORD:?REDIS_PASSWORD is required for local Redis startup}"

  if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    return 0
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker start "$CONTAINER_NAME" >/dev/null
  else
    docker run -d \
      --name "$CONTAINER_NAME" \
      -p 127.0.0.1:6379:6379 \
      "$LOCAL_IMAGE" \
      redis-server --bind 0.0.0.0 --appendonly yes --requirepass "$redis_password" --protected-mode yes >/dev/null
  fi
}

run_with_mode() {
  local mode="$1"
  shift

  local command=("$@")

  if [ "${#command[@]}" -eq 0 ]; then
    command=("${REDIS_TEST_CMD[@]}")
  fi

  if [ "$mode" = "local" ]; then
    ensure_local_redis_running
    local redis_password="${REDIS_PASSWORD:?REDIS_PASSWORD is required for local Redis testing}"
    SKIP_REDIS_TESTS=false \
      REDIS_URL="redis://:${redis_password}@127.0.0.1:6379" \
      "${command[@]}"
  else
    if [ -z "${REDIS_URL_REMOTE:-}" ]; then
      echo "REDIS_URL_REMOTE is not configured." >&2
      exit 1
    fi
    SKIP_REDIS_TESTS=false \
      REDIS_URL="$REDIS_URL_REMOTE" \
      "${command[@]}"
  fi
}

case "${1-}" in
  local)
    shift
    run_with_mode local "$@"
    ;;
  remote)
    shift
    run_with_mode remote "$@"
    ;;
  start)
    ensure_local_redis_running
    echo "Redis local started: $CONTAINER_NAME"
    ;;
  ping)
    ensure_local_redis_running
    docker exec "$CONTAINER_NAME" redis-cli ping
    ;;
  health)
    ensure_local_redis_running
    docker exec "$CONTAINER_NAME" redis-cli INFO SERVER | head -n 5
    ;;
  *)
    usage
    exit 1
    ;;
esac
