#!/usr/bin/env bash

set -euo pipefail

timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
    local level="$1"
    shift
    echo "[$(timestamp)] [${level}] $*" >&2
}

usage() {
    cat <<'USAGE'
Usage:
  monitor-shared-memory-service.sh [--health-url URL] [--db-path PATH] [--warn-disk-percent N]

Environment variables:
  MEMORY_HEALTH_URL           Health endpoint (default: http://127.0.0.1:54321/health)
  HINDSIGHT_LOCAL_DB_PATH     SQLite DB path used for disk checks
  MEMORY_DISK_WARN_PERCENT    Disk usage warning threshold (default: 85)
USAGE
}

HEALTH_URL="${MEMORY_HEALTH_URL:-http://127.0.0.1:54321/health}"
DB_PATH="${HINDSIGHT_LOCAL_DB_PATH:-}"
WARN_DISK_PERCENT="${MEMORY_DISK_WARN_PERCENT:-85}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --health-url)
            HEALTH_URL="$2"
            shift 2
            ;;
        --db-path)
            DB_PATH="$2"
            shift 2
            ;;
        --warn-disk-percent)
            WARN_DISK_PERCENT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage
            exit 2
            ;;
    esac
done

if ! [[ "${WARN_DISK_PERCENT}" =~ ^[0-9]+$ ]] || (( WARN_DISK_PERCENT < 1 || WARN_DISK_PERCENT > 99 )); then
    log ERROR "MEMORY_DISK_WARN_PERCENT must be an integer between 1 and 99."
    exit 1
fi

if ! curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" >/dev/null; then
    log ERROR "Health check failed: ${HEALTH_URL}"
    exit 1
fi
log INFO "Health check passed: ${HEALTH_URL}"

if [[ -n "${DB_PATH}" ]]; then
    db_dir="$(dirname "${DB_PATH}")"
    if [[ ! -d "${db_dir}" ]]; then
        log ERROR "DB directory does not exist: ${db_dir}"
        exit 1
    fi
    disk_percent="$(df -P "${db_dir}" | awk 'NR==2 {gsub("%","",$5); print $5}')"
    if [[ -z "${disk_percent}" || ! "${disk_percent}" =~ ^[0-9]+$ ]]; then
        log ERROR "Unable to read disk usage for ${db_dir}"
        exit 1
    fi
    if (( disk_percent >= WARN_DISK_PERCENT )); then
        log ERROR "Disk usage ${disk_percent}% exceeds threshold ${WARN_DISK_PERCENT}% for ${db_dir}"
        exit 1
    fi
    log INFO "Disk usage healthy: ${disk_percent}% on ${db_dir}"
fi
