#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/home/vivi}"
RCLONE_TARGET="${RCLONE_TARGET:-azureblob:vivi-home-backups}"
RCLONE_SYNC_PATH="${RCLONE_SYNC_PATH:-}"
LOCK_FILE_BASE="${HOME:-/home/vivi}"
BACKUP_MODE="${BACKUP_MODE:-incremental}"
BACKUP_KEEP_RUNS="${BACKUP_KEEP_RUNS:-2}"
BACKUP_RUN_PREFIX="${BACKUP_RUN_PREFIX:-home-vivi-run}"
BACKUP_SECTION_STRICT_ERRORS="${BACKUP_SECTION_STRICT_ERRORS:-false}"
BACKUP_SECTIONS="${BACKUP_SECTIONS:-}"
DEFAULT_BACKUP_SKIP_SECTIONS=".cache .cargo .claude .claude-mem .codeql .cursor .cursor-server .codex .gemini .gemini-* .kube .antigravity-server .aitk .hermes .local .npm .pnpm-store .yarn .gradle .rustup .android .tmp .Trash .cache-browser .venvs .virtualenvs"
BACKUP_SKIP_SECTIONS="${BACKUP_SKIP_SECTIONS:-$DEFAULT_BACKUP_SKIP_SECTIONS}"
BACKUP_RCLONE_TRANSFERS="${BACKUP_RCLONE_TRANSFERS:-16}"
BACKUP_RCLONE_CHECKERS="${BACKUP_RCLONE_CHECKERS:-16}"
BACKUP_RCLONE_FAST_LIST="${BACKUP_RCLONE_FAST_LIST:-true}"
BACKUP_RCLONE_STATS="${BACKUP_RCLONE_STATS:-8s}"
BACKUP_RCLONE_EXTRA_ARGS="${BACKUP_RCLONE_EXTRA_ARGS:-}"
BACKUP_RCLONE_EXCLUDE_EXTRA="${BACKUP_RCLONE_EXCLUDE_EXTRA:-}"
if [[ "${BACKUP_RCLONE_EXCLUDE_EXTRA}" != *"pixelated/src/lib/deployment/multi-region/ServiceDiscoveryManager.ts"* ]]; then
  if [[ -n "${BACKUP_RCLONE_EXCLUDE_EXTRA}" ]]; then
    BACKUP_RCLONE_EXCLUDE_EXTRA+=","
  fi
  BACKUP_RCLONE_EXCLUDE_EXTRA+="pixelated/src/lib/deployment/multi-region/ServiceDiscoveryManager.ts"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".claude"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .claude"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".codeql"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .codeql"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".claude-mem"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .claude-mem"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".gemini-*"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .gemini-*"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".cursor"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .cursor"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".cursor-server"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .cursor-server"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".codex"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .codex"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".gemini"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .gemini"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".kube"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .kube"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".antigravity-server"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .antigravity-server"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".npm"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .npm"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".pnpm-store"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .pnpm-store"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".yarn"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .yarn"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".gradle"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .gradle"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".rustup"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .rustup"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".venvs"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .venvs"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".virtualenvs"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .virtualenvs"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".android"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .android"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".tmp"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .tmp"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".Trash"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .Trash"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".cache-browser"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .cache-browser"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".aitk"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .aitk"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".hermes"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .hermes"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".local"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .local"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".cache"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .cache"
fi
if [[ "${BACKUP_SKIP_SECTIONS}" != *".cargo"* ]]; then
  BACKUP_SKIP_SECTIONS+=" .cargo"
fi
BACKUP_HEARTBEAT_INTERVAL="${BACKUP_HEARTBEAT_INTERVAL:-120}"
SECTION_BACKUP_PATHS=()
SECTION_FAIL_COUNT=0
BACKUP_HEARTBEAT_PID=""
BACKUP_RUN_ID="${BACKUP_RUN_ID:-}"
BACKUP_RESUME_STATE_DIR="${BACKUP_RESUME_STATE_DIR:-}"
BACKUP_SECTION_COMPLETED_FILE="${BACKUP_SECTION_COMPLETED_FILE:-}"
BACKUP_RUN_STATE_FILE="${BACKUP_RUN_STATE_FILE:-}"
BACKUP_RUN_STATE_MAX_AGE_SECONDS="${BACKUP_RUN_STATE_MAX_AGE_SECONDS:-0}"
declare -A COMPLETED_SECTIONS=()

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
    HOME="/home/$(id -un)"
    export HOME
  fi
