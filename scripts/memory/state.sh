#!/usr/bin/env bash
set -euo pipefail

STATE_FILE=".cursor/memory/continuity_state.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "MEMORY_RESULT"
  echo "command=/memory state"
  echo "status=failed"
  echo "mode=SYSTEM"
  echo "files=$STATE_FILE"
  echo "memory_health=0"
  echo "memory_health_label=Red"
  echo "context_lag_minutes=9999"
  echo "command_success_rate=0.0"
  echo "knowledge_stability=0"
  echo "continuity_state=missing"
  echo "continuity_state_path=$STATE_FILE"
  echo "next_action=Run /memory bootstrap then /memory check"
  echo "next_step=/memory bootstrap"
  echo "confidence=low"
  echo "PASTE_BLOCK:"
  echo "Create .cursor/memory/continuity_state.json using scripts/memory/update-continuity-state.sh"
  exit 1
fi

python3 - "$STATE_FILE" <<'PY'
import json
import sys
from datetime import datetime, timezone

path = sys.argv[1]
state = {}
with open(path, "r", encoding="utf-8") as fp:
    state = json.load(fp)

lag = 9999
if state.get("last_context_check_at"):
    now = datetime.now(timezone.utc)
    ts = datetime.fromisoformat(state["last_context_check_at"].replace("Z", "+00:00"))
    lag = max(0, int((now - ts).total_seconds() // 60))

continuity = "updated" if lag < 120 and str(state.get("status", "")).lower() not in {"failed", "error"} else "stale"
if not state:
    continuity = "missing"

print("MEMORY_RESULT")
print("command=/memory state")
print(f"status={state.get('status', 'success')}")
print(f"mode={state.get('mode', 'SYSTEM')}")
print(f"files={path}")
print(f"memory_health={state.get('memory_health', 100 if continuity != 'missing' else 0)}")
print(f"memory_health_label={'Green' if lag < 120 else 'Amber' if lag < 360 else 'Red'}")
print(f"context_lag_minutes={lag}")
print(f"command_success_rate=1.0")
print(f"knowledge_stability={state.get('knowledge_stability', 100)}")
print(f"continuity_state={continuity}")
print(f"continuity_state_path={path}")
print(f"next_action={state.get('next_action', 'Continue with working command after confirming state')}")
print(f"next_step={state.get('next_step', '/mode resume')}")
print(f"confidence={state.get('confidence', 'high')}")
print("PASTE_BLOCK:")
print("```json")
print(json.dumps(state, indent=2))
print("```")
PY
