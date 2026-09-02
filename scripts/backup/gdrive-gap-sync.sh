#!/usr/bin/env bash
# gdrive-gap-sync.sh
# ---------------------------------------------------------------------------
# Copies everything that the sectioned backup SKIPS (package dirs, AI tool
# dirs, .local, .config, etc.) to Google Drive via rclone copy.
#
# Target: gdrive:backups/home-vivi-gaps/
#
# This is an rsync-style incremental copy (rclone copy), NOT a tarball.
# Re-running is safe — only changed/new files are transferred.
# ---------------------------------------------------------------------------
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/home/vivi}"
GDRIVE_TARGET="gdrive:backups/home-vivi-gaps"
RCLONE_CONFIG="${RCLONE_CONFIG:-/home/vivi/.config/rclone/rclone.conf}"
RCLONE_TRANSFERS="${RCLONE_TRANSFERS:-16}"
RCLONE_CHECKERS="${RCLONE_CHECKERS:-16}"
LOG_FILE="${LOG_FILE:-/home/vivi/.local/share/home_backups/gdrive-gap-sync.log}"

log() {
  printf '%s [gap-sync] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

mkdir -p "$(dirname "$LOG_FILE")"
log "====== Starting gap sync to ${GDRIVE_TARGET} ======"
log "Source: ${SOURCE_DIR}"

# ---------------------------------------------------------------------------
# Exclusion filters:
# These match the 'full' mode exclusions in backup-home-vivi.sh, extended
# to also drop large package manager / build cache dirs that are safely
# reproducible.
# ---------------------------------------------------------------------------
RCLONE_FILTER_ARGS=(
  # Build artifacts / caches (safely reproducible)
  "--exclude=**/.cache/**"
  "--exclude=**/.npm/**"
  "--exclude=**/.pnpm-store/**"
  "--exclude=**/.yarn/cache/**"
  "--exclude=**/.gradle/**"
  "--exclude=**/.cargo/registry/**"
  "--exclude=**/.cargo/git/**"
  "--exclude=**/.rustup/toolchains/**"          # ~10GB+ of toolchains
  "--exclude=**/.rustup/downloads/**"
  "--exclude=**/node_modules/**"
  "--exclude=**/.venv/**"
  "--exclude=**/.virtualenvs/**"
  "--exclude=**/venv/**"
  "--exclude=**/dist/**"
  "--exclude=**/build/**"
  "--exclude=**/.next/**"
  "--exclude=**/.turbo/**"
  "--exclude=**/coverage/**"
  "--exclude=**/target/**"                      # Rust build output
  "--exclude=**/__pycache__/**"
  "--exclude=**/.pyc"
  # Large ephemeral / runtime dirs
  "--exclude=.local/share/Trash/**"
  "--exclude=.local/share/home_backups/**"
  "--exclude=.local/share/zed/**"
  "--exclude=.cache/**"
  "--exclude=.cache/pip/**"
  "--exclude=.cache/ms-playwright/**"
  "--exclude=.cache/Code/**"
  "--exclude=.cache/google-chrome/**"
  "--exclude=.cache/gh/**"
  "--exclude=.cache/huggingface/*"
  "--exclude=.tmp/**"
  "--exclude=tmp/**"
  "--exclude=.Trash/**"
  "--exclude=.Trash-1000/**"
  # Sockets / locks
  "--exclude=*.sock"
  "--exclude=*.lock"
  "--exclude=.cache/home-vivi-backup.lock"
  # Cursor/Claude/AI IDE caches (large, ephemeral)
  "--exclude=.cursor-server/**"
  "--exclude=.vscode-server/**"
  "--exclude=.vscode-server-insiders/**"
  "--exclude=.codex/**"
  "--exclude=.codeql/**"
  "--exclude=.gemini/**"
  "--exclude=.gemini-*/**"
  "--exclude=.antigravity-server/**"
  "--exclude=.antigravity-ide-server/**"
  "--exclude=.kube/cache/**"
  # Log noise
  "--exclude=**/*.log"
  # Specific oversized file known to cause issues
  "--exclude=pixelated/apps/web/src/lib/deployment/multi-region/ServiceDiscoveryManager.ts"
  # Git objects (large, reconstructable from remote)
  "--exclude=**/.git/objects/**"
)

RCLONE_COMMON_ARGS=(
  "--config=${RCLONE_CONFIG}"
  "--transfers=${RCLONE_TRANSFERS}"
  "--checkers=${RCLONE_CHECKERS}"
  "--fast-list"
  "--stats=15s"
  "--stats-one-line"
  "--log-level=INFO"
  "--log-file=${LOG_FILE}"
  "--create-empty-src-dirs"
  "--ignore-errors"          # Don't abort on permission errors / sockets
)

log "Rclone transfers=${RCLONE_TRANSFERS}, checkers=${RCLONE_CHECKERS}"
log "Filter count: ${#RCLONE_FILTER_ARGS[@]}"

rclone copy \
  "${SOURCE_DIR}/" \
  "${GDRIVE_TARGET}/" \
  "${RCLONE_FILTER_ARGS[@]}" \
  "${RCLONE_COMMON_ARGS[@]}"

log "====== Gap sync to Google Drive completed successfully ======"
