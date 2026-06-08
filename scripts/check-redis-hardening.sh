#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REDIS_FILES=(
  "$ROOT_DIR/k8s/base/redis-deployment.yaml"
  "$ROOT_DIR/docker/docker-compose.yml"
  "$ROOT_DIR/docker/docker-compose.dev.yml"
  "$ROOT_DIR/docker/docker-compose.db.yml"
  "$ROOT_DIR/docker/docker-compose.production.yml"
  "$ROOT_DIR/docker/docker-compose.prod.yml"
  "$ROOT_DIR/docker/docker-compose.training.yml"
  "$ROOT_DIR/business-strategy-cms/docker-compose.yml"
  "$ROOT_DIR/business-strategy-cms/aws-ecs/docker-compose.aws.yml"
  "$ROOT_DIR/ai/docker/phase1-services.docker-compose.yaml"
  "$ROOT_DIR/src/lib/ai/bias-detection/python-service/docker-compose.yml"
  "$ROOT_DIR/src/lib/ai/multimodal-bias-detection/python-service/docker-compose.yml"
  "$ROOT_DIR/scripts/redis.sh"
)

failures=0

fail() {
  printf '%sFAIL:%s %s\n' "$RED" "$NC" "$1"
  failures=$((failures + 1))
}

ok() {
  printf '%sPASS:%s %s\n' "$GREEN" "$NC" "$1"
}

warn() {
  printf '%sWARN:%s %s\n' "$YELLOW" "$NC" "$1"
}

check_file() {
  local file="$1"
  local rel="${file#$ROOT_DIR/}"

  echo -e "\nChecking: $rel"

  if ! rg -q "redis-server" "$file"; then
    warn "No redis-server invocation found; skipping hardening pattern checks."
    return
  fi

  # Accept either inline --requirepass or Docker secrets-based password (more secure)
  if rg -q --fixed-strings -- "--requirepass" "$file" || \
     rg -q --fixed-strings -- "REDIS_PASSWORD_FILE" "$file" || \
     rg -q --fixed-strings -- "/run/secrets/redis-password" "$file"; then
    ok "$rel has requirepass"
  else
    fail "$rel missing --requirepass in redis command"
  fi

  if ! rg -q --fixed-strings -- "--protected-mode yes" "$file"; then
    fail "$rel missing protected-mode yes"
  else
    ok "$rel has protected-mode yes"
  fi

  if ! rg -q --fixed-strings -- "--bind 0.0.0.0" "$file"; then
    fail "$rel missing explicit bind 0.0.0.0 in redis-server command"
  else
    ok "$rel has explicit bind 0.0.0.0"
  fi

  if rg -q --pcre2 -- "[\"']?[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+:[0-9]+:6379[\"']?" "$file"; then
    if ! rg -q --pcre2 -- "['\"]?127\\.0\\.0\\.1:[0-9]+:6379['\"]?" "$file" && \
       ! rg -q --pcre2 -- "\\[::1\\]:[0-9]+:6379" "$file"; then
      fail "$rel exposes Redis port mapping to non-loopback host interface (e.g. 0.0.0.0)"
    else
      ok "$rel redis host mapping (if present) remains loopback-only"
    fi
  fi

  if rg -q --pcre2 -- "\$\{REDIS_PASSWORD:[^}]+\}" "$file" && \
     ! rg -q --fixed-strings -- '${REDIS_PASSWORD:?REDIS_PASSWORD is required}' "$file"; then
    fail "$rel uses a non-strict REDIS_PASSWORD interpolation"
  fi
}

for file in "${REDIS_FILES[@]}"; do
  if [ -f "$file" ]; then
    check_file "$file"
  else
    warn "Missing file: $file"
  fi
done

if [ "$failures" -ne 0 ]; then
  echo -e "\n${RED}Redis hardening audit FAILED ($failures checks).${NC}"
  echo "Run this script after hardening changes before deployment."
  exit 1
fi

echo -e "\n${GREEN}Redis hardening audit passed.${NC}"
