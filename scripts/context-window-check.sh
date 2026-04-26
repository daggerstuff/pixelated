#!/usr/bin/env bash

set -euo pipefail
LOG_DIR="/home/vivi/.cursor/projects/home-vivi-pixelated/terminals"
WARN_THRESHOLD="${CONTEXT_WINDOW_WARN_PERCENT:-80}"
SAMPLE_FILE_LIMIT="${CONTEXT_WINDOW_SAMPLE_FILES:-3}"
LOOP_WARNING_THRESHOLD="${CONTEXT_WINDOW_LOOP_WARN:-3}"

count_in_file() {
  local pattern="$1"
  local file="$2"
  local count

  count=$(rg -c "$pattern" "$file" 2>/dev/null | awk -F: '{print $2}' | tail -n 1 || true)
  if [[ -z "$count" ]]; then
    echo 0
  else
    echo "$count"
  fi
}

show_help() {
  cat <<'EOF'
Usage:
  scripts/context-window-check.sh [--enforce]

What it does:
  1) Scans terminal session snapshots for context usage and overflow markers
  2) Reports a concise session health line

  If --enforce is passed and risk is high, exits with code 2 and prints an immediate
  manual kill-switch step (run /compact in your active Claude session).
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

compact_limit="unknown (Claude-managed; not exposed in ~/.claude settings)"

if [[ ! -d "$LOG_DIR" ]]; then
  echo "Context window check: LOG_DIR not found: $LOG_DIR"
  echo "Compact limit: $compact_limit"
  exit 1
fi

max_pct=0
last_context_pct_line=""

while IFS= read -r file; do
  while IFS= read -r line; do
    pct=$(sed -n 's/.*Context[^0-9]*\([0-9][0-9]\?\)%/\1/p' <<<"$line" | tr -dc '0-9')
    if [[ -n "$pct" ]]; then
      if (( pct > max_pct )); then
        max_pct="$pct"
      fi
      last_context_pct_line="$line"
    fi
  done < "$file"
done < <(ls -1t "$LOG_DIR"/*.txt 2>/dev/null | head -n "$SAMPLE_FILE_LIMIT")

recent_files=$(ls -1t "$LOG_DIR"/*.txt 2>/dev/null | head -n "$SAMPLE_FILE_LIMIT" || true)
if [[ -n "$recent_files" ]]; then
  input_token_errors=0
  edit_error_count=0
  read_file_count=0
  loop_rewrite_count=0
  while IFS= read -r file; do
    count=$(count_in_file "input_tokens|Input token|input tokens and requested" "$file")
    input_token_errors=$((input_token_errors + count))

    edit_error_count=$((edit_error_count + $(count_in_file "Error editing file|Read 1 file|Error editing" "$file")))
    read_file_count=$((read_file_count + $(count_in_file "Read [1-9][0-9]* file|Read [1-9][0-9]* files|Read 1 file" "$file")))
    loop_rewrite_count=$((loop_rewrite_count + $(count_in_file "Update\\(src/|Read 1 file \\(ctrl\\+o to expand\\)|crunched for" "$file")))
  done <<<"$recent_files"
else
  input_token_errors=0
  edit_error_count=0
  read_file_count=0
  loop_rewrite_count=0
fi
last_context_line="${last_context_pct_line:-}"
latest_file=$(ls -1t "$LOG_DIR"/*.txt 2>/dev/null | head -n 1 || true)

status="SAFE"
if (( max_pct >= WARN_THRESHOLD )) || (( input_token_errors > 0 )) || (( edit_error_count >= LOOP_WARNING_THRESHOLD )) || (( loop_rewrite_count >= LOOP_WARNING_THRESHOLD )); then
  status="REVIEW"
fi

echo "Context window check: $status"
echo "Auto compact limit: ${compact_limit}"
echo "Latest terminal: ${latest_file:-unknown}"
echo "Max session context observed: ${max_pct}% (warning threshold ${WARN_THRESHOLD}%)"
[[ -n "$last_context_line" ]] && echo "Last context line: ${last_context_line}"
echo "Overflow markers in terminals: ${input_token_errors}"
echo "Recent repeated edit-error signals: ${edit_error_count}"
echo "Recent read-heavy signal count: ${read_file_count}"
echo "Likely edit loop churn signals: ${loop_rewrite_count}"

if (( edit_error_count > 0 || loop_rewrite_count >= LOOP_WARNING_THRESHOLD )); then
  echo "Immediate fix in-session: stop retrying failed file edits; switch to one-shot apply_patch with exact hunks."
  echo "If churn repeats, run: /compact"
fi

if [[ "${1:-}" == "--enforce" ]]; then
  if (( max_pct >= WARN_THRESHOLD )); then
    echo "KILL_SWITCH: context is high. Stop heavy prompts and run: /compact"
    exit 2
  fi
  if (( input_token_errors > 0 )); then
    echo "KILL_SWITCH: overflow markers found. Stop and run: /compact"
    exit 2
  fi
  if (( edit_error_count >= LOOP_WARNING_THRESHOLD )); then
    echo "KILL_SWITCH: repetitive edit-loop signature detected. Stop and run: /compact"
    exit 2
  fi
  if [[ "$status" == "SAFE" ]]; then
    echo "Safe to continue normal prompt flow."
  fi
fi

