#!/bin/bash
# ============================================================================
# Pixelated Empathy — Backend Health Check
# Probes every backend service and reports green/red.
# Exit 0 if all green, exit 1 if any red.
# ============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Service definitions: name | host | port | path | protocol
SERVICES=(
    "PostgreSQL|localhost|5432||tcp"
    "Redis|localhost|6379||tcp"
    "MongoDB|localhost|27017||tcp"
    "Express API|localhost|5000|/api/health|http"
    "FastAPI Backend|localhost|8000|/health|http"
    "Bias Detection|localhost|8001|/health|http"
    "AI Service|localhost|8002|/health|http"
    "WebSocket Server|localhost|4321|/api/health|http"
    "Prometheus|localhost|9090|/-/healthy|http"
    "Grafana|localhost|3100|/api/health|http"
    "Alertmanager|localhost|9093|/-/healthy|http"
    "Loki|localhost|3101|/ready|http"
)

ALL_HEALTHY=true

printf "+----------------------+----------------------+--------+\n"
printf "| %-20s | %-20s | %-6s |\n" "Service" "Endpoint" "Status"
printf "+----------------------+----------------------+--------+\n"

for svc in "${SERVICES[@]}"; do
    IFS='|' read -r name host port path protocol <<< "$svc"

    if [ "$protocol" = "tcp" ]; then
        endpoint="${host}:${port}"
        if (echo >"/dev/tcp/${host}/${port}") 2>/dev/null; then
            status="${GREEN}GREEN${NC}"
        else
            status="${RED}RED${NC}"
            ALL_HEALTHY=false
        fi
    else
        url="http://${host}:${port}${path}"
        if curl -sf --connect-timeout 3 --max-time 5 "$url" >/dev/null 2>&1; then
            status="${GREEN}GREEN${NC}"
        else
            status="${RED}RED${NC}"
            ALL_HEALTHY=false
        fi
        endpoint="${host}:${port}${path}"
    fi

    printf "| %-20s | %-20s | %b   %-3s|\n" "$name" "$endpoint" "$status" ""
done

printf "+----------------------+----------------------+--------+\n"

if [ "$ALL_HEALTHY" = true ]; then
    printf "%bAll backend services are healthy.%b\n" "$GREEN" "$NC"
    exit 0
else
    printf "%bSome backend services are not responding.%b\n" "$RED" "$NC"
    exit 1
fi