fi

LOCK_FILE_BASE="$HOME"
BACKUP_DIR="${BACKUP_DIR:-$HOME/.local/share/home_backups}"
LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_DIR/backup.log}"
LOCK_FILE="${LOCK_FILE_BASE}/.cache/home-vivi-backup.lock"
BACKUP_RESUME_STATE_DIR="${BACKUP_RESUME_STATE_DIR:-$BACKUP_DIR/.backup-state}"
BACKUP_RUN_STATE_FILE="${BACKUP_RUN_STATE_FILE:-$BACKUP_RESUME_STATE_DIR/sectioned-run-state}"
mkdir -p "$BACKUP_RESUME_STATE_DIR"

if [[ -z "$BACKUP_RUN_ID" && -s "$BACKUP_RUN_STATE_FILE" ]]; then
  SAVED_RUN_ID="$(tr -d '[:space:]' < "$BACKUP_RUN_STATE_FILE")"
  if [[ -n "$SAVED_RUN_ID" ]]; then
    if (( BACKUP_RUN_STATE_MAX_AGE_SECONDS > 0 )); then
      BACKUP_RUN_STATE_MTIME="$(stat -c %Y "$BACKUP_RUN_STATE_FILE" 2>/dev/null || echo 0)"
      BACKUP_RUN_STATE_AGE="$(( $(date +%s) - BACKUP_RUN_STATE_MTIME ))"
      if (( BACKUP_RUN_STATE_AGE < 0 || BACKUP_RUN_STATE_AGE > BACKUP_RUN_STATE_MAX_AGE_SECONDS )); then
        SAVED_RUN_ID=""
      fi
    fi
    if [[ -n "$SAVED_RUN_ID" ]]; then
      BACKUP_RUN_ID="$SAVED_RUN_ID"
    fi
  fi
fi
BACKUP_RUN_ID="${BACKUP_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_SECTION_COMPLETED_FILE="${BACKUP_SECTION_COMPLETED_FILE:-$BACKUP_RESUME_STATE_DIR/sectioned-completed.${BACKUP_RUN_ID}}"
echo "$BACKUP_RUN_ID" > "$BACKUP_RUN_STATE_FILE"

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

if ! command -v tar >/dev/null 2>&1 && [[ "$BACKUP_MODE" == "full" ]]; then
  log "tar is required for full backup mode but is not available"
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

declare -a RCLONE_COPY_ARGS
declare -a RCLONE_EXCLUDE_PATHS
declare -a RCLONE_RETENTION_PREFIXES

