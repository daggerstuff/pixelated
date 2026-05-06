#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/home/vivi}"
RCLONE_TARGET="${RCLONE_TARGET:-gdrive:vivi-home-backups}"
RCLONE_SYNC_PATH="${RCLONE_SYNC_PATH:-}"
LOCK_FILE_BASE="${HOME:-/home/vivi}"

if [[ "$RCLONE_TARGET" == "drive:vivi-home-backups" ]]; then
  RCLONE_TARGET="gdrive:vivi-home-backups"
fi

# Normalize home context because systemd Environment substitutions can be resolved incorrectly
# in some deployment paths (for example, resolving %h as /root before service user switches).
if [[ -z "${HOME:-}" || ! -d "$HOME" || "$HOME" == "/root" ]]; then
  if [[ -d "/home/vivi" ]]; then
    export HOME="/home/vivi"
  elif [[ "${SOURCE_DIR%/*}" == "/home" && -d "$SOURCE_DIR" ]]; then
    export HOME="$SOURCE_DIR"
  else
    export HOME="/home/$(id -un)"
  fi
fi

LOCK_FILE_BASE="$HOME"
BACKUP_DIR="${BACKUP_DIR:-$HOME/.local/share/home_backups}"
LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_DIR/backup.log}"
LOCK_FILE="${LOCK_FILE_BASE}/.cache/home-vivi-backup.lock"

if [[ -n "${RCLONE_CONFIG:-}" && ! -r "$RCLONE_CONFIG" ]]; then
  RCLONE_CONFIG=""
fi

if [[ -z "${RCLONE_CONFIG:-}" ]]; then
  if [[ -r "${HOME}/.config/rclone/rclone.conf" ]]; then
    export RCLONE_CONFIG="${HOME}/.config/rclone/rclone.conf"
  elif [[ "${SOURCE_DIR%/*}" == "/home" && -r "${SOURCE_DIR}/.config/rclone/rclone.conf" ]]; then
    export RCLONE_CONFIG="${SOURCE_DIR}/.config/rclone/rclone.conf"
    export HOME="$SOURCE_DIR"
    LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_DIR/backup.log}"
    LOCK_FILE="${HOME}/.cache/home-vivi-backup.lock"
  fi
fi

if [[ -z "${RCLONE_CONFIG:-}" || ! -r "$RCLONE_CONFIG" ]]; then
  echo "Unable to locate a readable rclone config file for backup upload." >&2
  echo "Expected one of:" >&2
  echo "  ${HOME}/.config/rclone/rclone.conf" >&2
  [[ "${SOURCE_DIR%/*}" == "/home" ]] && echo "  ${SOURCE_DIR}/.config/rclone/rclone.conf" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
mkdir -p "$SOURCE_DIR"

log() {
  printf '%s [backup] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

if ! command -v rclone >/dev/null 2>&1; then
  log "rclone is required but not available"
  exit 1
fi

if [[ "$RCLONE_TARGET" == *:* ]]; then
  RCLONE_REMOTE="${RCLONE_TARGET%%:*}"
else
  RCLONE_REMOTE=""
fi
if [[ -z "$RCLONE_REMOTE" ]]; then
  log "Invalid RCLONE_TARGET value '$RCLONE_TARGET'. Expected format remote:path"
  exit 1
fi

if ! rclone listremotes | grep -Fxq "${RCLONE_REMOTE}:"; then
  log "Rclone remote '$RCLONE_REMOTE' is not configured"
  log "Run 'rclone config' as user 'vivi' and then retry."
  exit 1
fi

if [[ -n "$RCLONE_SYNC_PATH" ]]; then
  if [[ "$RCLONE_TARGET" == *: ]]; then
    RCLONE_DEST="$RCLONE_TARGET/$RCLONE_SYNC_PATH"
  else
    RCLONE_DEST="${RCLONE_TARGET%/}/$RCLONE_SYNC_PATH"
  fi
else
  RCLONE_DEST="$RCLONE_TARGET"
fi

cleanup_lock() {
  if [ -n "${lock_acquired:-}" ] && [ -f "$LOCK_FILE" ]; then
    flock -u 9 || true
    rm -f "$LOCK_FILE"
  fi
}

trap cleanup_lock EXIT

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another backup is already running, exiting"
  exit 0
fi
lock_acquired=true

mapfile -t RCLONE_COPY_ARGS < <(printf '%s\n' \
  "--checksum" \
  "--create-empty-src-dirs" \
  "--transfers" "8" \
  "--checkers" "16" \
  "--ignore-errors" \
  "--skip-links" \
  "--retries" "5" \
  "--low-level-retries" "10" \
  "--exclude" ".cache/**" \
  "--exclude" ".cursor/**" \
  "--exclude" ".cursor-server/**" \
  "--exclude" ".codex/**" \
  "--exclude" "**/.cache/**" \
  "--exclude" "*.sock" \
  "--exclude" "**/terminals/**" \
  "--exclude" ".local/share/zed/**" \
  "--exclude" ".local/share/home_backups/**" \
  "--exclude" ".claude-mem/**" \
  "--exclude" ".cache/home-vivi-backup.lock" \
  "--exclude" "**/node_modules/**" \
  "--exclude" "**/.venv/**")

log "Starting incremental stream sync from ${SOURCE_DIR} to ${RCLONE_DEST}"
rclone copy "$SOURCE_DIR" "$RCLONE_DEST" "${RCLONE_COPY_ARGS[@]}"
log "Incremental stream sync completed successfully"

if ! rclone touch "${RCLONE_DEST}/.meta/last-successful-run-marker" >/dev/null 2>&1; then
  if ! printf '%s\n' "$(date -Iseconds)" | rclone rcat "${RCLONE_DEST}/.meta/last-successful-run-marker"; then
    log "Failed to write sync marker, but backup stream completed."
  fi
fi

log "Backup completed successfully"
