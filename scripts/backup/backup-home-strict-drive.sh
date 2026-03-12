#!/usr/bin/env bash
set -euo pipefail

# Config
SRC_DIR="/home/vivi"
DEST_BASE="drive:backups/vivi"
EXCLUDE_FILE="$HOME/.config/rclone/home-backup-excludes.txt"
LOCK_FILE="$HOME/.local/run/rclone-home-backup.lock"
LOG_DIR="$HOME/.local/share/rclone-backups"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST_DIR="${DEST_BASE}/home-${STAMP}-strict-final"
KEEP_BACKUPS=3

mkdir -p "$HOME/.config/rclone"
mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$LOCK_FILE")"

cat <<'EXCLUDES' > "$EXCLUDE_FILE"
**/node_modules/**
**/.pnpm-store/**
**/.npm/**
**/.npm/_cacache/**
**/.yarn/**
**/.venv/**
**/venv/**
**/.virtualenvs/**
**/__pycache__/**
**/.pytest_cache/**
**/.mypy_cache/**
**/.tox/**
**/.cache/**
**/.cache/pip/**
**/.cache/uv/**
**/.cache/pypoetry/**
EXCLUDES

# Log with one file per day
LOG_FILE="${LOG_DIR}/home-backup-$(date +%F).log"

{
  echo ""
  echo "===== $(date -Is) : Starting /home backup ====="
  echo "Source: ${SRC_DIR}"
  echo "Destination: ${DEST_DIR}"
  echo "Exclude file: ${EXCLUDE_FILE}"

  # Prevent overlapping backups
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    echo "Another backup is already running; skipping this schedule tick"
    exit 0
  fi

  rclone copy "$SRC_DIR" "$DEST_DIR" \
    --stats 60s \
    --transfers 16 \
    --checkers 32 \
    --progress \
    --exclude-from "$EXCLUDE_FILE"

  # Keep only the latest 3 backup directories for this machine (by remote
  # directory modification time).
  mapfile -t BACKUP_DIRS < <(
    rclone lsjson --dirs-only "$DEST_BASE" |
      jq -r '.[] | select(.IsDir == true and (.Name | startswith("home-"))) | .ModTime + " " + .Name' |
      sort
  )

  if (( ${#BACKUP_DIRS[@]} > KEEP_BACKUPS )); then
    remove_count=$(( ${#BACKUP_DIRS[@]} - KEEP_BACKUPS ))
    echo "===== $(date -Is) : Retention cleanup: removing ${remove_count} old backup directories ====="
    for ((i = 0; i < remove_count; i++)); do
      BACKUP_ENTRY="${BACKUP_DIRS[$i]}"
      OLD_MOD="${BACKUP_ENTRY%% *}"
      OLD_NAME="${BACKUP_ENTRY#* }"
      OLD_DIR="${DEST_BASE}/${OLD_NAME}"
      echo "  removing ${OLD_DIR} (${OLD_MOD})"
      rclone purge "$OLD_DIR"
    done
  fi

  echo "===== $(date -Is) : Backup complete ====="
} >> "$LOG_FILE" 2>&1
