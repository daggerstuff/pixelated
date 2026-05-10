#!/usr/bin/env bash
# Install or update the backup-home-vivi systemd service/timer and restart the timer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYSTEMD_SOURCE_DIR="$PROJECT_ROOT/scripts/systemd"
SYSTEMD_TARGET_DIR="/etc/systemd/system"
SERVICE_NAME="backup-home-vivi.service"
TIMER_NAME="backup-home-vivi.timer"
BACKUP_SERVICE_SOURCE="$SYSTEMD_SOURCE_DIR/$SERVICE_NAME"
BACKUP_TIMER_SOURCE="$SYSTEMD_SOURCE_DIR/$TIMER_NAME"
BACKUP_SERVICE_TARGET="$SYSTEMD_TARGET_DIR/$SERVICE_NAME"
BACKUP_TIMER_TARGET="$SYSTEMD_TARGET_DIR/$TIMER_NAME"
BACKUP_OVERRIDES_DIR="$SYSTEMD_TARGET_DIR/${SERVICE_NAME}.d"
BACKUP_OVERRIDES_FILE="$BACKUP_OVERRIDES_DIR/10-local-env.conf"
BACKUP_LEGACY_OVERRIDE_FILE="$BACKUP_OVERRIDES_DIR/override.conf"

usage() {
  cat <<'USAGE'
Usage: install-backup-home-vivi-service.sh [options]

This script copies the project service/timer files into /etc/systemd/system and
restarts the backup timer.

Options:
  --mode <sectioned|incremental|full>    Override BACKUP_MODE.
  --keep-runs <n>                       Override BACKUP_KEEP_RUNS.
  --run-prefix <prefix>                 Override BACKUP_RUN_PREFIX.
  --strict-errors <true|false>           Override BACKUP_SECTION_STRICT_ERRORS.
  --sections <comma/newline-separated>   Override BACKUP_SECTIONS.
  --no-block                           Restart timer without blocking.

All environment overrides can also be provided via environment variables:
  BACKUP_MODE, BACKUP_KEEP_RUNS, BACKUP_RUN_PREFIX,
  BACKUP_SECTION_STRICT_ERRORS, BACKUP_SECTIONS

Examples:
  sudo ./install-backup-home-vivi-service.sh --sections "pixelated,projects"
  BACKUP_SECTIONS="pixelated\nprojects" sudo ./install-backup-home-vivi-service.sh
USAGE
}

die() {
  echo "[error] $*" >&2
  exit 1
}

SUDO=()
if [[ "${EUID:-0}" -ne 0 ]]; then
  command -v sudo >/dev/null || die "sudo is required when not running as root."
  SUDO=(sudo)
fi

for cmd in cp install systemctl; do
  command -v "$cmd" >/dev/null || die "Missing required command: $cmd"
done

if [[ ! -f "$BACKUP_SERVICE_SOURCE" || ! -f "$BACKUP_TIMER_SOURCE" ]]; then
  die "Source service/timer files not found in $SYSTEMD_SOURCE_DIR."
fi

parse_arg() {
  local arg_key="$1"
  shift
  if [[ $# -eq 0 || "$1" == --* ]]; then
    die "Missing value for option $arg_key"
  fi
  echo "$1"
}

BACKUP_MODE_OVERRIDE="${BACKUP_MODE:-}"
BACKUP_KEEP_RUNS_OVERRIDE="${BACKUP_KEEP_RUNS:-}"
BACKUP_RUN_PREFIX_OVERRIDE="${BACKUP_RUN_PREFIX:-}"
BACKUP_SECTION_STRICT_ERRORS_OVERRIDE="${BACKUP_SECTION_STRICT_ERRORS:-}"
BACKUP_SECTIONS_OVERRIDE="${BACKUP_SECTIONS:-}"
NO_BLOCK_RESTART=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      BACKUP_MODE_OVERRIDE="$(parse_arg "$1" "${@:2}")"
      shift 2
      ;;
    --keep-runs)
      BACKUP_KEEP_RUNS_OVERRIDE="$(parse_arg "$1" "${@:2}")"
      shift 2
      ;;
    --run-prefix)
      BACKUP_RUN_PREFIX_OVERRIDE="$(parse_arg "$1" "${@:2}")"
      shift 2
      ;;
    --strict-errors)
      BACKUP_SECTION_STRICT_ERRORS_OVERRIDE="$(parse_arg "$1" "${@:2}")"
      shift 2
      ;;
    --sections)
      BACKUP_SECTIONS_OVERRIDE="$(parse_arg "$1" "${@:2}")"
      shift 2
      ;;
    --no-block)
      NO_BLOCK_RESTART=1
      shift
      ;;
    --block)
      NO_BLOCK_RESTART=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      die "Unknown option: $1"
      ;;
  esac
