#!/usr/bin/env bash
set -u

ROOT=".cursor/memory"

declare -a CURRENT_FILES=(
  "short_term/current_context.md"
  "short_term/working_decisions.md"
  "short_term/session_notes.md"
  "long_term/project_brief.md"
  "long_term/architecture.md"
  "long_term/patterns.md"
  "long_term/decisions.md"
  "long_term/progress.md"
)

missing_count=0
placeholder_count=0
duplicate_heading_count=0
stale_risk_count=0

declare -a stale_files=()
declare -a duplicate_hits=()
declare -A dup_map=()

date_now_ts="$(date +%s)"
max_lag=0

count_matches() {
  local pattern="$1"
  local file="$2"
  if [ ! -f "$file" ]; then
    echo 0
    return
  fi
  grep -ciE "$pattern" "$file" 2>/dev/null | tr -d ' ' || echo 0
}

for file in "${CURRENT_FILES[@]}"; do
  path="$ROOT/$file"
  if [ ! -f "$path" ]; then
    missing_count=$((missing_count + 1))
    stale_files+=("$file")
    continue
  fi

  placeholders=$(grep -E -o '\[(TODO|TBD|FIXME|Decision|Date Time)\]' "$path" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$placeholders" -gt 0 ]; then
    placeholder_count=$((placeholder_count + placeholders))
    stale_files+=("$file")
  fi

  file_lag=$(( (date_now_ts - $(stat -c %Y "$path")) / 60 ))
  if [ "$file_lag" -gt "$max_lag" ]; then
    max_lag=$file_lag
  fi

  while IFS= read -r heading; do
    heading_text="${heading#### }"
    if [ -z "${heading_text}" ]; then
      continue
    fi
    if [ -z "${dup_map[$heading_text]+x}" ]; then
      dup_map[$heading_text]=1
    else
      dup_map[$heading_text]=$((dup_map[$heading_text] + 1))
    fi
  done < <(grep '^## ' "$path" || true)
done

for key in "${!dup_map[@]}"; do
  if [ "${dup_map[$key]}" -gt 1 ]; then
    duplicate_heading_count=$((duplicate_heading_count + 1))
    duplicate_hits+=("$key")
  fi
done

session_risk_count="$(count_matches '(^\s*-\s*\[[^xX]\]\s*.*risk|^## .*risk|^### .*risk|risk:' "$ROOT/short_term/session_notes.md")"
progress_risk_count="$(count_matches '(^\s*-\s*\[[^xX]\]\s*.*risk|^## .*risk|^### .*risk|risk:' "$ROOT/long_term/progress.md")"
stale_risk_count=$((session_risk_count + progress_risk_count))

required_count=${#CURRENT_FILES[@]}
good_count=$((required_count - missing_count))
memory_health=$((good_count * 100 / required_count))

if [ "$missing_count" -gt 0 ]; then
  memory_health=$((memory_health - (missing_count * 4)))
fi
if [ "$placeholder_count" -gt 0 ]; then
  memory_health=$((memory_health - (placeholder_count * 2)))
fi

if [ "$memory_health" -lt 0 ]; then
  memory_health=0
elif [ "$memory_health" -gt 100 ]; then
  memory_health=100
fi

if [ "$memory_health" -ge 85 ]; then
  health_label=Green
elif [ "$memory_health" -ge 60 ]; then
  health_label=Amber
else
  health_label=Red
fi

command_success_rate=1.0
context_lag_minutes=$max_lag
knowledge_stability=100
if [ "$placeholder_count" -gt 0 ] || [ "$missing_count" -gt 0 ] || [ "$duplicate_heading_count" -gt 0 ] || [ "$stale_risk_count" -gt 1 ]; then
  knowledge_stability=60
fi

if [ "$memory_health" -lt 70 ] || [ "$context_lag_minutes" -gt 120 ] || [ "$stale_risk_count" -gt 1 ] || [ "$duplicate_heading_count" -gt 0 ]; then
  status=failed
  next_step="/memory normalize"
else
  status=success
  next_step="No action required"
fi

if [ "$status" = failed ]; then
  confidence=medium
else
  confidence=high
fi

state_next_action="Run /memory normalize when remediation is needed"
state_next_step="$next_step"
if [ "$status" != "failed" ]; then
  state_next_step="Continue with planned mode command"
fi

bash scripts/memory/update-continuity-state.sh \
  --mode "SYSTEM" \
  --event "continuity_check" \
  --status "$status" \
  --next-action "$state_next_action" \
  --next-step "$state_next_step" \
  --owner "agent" \
  --session-id "check-$(date +%s)"

printf '%s\n' 'MEMORY_RESULT'
printf 'command=%s\n' '/memory check'
printf 'status=%s\n' "$status"
printf 'mode=%s\n' 'SYSTEM'
files_joined=$(IFS='|' ; printf '%s' "${CURRENT_FILES[*]}")
printf 'files=%s\n' "$files_joined"
printf 'memory_health=%s\n' "$memory_health"
printf 'memory_health_label=%s\n' "$health_label"
printf 'context_lag_minutes=%s\n' "$context_lag_minutes"
printf 'command_success_rate=%s\n' "$command_success_rate"
printf 'knowledge_stability=%s\n' "$knowledge_stability"
printf 'continuity_state=%s\n' "updated"
printf 'continuity_state_path=%s\n' ".cursor/memory/continuity_state.json"
printf 'duplicate_headings=%s\n' "$duplicate_heading_count"
printf 'stale_risk_entries=%s\n' "$stale_risk_count"
printf 'missing_required=%s\n' "$missing_count"
printf 'placeholder_entries=%s\n' "$placeholder_count"
printf 'next_action=%s\n' "Run /memory normalize when remediation is needed"
printf 'next_step=%s\n' "$next_step"
printf 'confidence=%s\n' "$confidence"
printf 'recommendation=%s\n' "${#duplicate_hits[@]}"

if [ ${#stale_files[@]} -gt 0 ]; then
  printf 'missing_files=%s\n' "${stale_files[*]}"
fi
if [ ${#duplicate_hits[@]} -gt 0 ]; then
  printf 'duplicate_headings_list=%s\n' "${duplicate_hits[*]}"
fi
if [ "$status" = failed ]; then
  echo 'NEXT_ACTIONS='
  echo ' - /memory normalize'
  if [ "$missing_count" -gt 0 ]; then
    echo ' - /memory init'
  fi
  if [ "$stale_risk_count" -gt 1 ]; then
    echo ' - /memory event risk "Stale risks detected during continuity check"'
  fi
fi
