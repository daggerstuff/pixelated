#!/bin/bash
# health-check.sh — Dev service port liveness check
# Usage: scripts/dev/health-check.sh [--quiet]
# Exit 0 if ALL ports open, 1 otherwise.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

declare -A PORTS=(
  [5173]="Astro (pixelated dev server)"
  [27017]="MongoDB (pixelated-mongo)"
  [6379]="Redis (pixelated-redis)"
  [5432]="PostgreSQL (pixelated-postgres)"
)

declare -A RECOVERY=(
  [5173]="Start with: pnpm dev"
  [27017]="Start with: sudo docker compose -f docker/docker-compose.local-mongo.yml up -d"
  [6379]="Start with: sudo docker compose -f docker/docker-compose.db.yml up -d redis"
  [5432]="Start with: sudo docker compose -f docker/docker-compose.db.yml up -d postgres"
)

FAILED=false

for PORT in "${!PORTS[@]}"; do
  if timeout 1 bash -c "echo > /dev/tcp/127.0.0.1/$PORT" 2>/dev/null; then
    $QUIET || printf "${GREEN}[✅]${NC} Port %-5s — %s\n" "$PORT" "${PORTS[$PORT]}"
  else
    FAILED=true
    $QUIET && continue
    printf "${RED}[❌]${NC} Port %-5s — %s\n" "$PORT" "${PORTS[$PORT]}"
    printf "     ${YELLOW}→${NC} %s\n" "${RECOVERY[$PORT]}"
  fi
done

if ! $FAILED; then
  $QUIET || printf "\n${GREEN}All dev services healthy.${NC}\n"
  exit 0
else
  $QUIET || printf "\n${RED}Some dev services are down. See recovery instructions above.${NC}\n"
  exit 1
fi