load_rclone_args() {
  mapfile -t RCLONE_COPY_ARGS < <(printf '%s\n' \
    "--checksum" \
    "--create-empty-src-dirs" \
    "--transfers" "${BACKUP_RCLONE_TRANSFERS}" \
    "--checkers" "${BACKUP_RCLONE_CHECKERS}" \
    "--ignore-errors" \
    "--skip-links" \
    "--retries" "5" \
    "--low-level-retries" "10" \
    "--stats" "${BACKUP_RCLONE_STATS}" \
    "--stats-one-line")

  if [[ "${BACKUP_RCLONE_FAST_LIST,,}" == "true" || "${BACKUP_RCLONE_FAST_LIST,,}" == "1" ]]; then
    RCLONE_COPY_ARGS+=("--fast-list")
  fi

  mapfile -t RCLONE_EXCLUDE_PATHS < <(printf '%s\n' \
    ".cache/**" \
    "cache/**" \
    ".cursor/**" \
    ".codeql/**" \
    ".cursor-server/**" \
    ".codex/**" \
    ".claude/**" \
    "pixelated/dist/**" \
    "pixelated/build/**" \
    "pixelated/.next/**" \
    "pixelated/.turbo/**" \
    "pixelated/.cache/**" \
    "coverage/**" \
    "**/coverage/**" \
    "**/.cache/**" \
    "node_modules/**" \
    "**/node_modules/**" \
    ".venv/**" \
    "**/.venv/**" \
    "**/tmp/**" \
    "**/.tmp/**" \
    "tmp/**" \
    ".gemini/tmp/**" \
    ".kube/cache/**" \
    ".local/share/zed/**" \
    ".local/share/home_backups/**" \
    ".cache/home-vivi-backup.lock" \
    "*.sock" \
    "*.log" \
    ".cache/home-backup-*" \
    ".cache/home-vivi-backup-*" \
    "**/.ssh/**" \
    ".ssh/**" \
    "**/.config/rclone/**" \
    ".config/rclone/**")

  if [[ -n "${BACKUP_RCLONE_EXCLUDE_EXTRA}" ]]; then
    while IFS= read -r exclude_arg; do
      exclude_arg="$(printf '%s\n' "$exclude_arg" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
      if [[ "${exclude_arg:0:1}" == "#" ]]; then
        continue
      fi
      if [[ -n "$exclude_arg" ]]; then
        RCLONE_EXCLUDE_PATHS+=("$exclude_arg")
      fi
    done < <(printf '%s\n' "${BACKUP_RCLONE_EXCLUDE_EXTRA}" | tr ',;' '\n')
  fi

  if [[ -n "${BACKUP_RCLONE_EXTRA_ARGS}" ]]; then
    read -ra CUSTOM_RCLONE_ARGS <<< "${BACKUP_RCLONE_EXTRA_ARGS}"
    RCLONE_COPY_ARGS+=("${CUSTOM_RCLONE_ARGS[@]}")
  fi

  local exclude_arg
  for exclude_arg in "${RCLONE_EXCLUDE_PATHS[@]}"; do
    RCLONE_COPY_ARGS+=("--exclude" "$exclude_arg")
  done
}

is_skipped_section() {
  local section_name="$1"
  local skip_section
  local skip_candidates

  skip_candidates="$(printf '%s' "${BACKUP_SKIP_SECTIONS:-}" | tr ',;' ' ')"
  for skip_section in ${skip_candidates}; do
    # BACKUP_SKIP_SECTIONS contains glob patterns like '.gemini-*' that must
    # expand during matching, so the RHS of == is intentionally unquoted.
    # shellcheck disable=SC2053
    if [[ "$section_name" == $skip_section ]]; then
      return 0
    fi
  done
  return 1
}

load_completed_sections() {
  local section_path
  if [[ -f "$BACKUP_SECTION_COMPLETED_FILE" ]]; then
    while IFS= read -r section_path; do
      [[ -z "$section_path" ]] && continue
      COMPLETED_SECTIONS["$section_path"]=1
    done < "$BACKUP_SECTION_COMPLETED_FILE"
    log "Loaded checkpoint file with ${#COMPLETED_SECTIONS[@]} completed sections"
  fi
}

mark_section_complete() {
  local section_name="$1"
  local marker
  marker="$BACKUP_SECTION_COMPLETED_FILE"

  if [[ -n "${COMPLETED_SECTIONS[$section_name]:-}" ]]; then
    return
  fi
  printf '%s\n' "$section_name" >> "$marker"
  COMPLETED_SECTIONS["$section_name"]=1
}

is_section_complete() {
  local section_name="$1"
  [[ -n "${COMPLETED_SECTIONS[$section_name]:-}" ]]
}

cleanup_completed_checkpoint() {
  rm -f "$BACKUP_SECTION_COMPLETED_FILE"
  rm -f "$BACKUP_RUN_STATE_FILE"
}

