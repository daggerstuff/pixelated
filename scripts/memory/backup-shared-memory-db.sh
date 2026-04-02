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
  backup-shared-memory-db.sh [--db-path PATH] [--backup-dir DIR] [--retention-days N]

Environment variables:
  HINDSIGHT_LOCAL_DB_PATH   Source SQLite DB path (default if --db-path omitted)
  MEMORY_BACKUP_DIR         Backup output directory (default: /var/backups/pixelated-memory)
  MEMORY_BACKUP_RETENTION_DAYS  Retention days (default: 14)
USAGE
}

DB_PATH="${HINDSIGHT_LOCAL_DB_PATH:-}"
BACKUP_DIR="${MEMORY_BACKUP_DIR:-/var/backups/pixelated-memory}"
RETENTION_DAYS="${MEMORY_BACKUP_RETENTION_DAYS:-14}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db-path)
            DB_PATH="$2"
            shift 2
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --retention-days)
            RETENTION_DAYS="$2"
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

if [[ -z "${DB_PATH}" ]]; then
    log ERROR "Missing DB path. Set HINDSIGHT_LOCAL_DB_PATH or pass --db-path."
    exit 1
fi

if [[ ! -f "${DB_PATH}" ]]; then
    log ERROR "SQLite DB does not exist: ${DB_PATH}"
    exit 1
fi

if ! [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
    log ERROR "Retention must be an integer: ${RETENTION_DAYS}"
    exit 1
fi

mkdir -p "${BACKUP_DIR}"

source_base="$(basename "${DB_PATH}")"
stamp="$(date -u +%Y%m%d-%H%M%S)"
raw_backup="${BACKUP_DIR}/${source_base}.${stamp}.sqlite3"
gz_backup="${raw_backup}.gz"

log INFO "Creating SQLite online backup from ${DB_PATH} to ${raw_backup}"
sqlite3 "${DB_PATH}" ".timeout 5000" ".backup '${raw_backup}'"

log INFO "Compressing backup ${raw_backup}"
gzip -f "${raw_backup}"

log INFO "Pruning backups older than ${RETENTION_DAYS} days from ${BACKUP_DIR}"
if ! find "${BACKUP_DIR}" -type f -name "${source_base}.*.sqlite3.gz" -mtime +"${RETENTION_DAYS}" -print -delete >&2; then
    log WARN "Backup pruning encountered errors and was not fully completed."
fi

if [[ ! -f "${gz_backup}" ]]; then
    log ERROR "Expected backup artifact missing: ${gz_backup}"
    exit 1
fi

log INFO "Backup complete: ${gz_backup}"