done

build_override_file() {
  local override_entries=()

  if [[ -n "$BACKUP_MODE_OVERRIDE" ]]; then
    override_entries+=("BACKUP_MODE=$BACKUP_MODE_OVERRIDE")
  fi
  if [[ -n "$BACKUP_KEEP_RUNS_OVERRIDE" ]]; then
    override_entries+=("BACKUP_KEEP_RUNS=$BACKUP_KEEP_RUNS_OVERRIDE")
  fi
  if [[ -n "$BACKUP_RUN_PREFIX_OVERRIDE" ]]; then
    override_entries+=("BACKUP_RUN_PREFIX=$BACKUP_RUN_PREFIX_OVERRIDE")
  fi
  if [[ -n "$BACKUP_SECTION_STRICT_ERRORS_OVERRIDE" ]]; then
    override_entries+=("BACKUP_SECTION_STRICT_ERRORS=$BACKUP_SECTION_STRICT_ERRORS_OVERRIDE")
  fi
  if [[ -n "$BACKUP_SECTIONS_OVERRIDE" ]]; then
    override_entries+=("BACKUP_SECTIONS=${BACKUP_SECTIONS_OVERRIDE//$'\n'/,}")
  fi

  if (( ${#override_entries[@]} == 0 )); then
    if [[ -d "$BACKUP_OVERRIDES_DIR" ]]; then
      rm -f "$BACKUP_OVERRIDES_FILE"
    fi
    return
  fi

  mkdir -p "$BACKUP_OVERRIDES_DIR"
  {
    echo "[Service]"
    for entry in "${override_entries[@]}"; do
      printf 'Environment=%q\n' "$entry"
    done
  } > "$BACKUP_OVERRIDES_FILE"
}

echo "[info] Copying systemd service/timer files..."
"${SUDO[@]}" install -m 0644 "$BACKUP_SERVICE_SOURCE" "$BACKUP_SERVICE_TARGET"
"${SUDO[@]}" install -m 0644 "$BACKUP_TIMER_SOURCE" "$BACKUP_TIMER_TARGET"

if [[ -f "$BACKUP_LEGACY_OVERRIDE_FILE" ]]; then
  echo "[info] Removing legacy override drop-in: $BACKUP_LEGACY_OVERRIDE_FILE"
  "${SUDO[@]}" rm -f "$BACKUP_LEGACY_OVERRIDE_FILE"
fi

echo "[info] Applying optional environment overrides..."
build_override_file

echo "[info] Reloading systemd and restarting timer..."
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable backup-home-vivi.timer
RESTART_CMD=( "${SUDO[@]}" systemctl restart )
if (( NO_BLOCK_RESTART == 1 )); then
  RESTART_CMD+=(--no-block)
fi
RESTART_CMD+=(backup-home-vivi.timer)
"${RESTART_CMD[@]}"

echo "[info] Current timer status:"
"${SUDO[@]}" systemctl status backup-home-vivi.timer --no-pager --full

echo
echo "[success] Backup service update complete."
echo
echo "[help] To run a one-off backup without blocking this terminal:"
echo "  sudo /home/vivi/pixelated/scripts/backup/run-backup-home-vivi-now.sh"
echo "  # add a second argument of 0 to skip live tail"
echo "  sudo /home/vivi/pixelated/scripts/backup/run-backup-home-vivi-now.sh backup-home-vivi.service 0"
