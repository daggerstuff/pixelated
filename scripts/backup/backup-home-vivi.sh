#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/home/vivi}"
BACKUP_DIR="${BACKUP_DIR:-/home/vivi/.local/share/home_backups}"
RCLONE_TARGET="${RCLONE_TARGET:-drive:vivi-home-backups}"
RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-2}"
LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_DIR/backup.log}"
LOCK_FILE="${HOME}/.cache/home-vivi-backup.lock"

if [[ -z "${RCLONE_CONFIG:-}" ]]; then
  if [[ -f "${HOME}/.config/rclone/rclone.conf" ]]; then
    export RCLONE_CONFIG="${HOME}/.config/rclone/rclone.conf"
  elif [[ "${SOURCE_DIR%/*}" == "/home" && -f "${SOURCE_DIR}/.config/rclone/rclone.conf" ]]; then
    # Fallback for service contexts that run as root with an unexpected HOME.
    # Keep this local-only and safe for this project's conventions.
    export RCLONE_CONFIG="${SOURCE_DIR}/.config/rclone/rclone.conf"
    export HOME="${SOURCE_DIR}"
  fi
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
mkdir -p "$SOURCE_DIR"

log() {
  printf '%s [backup] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

if ! command -v tar >/dev/null 2>&1; then
  log "tar is required but not available"
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  log "rclone is required but not available"
  exit 1
fi

if ! [[ "$RETENTION_COUNT" =~ ^[0-9]+$ ]] || [ "$RETENTION_COUNT" -lt 1 ]; then
  log "BACKUP_RETENTION_COUNT must be an integer >= 1"
  exit 1
fi

cleanup_local_debris() {
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'home-vivi-*.tar.gz.incomplete' -o -name 'home-vivi-*.part' \) -delete
}

cleanup_staging() {
  if [ -n "${backup_tmp:-}" ] && [ -f "$backup_tmp" ]; then
    rm -f "$backup_tmp"
  fi
}

# Prune orphaned tarballs at startup (regardless of previous upload status)
prune_orphaned_backups() {
  local count
  count=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'home-vivi-*.tar.gz' 2>/dev/null | wc -l)
  if [ "$count" -gt "$RETENTION_COUNT" ]; then
    log "Found $count local backups (retention: $RETENTION_COUNT). Pruning orphaned tarballs..."
    mapfile -t old_backups < <(ls -1t "$BACKUP_DIR"/home-vivi-*.tar.gz 2>/dev/null || true)
    for ((i = RETENTION_COUNT; i < ${#old_backups[@]}; i++)); do
      rm -f "${old_backups[$i]}"
      log "Removed orphaned backup: ${old_backups[$i]}"
    done
  fi
}

cleanup_local_debris
prune_orphaned_backups

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another backup is already running, exiting"
  exit 0
fi

trap 'cleanup_staging' EXIT

timestamp="$(date +'%Y%m%d-%H%M%S')"
backup_base="home-vivi-${timestamp}"
backup_file="$BACKUP_DIR/${backup_base}.tar.gz"
backup_tmp="${backup_file}.incomplete"

log "Creating archive: $backup_file"
if ! tar -C "$SOURCE_DIR" -czf "$backup_tmp" \
  --exclude='./.local/share/home_backups' \
  --exclude='./.cache/home-vivi-backup.lock' \
  --ignore-failed-read \
  --warning=no-file-changed \
  --warning=no-file-removed \
  --exclude='*/node_modules' \
  --exclude='*/.venv' \
  .; then
  tar_rc=$?
  if [ "$tar_rc" -ne 1 ]; then
    log "tar failed with exit code $tar_rc"
    exit "$tar_rc"
  fi
  log "tar finished with warnings (exit code 1), continuing"
fi
mv "$backup_tmp" "$backup_file"

log "Uploading archive to ${RCLONE_TARGET}"
rclone_remote="${RCLONE_TARGET%%:*}"
if [ "$rclone_remote" = "$RCLONE_TARGET" ]; then
  log "Invalid RCLONE_TARGET value '$RCLONE_TARGET'. Expected format remote:path"
  exit 1
fi

if ! rclone listremotes | grep -Fxq "${rclone_remote}:"; then
  log "Rclone remote '$rclone_remote' is not configured"
  log "Run 'rclone config' as user 'vivi' and then retry."
  exit 1
fi

rclone copy "$backup_file" "$RCLONE_TARGET"

log "Pruning local backups to keep last ${RETENTION_COUNT}"
mapfile -t backup_candidates < <(ls -1t "$BACKUP_DIR"/home-vivi-*.tar.gz 2>/dev/null || true)
for ((i = RETENTION_COUNT; i < ${#backup_candidates[@]}; i++)); do
  stale="${backup_candidates[$i]}"
  rm -f "$stale"
done

if (( ${#backup_candidates[@]} > RETENTION_COUNT )); then
  log "Removed local backup debris beyond retention count"
fi

cleanup_local_debris

log "Pruning remote backups in ${RCLONE_TARGET} to keep last ${RETENTION_COUNT}"
rclone lsf "${RCLONE_TARGET%/}" --files-only --format p \
  | grep -E '^home-vivi-[0-9]{8}-[0-9]{6}\.tar\.gz$' \
  | sort \
  | head -n "-$RETENTION_COUNT" \
  | while IFS= read -r stale; do
    [ -z "$stale" ] && continue
    rclone delete "${RCLONE_TARGET%/}/$stale"
    log "Deleted remote backup: $stale"
  done

cleanup_local_debris

log "Backup completed successfully"
