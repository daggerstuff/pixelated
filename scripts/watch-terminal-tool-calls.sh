#!/usr/bin/env bash

set -euo pipefail

LOG_DIR="/home/vivi/.cursor/projects/home-vivi-pixelated/terminals"
PATTERN="<(function|parameter|tool|tool_result|tool_choice|tool_call|argument)[^>]*>"
INTERVAL_SECONDS="${TOOL_CALL_WATCH_INTERVAL_SECONDS:-2}"
MAX_FILES="${TOOL_CALL_WATCH_MAX_FILES:-10}"
STATE_FILE="/tmp/terminal-tool-call-watch.state"

show_help() {
  cat <<'USAGE'
Usage:
  scripts/watch-terminal-tool-calls.sh [--once] [--help]

Environment options:
  TOOL_CALL_WATCH_INTERVAL_SECONDS  Polling interval in seconds (default: 2)
  TOOL_CALL_WATCH_MAX_FILES         Number of terminal snapshot files to track (default: 10)

Behavior:
  - By default, tails terminal snapshots in the background and emits alerts when malformed
    tool-call markers are seen, e.g. <function=Read>, <parameter=file_path>.
  - With --once, it performs a single scan of all matching files and exits.
USAGE
}

watch_once=false
if [[ ${1:-} == "--help" || ${1:-} == "-h" ]]; then
  show_help
  exit 0
fi
if [[ ${1:-} == "--once" ]]; then
  watch_once=true
fi

if [[ ! -d "$LOG_DIR" ]]; then
  echo "Tool-call watcher: terminal log dir not found: $LOG_DIR" >&2
  exit 1
fi

declare -A last_line_count

# Load prior state (file path -> last line count)
if [[ -f "$STATE_FILE" ]]; then
  while IFS=' ' read -r path lines; do
    [[ -z "$path" ]] && continue
    last_line_count["$path"]="$lines"
  done < "$STATE_FILE"
fi

write_state() {
  : > "$STATE_FILE"
  for path in "${!last_line_count[@]}"; do
    echo "$path ${last_line_count[$path]}" >> "$STATE_FILE"
  done
}

scan_file() {
  local file="$1"
  local last_seen="${last_line_count[$file]:-0}"
  local current_lines

  if [[ "$watch_once" == true ]]; then
    last_seen=0
  fi

  current_lines=$(wc -l < "$file")
  (( current_lines >= 0 )) || return 0

  if [[ "$last_seen" == "0" && "$watch_once" == false ]]; then
    # Ignore historical lines on first run so we only catch new malformed output.
    last_line_count["$file"]="$current_lines"
    return 0
  fi

  if (( current_lines <= last_seen )); then
    return 0
  fi

  local start_line=$(( last_seen + 1 ))
  local matches
  matches=$(sed -n "${start_line},${current_lines}p" "$file" | rg -n --pcre2 "$PATTERN" || true)

  if [[ -n "$matches" ]]; then
    local file_name
    file_name=$(basename "$file")
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      echo "[$(date -Iseconds)] [tool-call watcher] potential malformed marker in ${file_name}: ${match}"
    done <<< "$matches"
  fi

  last_line_count["$file"]="$current_lines"
}

scan_once() {
  local files
  files=$(ls -1t "$LOG_DIR"/*.txt 2>/dev/null | head -n "$MAX_FILES" || true)

  if [[ -z "$files" ]]; then
    echo "No terminal snapshot files found in $LOG_DIR"
    return 0
  fi

  for file in $files; do
    scan_file "$file"
  done

  write_state
}

if [[ "$watch_once" == true ]]; then
  scan_once
  exit 0
fi

while true; do
  scan_once
  sleep "$INTERVAL_SECONDS"
done
