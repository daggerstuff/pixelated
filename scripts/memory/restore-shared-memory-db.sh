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
  restore-shared-memory-db.sh --backup-file FILE [--db-path PATH] [--force]

Environment variables:
  HINDSIGHT_LOCAL_DB_PATH  Destination SQLite DB path (default if --db-path omitted)
USAGE
}

BACKUP_FILE=""
DB_PATH="${HINDSIGHT_LOCAL_DB_PATH:-}"
FORCE="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --db-path)
            DB_PATH="$2"
            shift 2
            ;;
        --force)
            FORCE="true"
            shift
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

if [[ -z "${BACKUP_FILE}" ]]; then
    log ERROR "Missing --backup-file."
    usage
    exit 1
fi

if [[ -z "${DB_PATH}" ]]; then
    log ERROR "Missing destination DB path. Set HINDSIGHT_LOCAL_DB_PATH or pass --db-path."
    exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    log ERROR "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

mkdir -p "$(dirname "${DB_PATH}")"

if [[ -f "${DB_PATH}" && "${FORCE}" != "true" ]]; then
    log ERROR "Destination DB already exists: ${DB_PATH}. Re-run with --force."
    exit 1
fi

tmp_restore="$(mktemp "${DB_PATH}.restore.XXXXXX")"

cleanup() {
    rm -f "${tmp_restore}"
}
trap cleanup EXIT

log INFO "Validating backup payload from ${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" > "${tmp_restore}"
else
    cp "${BACKUP_FILE}" "${tmp_restore}"
fi

if ! sqlite3 "${tmp_restore}" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    log ERROR "Integrity check failed for restore payload."
    exit 1
fi

if [[ -f "${DB_PATH}" ]]; then
    mv "${DB_PATH}" "${DB_PATH}.pre-restore.$(date -u +%Y%m%d-%H%M%S).bak"
fi

mv "${tmp_restore}" "${DB_PATH}"
chmod 600 "${DB_PATH}" || true

log INFO "Restore complete: ${DB_PATH}"
