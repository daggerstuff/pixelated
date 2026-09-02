#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/home/vivi}"
# Legacy single-target knob. Default emptied so the multi-target setup
# below takes precedence; the same script runs the twice-daily fleet
# across hosts and uploads to 2 destinations (whitebat S3 + gdrive),
# each under a hostname-keyed subfolder.
RCLONE_TARGET="${RCLONE_TARGET:-}"
RCLONE_SYNC_PATH="${RCLONE_SYNC_PATH:-}"
# shellcheck disable=SC2034
LOCK_FILE_BASE="${HOME:-/home/vivi}" # Used externally via env var for lock file path
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
if [[ "${BACKUP_RCLONE_EXCLUDE_EXTRA}" != *"pixelated/apps/web/src/lib/deployment/multi-region/ServiceDiscoveryManager.ts"* ]]; then
  if [[ -n "${BACKUP_RCLONE_EXCLUDE_EXTRA}" ]]; then
    BACKUP_RCLONE_EXCLUDE_EXTRA+=","
  fi
  BACKUP_RCLONE_EXCLUDE_EXTRA+="pixelated/apps/web/src/lib/deployment/multi-region/ServiceDiscoveryManager.ts"
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
# Per-host routing: each host writes under its own subfolder so the same
# script, schedule, and buckets are shared across the 3-server fleet.
# Sanitize to chars valid on every backend (S3, GCS, Drive, Azure Blob).
if [[ -z "${BACKUP_HOSTNAME_RAW:-}" ]]; then
  BACKUP_HOSTNAME_RAW="${BACKUP_HOSTNAME:-$(hostname 2>/dev/null || uname -n 2>/dev/null || echo unknown)}"
fi
BACKUP_HOSTNAME="$(printf '%s' "$BACKUP_HOSTNAME_RAW" | tr -c '[:alnum:]._-' '-')"
if [[ -z "$BACKUP_HOSTNAME" || "$BACKUP_HOSTNAME" == "-" ]]; then
  BACKUP_HOSTNAME="unknown"
fi
export BACKUP_HOSTNAME
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

# ----------------------------------------------------------------------------
# Multi-target destination setup
#
# Ordered list of rclone upload targets for this backup run:
#   1. RCLONE_TARGETS_RAW  -- newline/','/';' separated `remote:path` entries
#      (explicit, lets hosts add or remove destinations per-environment).
#   2. RCLONE_TARGET       -- legacy single-target knob (back-compat).
#   3. BACKUP_WHITEBAT_TARGET -- defaults to `whitebat:home-backups`.
#   4. BACKUP_GDRIVE_TARGET   -- defaults to `gdrive:vivi-home-backups`.
#
# Each destination is rewritten to `${base%/}/${BACKUP_HOSTNAME}/` so multiple
# hosts can share the same buckets without collisions. Per-target retention
# keeps the most recent BACKUP_KEEP_RUNS run folders per host.
# ----------------------------------------------------------------------------
RCLONE_TARGETS=()
_add_target() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    return 0
  fi
  case "$raw" in
    drive:*) raw="gdrive:${raw#drive:}" ;;
  esac
  local trimmed
  trimmed="$(printf '%s' "$raw" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s:/+$::')"
  if [[ -z "$trimmed" || "$trimmed" != *:* ]]; then
    return 0
  fi
  RCLONE_TARGETS+=("$trimmed")
  return 0
}

if [[ -n "${RCLONE_TARGETS_RAW:-}" ]]; then
  while IFS= read -r entry; do
    _add_target "$entry"
  done < <(printf '%s' "$RCLONE_TARGETS_RAW" | tr ',;' '\n')
fi
_add_target "$RCLONE_TARGET"
_add_target "${BACKUP_WHITEBAT_TARGET:-whitebat:home-backups}"
_add_target "${BACKUP_GDRIVE_TARGET:-gdrive:vivi-home-backups}"

# Apply the global RCLONE_SYNC_PATH prefix (if set) to every target before
# the per-host segment is appended inside the dispatcher.
if [[ -n "$RCLONE_SYNC_PATH" ]]; then
  _sync_path_trimmed="${RCLONE_SYNC_PATH#/}"
  _sync_path_trimmed="${_sync_path_trimmed%/}"
  for idx in "${!RCLONE_TARGETS[@]}"; do
    t="${RCLONE_TARGETS[$idx]}"
    RCLONE_TARGETS[$idx]="${t%/}/${_sync_path_trimmed}"
  done
fi

# Fail fast on misconfigured targets / missing rclone remotes.
if (( ${#RCLONE_TARGETS[@]} == 0 )); then
  echo "No rclone upload targets configured. Set RCLONE_TARGETS, BACKUP_WHITEBAT_TARGET, or BACKUP_GDRIVE_TARGET." >&2
  exit 1
fi

declare -a _VALID_REMOTES
for t in "${RCLONE_TARGETS[@]}"; do
  _remote="${t%%:*}"
  if [[ -z "$_remote" || "$_remote" == "$t" || "$_remote" == */* ]]; then
    echo "Invalid target '$t'. Expected remote:path" >&2
    exit 1
  fi
  if ! rclone listremotes 2>/dev/null | grep -Fxq "${_remote}:"; then
    echo "Rclone remote '$_remote' (target '$t') is not configured." >&2
    echo "Run 'rclone config' as the service user and retry." >&2
    exit 1
  fi
  _VALID_REMOTES+=("$_remote")
done
unset _remote _sync_path_trimmed t

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