collect_section_paths() {
  local source_sections
  source_sections="${BACKUP_SECTIONS:-}"
  if [[ -n "$source_sections" ]]; then
    while IFS= read -r section_path; do
      section_path="$(printf '%s\n' "$section_path" | tr ',;' '\n')"
      section_path="$(echo "$section_path" | sed 's/[[:space:]]*$//; s/^[[:space:]]*//')"
      if [[ -z "$section_path" || "${section_path:0:1}" == "#" ]]; then
        continue
      fi
      SECTION_BACKUP_PATHS+=("$section_path")
    done < <(printf '%s\n' "$source_sections" | tr ',;' '\n')
    if (( ${#SECTION_BACKUP_PATHS[@]} == 0 )); then
      log "No valid BACKUP_SECTIONS entries found; falling back to auto-discovery."
      SECTION_BACKUP_PATHS=()
    else
      return
    fi
  fi

  while IFS= read -r -d '' section_path; do
    local section_name
    section_name="$(basename "$section_path")"
    if is_skipped_section "$section_name"; then
      log "Skipping auto section: ${section_name}"
      continue
    fi
    SECTION_BACKUP_PATHS+=("$section_path")
  done < <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 -print0 | sort -z)
}

resolve_section_path() {
  local section_path="$1"
  local expanded

  expanded="${section_path/#\~/$HOME}"
  if [[ "$expanded" = .* ]]; then
    printf '%s\n' "${SOURCE_DIR%/}/${expanded}"
    return
  fi
  if [[ "$expanded" = /* ]]; then
    printf '%s\n' "$expanded"
    return
  fi
  printf '%s\n' "${SOURCE_DIR%/}/${expanded}"
}

run_section_backup() {
  local section_path="$1"
  local section_name
  local section_dest

  section_path="$(resolve_section_path "$section_path")"
  if [[ ! -e "$section_path" ]]; then
    log "Section source missing, skipping: ${section_path}"
    return
  fi

  section_name="$(basename "$section_path")"
  if [[ -z "$section_name" || "$section_name" == "." ]]; then
    section_name="root"
  fi
  if is_section_complete "$section_name"; then
    log "Skipping already-completed section (resume): ${section_name}"
    return
  fi
  section_dest="${RCLONE_SECTION_ROOT}/${section_name}"

  log "Starting incremental section sync (${section_name}) from ${section_path} to ${section_dest}"
  if rclone copy "$section_path" "$section_dest" "${RCLONE_COPY_ARGS[@]}"; then
    log "Section sync completed successfully: ${section_name}"
    mark_section_complete "$section_name"
  else
    SECTION_FAIL_COUNT=$((SECTION_FAIL_COUNT + 1))
    log "Section sync failed: ${section_name}"
  fi
}

run_retention_cleanup() {
  if ! command -v jq >/dev/null 2>&1; then
    log "jq is missing, skipping remote run retention cleanup"
    return 0
  fi

  local run_count remove_count old_run old_run_dir
  mapfile -t RCLONE_RETENTION_PREFIXES < <(
    rclone lsjson "$RCLONE_DEST" --dirs-only 2>/dev/null \
      | jq -r --arg prefix "$BACKUP_RUN_PREFIX" \
        '.[] | select(.IsDir and (.Name | startswith($prefix + "-"))) | .Name' \
      | sort
  )

  run_count="${#RCLONE_RETENTION_PREFIXES[@]}"
  if (( run_count <= BACKUP_KEEP_RUNS )); then
    return 0
  fi

  remove_count=$((run_count - BACKUP_KEEP_RUNS))
  log "Retention cleanup: keeping ${BACKUP_KEEP_RUNS} runs, removing ${remove_count} old run folders from ${RCLONE_DEST}"
  for ((old_run = 0; old_run < remove_count; old_run++)); do
    old_run_dir="${RCLONE_RETENTION_PREFIXES[$old_run]}"
    if [[ -n "$old_run_dir" ]]; then
      log "Pruning old backup run: ${RCLONE_DEST}/${old_run_dir}"
      rclone purge "${RCLONE_DEST}/${old_run_dir}" || log "Unable to purge ${old_run_dir}"
    fi
  done
}

cleanup_lock() {
  if [ -n "${lock_acquired:-}" ] && [ -f "$LOCK_FILE" ]; then
    flock -u 9 || true
    rm -f "$LOCK_FILE"
  fi
}

cleanup_staging() {
  if [ -n "${ARCHIVE_STAGING_TMP:-}" ] && [ -f "$ARCHIVE_STAGING_TMP" ]; then
    rm -f "$ARCHIVE_STAGING_TMP"
  fi

  if [ -n "${ARCHIVE_STAGING_DIR:-}" ] && [ -d "$ARCHIVE_STAGING_DIR" ]; then
    rm -f "$ARCHIVE_STAGING_DIR"/home-vivi-*.tar.gz.tmp 2>/dev/null || true
    if [ -z "${lock_acquired:-}" ]; then
      rmdir "$ARCHIVE_STAGING_DIR" 2>/dev/null || true
    fi
  fi
}

start_backup_heartbeat() {
  if ! [[ "$BACKUP_HEARTBEAT_INTERVAL" =~ ^[0-9]+$ ]] || (( BACKUP_HEARTBEAT_INTERVAL <= 0 )); then
    return
  fi

  BACKUP_START_EPOCH="$(date +%s)"
  (
    while true; do
      sleep "$BACKUP_HEARTBEAT_INTERVAL"
      current_time="$(date +%s)"
      elapsed_seconds="$((current_time - BACKUP_START_EPOCH))"
      log "Heartbeat: backup still running for ${elapsed_seconds}s (mode=${BACKUP_MODE})"
    done
  ) &
  BACKUP_HEARTBEAT_PID=$!
}

stop_backup_heartbeat() {
  if [[ -n "${BACKUP_HEARTBEAT_PID:-}" ]]; then
    kill -TERM "$BACKUP_HEARTBEAT_PID" 2>/dev/null || true
    wait "$BACKUP_HEARTBEAT_PID" 2>/dev/null || true
  fi
}

trap 'stop_backup_heartbeat; cleanup_lock; cleanup_staging' EXIT

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another backup is already running, exiting"
  exit 0
fi
lock_acquired=true
start_backup_heartbeat
log "Effective BACKUP_SECTIONS='${BACKUP_SECTIONS}'"
log "Effective BACKUP_SKIP_SECTIONS='${BACKUP_SKIP_SECTIONS}'"
log "Effective BACKUP_RCLONE_TRANSFERS='${BACKUP_RCLONE_TRANSFERS}'"
log "Effective BACKUP_RCLONE_CHECKERS='${BACKUP_RCLONE_CHECKERS}'"
log "Effective BACKUP_RCLONE_FAST_LIST='${BACKUP_RCLONE_FAST_LIST}'"
log "Effective BACKUP_RCLONE_EXCLUDE_EXTRA='${BACKUP_RCLONE_EXCLUDE_EXTRA}'"
log "Effective BACKUP_RCLONE_EXTRA_ARGS='${BACKUP_RCLONE_EXTRA_ARGS}'"
log "Effective BACKUP_RUN_ID='${BACKUP_RUN_ID}'"
log "Checkpoint file='${BACKUP_SECTION_COMPLETED_FILE}'"
log "Heartbeat interval: ${BACKUP_HEARTBEAT_INTERVAL}s"

case "$BACKUP_MODE" in
  sectioned)
    load_rclone_args
    RCLONE_SECTION_ROOT="${RCLONE_DEST}/${BACKUP_RUN_PREFIX}-${BACKUP_RUN_ID}"
    load_completed_sections
    collect_section_paths
    log "Starting sectioned sync from ${SOURCE_DIR} to ${RCLONE_SECTION_ROOT}"
    for section_path in "${SECTION_BACKUP_PATHS[@]}"; do
      run_section_backup "$section_path"
    done

    log "Sectioned sync completed with ${SECTION_FAIL_COUNT} section error(s)"
    run_retention_cleanup
    if [[ "${BACKUP_SECTION_STRICT_ERRORS,,}" == "true" && "$SECTION_FAIL_COUNT" -gt 0 ]]; then
      log "Sectioned sync encountered errors and BACKUP_SECTION_STRICT_ERRORS=true"
      exit 1
    fi
    cleanup_completed_checkpoint
    ;;

  incremental)
    load_rclone_args
    log "Starting incremental stream sync from ${SOURCE_DIR} to ${RCLONE_DEST}/${BACKUP_RUN_PREFIX}-${BACKUP_RUN_ID}"
    rclone copy "$SOURCE_DIR" "${RCLONE_DEST}/${BACKUP_RUN_PREFIX}-${BACKUP_RUN_ID}" "${RCLONE_COPY_ARGS[@]}"
    log "Incremental stream sync completed successfully"
    cleanup_completed_checkpoint
    run_retention_cleanup
    ;;
  full)
    BACKUP_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    ARCHIVE_FILE="$BACKUP_DIR/home-vivi-${BACKUP_TIMESTAMP}.tar.gz"
    ARCHIVE_STAGING_DIR="${TMPDIR:-/tmp}/home-vivi-backup-staging"
    ARCHIVE_STAGING_TMP="$ARCHIVE_STAGING_DIR/home-vivi-${BACKUP_TIMESTAMP}.tar.gz.tmp"

    mapfile -t TAR_EXCLUDE_ARGS < <(printf '%s\n' \
    "--exclude=.cache/**" \
    "--exclude=.codeql/**" \
    "--exclude=cache/**" \
      "--exclude=.cursor/**" \
      "--exclude=.cursor-server/**" \
      "--exclude=.codex/**" \
      "--exclude=.claude/**" \
      "--exclude=pixelated/dist/**" \
      "--exclude=pixelated/build/**" \
      "--exclude=pixelated/.next/**" \
      "--exclude=pixelated/.turbo/**" \
      "--exclude=pixelated/.cache/**" \
      "--exclude=**/coverage/**" \
      "--exclude=**/.cache/**" \
      "--exclude=**/terminals/**" \
      "--exclude=free-claude-code/**" \
    "--exclude=tmp/**" \
    "--exclude=.tmp/**" \
    "--exclude=.gemini/tmp/**" \
    "--exclude=.kube/cache/**" \
      "--exclude=*.sock" \
      "--exclude=**/*.log" \
      "--exclude=.local/share/zed/**" \
      "--exclude=.local/share/home_backups/**" \
      "--exclude=.cache/home-vivi-backup.lock" \
      "--exclude=**/node_modules/**" \
      "--exclude=**/.venv/**" \
      "--exclude=**/.ssh/**" \
      "--exclude=.ssh/**" \
      "--exclude=**/.config/rclone/**" \
      "--exclude=.config/rclone/**")

    mkdir -p "$ARCHIVE_STAGING_DIR"
    cleanup_staging
    log "Starting full backup archive from ${SOURCE_DIR} to ${ARCHIVE_FILE}"
    tar -czf "$ARCHIVE_STAGING_TMP" -C "$SOURCE_DIR" . "${TAR_EXCLUDE_ARGS[@]}"
    mv "$ARCHIVE_STAGING_TMP" "$ARCHIVE_FILE"
    log "Local archive created: ${ARCHIVE_FILE}"

    log "Uploading archive to ${RCLONE_DEST}"
    rclone copy "$ARCHIVE_FILE" "$RCLONE_DEST" --checksum --create-empty-src-dirs --ignore-errors
    log "Archive upload completed"

    mapfile -t BACKUP_ARCHIVES < <(printf '%s\n' "$BACKUP_DIR"/home-vivi-*.tar.gz 2>/dev/null | sort)
    if (( ${#BACKUP_ARCHIVES[@]} > 2 )); then
      for archive in "${BACKUP_ARCHIVES[@]:0:$(( ${#BACKUP_ARCHIVES[@]} - 2 ))}"; do
        rm -f "$archive"
        log "Removed old local backup: ${archive}"
      done
    fi
    cleanup_completed_checkpoint
    ;;
  *)
    log "Invalid BACKUP_MODE '$BACKUP_MODE'. Expected 'sectioned', 'incremental', or 'full'."
    exit 1
    ;;
esac

if ! rclone touch "${RCLONE_DEST}/.meta/last-successful-run-marker" >/dev/null 2>&1; then
  if ! printf '%s\n' "$(date -Iseconds)" | rclone rcat "${RCLONE_DEST}/.meta/last-successful-run-marker"; then
    log "Failed to write sync marker, but backup stream completed."
  fi
fi

log "Backup completed successfully"
