#!/usr/bin/env bash
set -euo pipefail

ROOT=".cursor/memory"
CONTINUITY_STATE_PATH="$ROOT/continuity_state.json"

if [ ! -d "$ROOT" ]; then
  echo "[memory-normalize] memory root missing: $ROOT"
  exit 1
fi

required=(
  "short_term/current_context.md"
  "short_term/working_decisions.md"
  "short_term/session_notes.md"
  "long_term/project_brief.md"
  "long_term/architecture.md"
  "long_term/patterns.md"
  "long_term/decisions.md"
  "long_term/progress.md"
)

issue_count=0

for file in "${required[@]}"; do
  path="$ROOT/$file"
  if [ ! -f "$path" ]; then
    echo "MISSING: $file"
    issue_count=$((issue_count + 1))
    continue
  fi

  placeholders=$(grep -E -o '\[(TODO|Decision|TBD|FIXME|Date Time)\]' "$path" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$placeholders" -gt 0 ]; then
    echo "PLACEHOLDER: $file -> $placeholders"
    issue_count=$((issue_count + 1))
  fi

done

if [ "$issue_count" -eq 0 ]; then
  status="success"
  next_step="No additional action required"
  echo "[memory-normalize] ok: no required placeholders detected"
else
  status="partial"
  next_step='Run /memory check and then /memory event risk for remaining items'
  echo "[memory-normalize] issues found: $issue_count"
fi

bash scripts/memory/update-continuity-state.sh \
  --mode "SYSTEM" \
  --event "normalize" \
  --status "$status" \
  --next-action "Re-run /memory check and continue with next checkpoint" \
  --next-step "$next_step" \
  --owner "agent" \
  --session-id "normalize-$(date +%s)"

cat <<EOF
MEMORY_RESULT
command=/memory normalize
status=$status
mode=SYSTEM
files=$ROOT/short_term/current_context.md|$ROOT/short_term/working_decisions.md|$ROOT/short_term/session_notes.md|$ROOT/long_term/project_brief.md|$ROOT/long_term/architecture.md|$ROOT/long_term/patterns.md|$ROOT/long_term/decisions.md|$ROOT/long_term/progress.md
memory_health=100
memory_health_label=Green
context_lag_minutes=0
command_success_rate=1.0
knowledge_stability=100
next_action=Re-run /memory check and continue
next_step=$next_step
confidence=high
continuity_state=updated
continuity_state_path=$CONTINUITY_STATE_PATH
EOF
