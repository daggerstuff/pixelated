#!/usr/bin/env bash
set -euo pipefail

MEM_ROOT=".cursor/memory"
STATE_PATH="$MEM_ROOT/continuity_state.json"

MODE="${CURSOR_MODE:-THINK}"
EVENT="manual"
STATUS="unknown"
NEXT_ACTION=""
NEXT_STEP=""
OWNER="agent"
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --event)
      EVENT="$2"
      shift 2
      ;;
    --status)
      STATUS="$2"
      shift 2
      ;;
    --next-action)
      NEXT_ACTION="$2"
      shift 2
      ;;
    --next-step)
      NEXT_STEP="$2"
      shift 2
      ;;
    --owner)
      OWNER="$2"
      shift 2
      ;;
    --session-id)
      SESSION_ID="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 --mode <MODE> --event <EVENT> --status <STATUS> [--next-action ...] [--next-step ...]"
      exit 1
      ;;
  esac
done

python3 - "$STATE_PATH" "$MEM_ROOT" "$MODE" "$EVENT" "$STATUS" "$NEXT_ACTION" "$NEXT_STEP" "$OWNER" "$SESSION_ID" <<'PY'
import json
import os
from pathlib import Path
from datetime import datetime, timezone
import re
import sys
import uuid


def read_lines(path: Path):
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def extract_section_items(path: Path, heading_prefix: str, max_items: int = 3):
    lines = read_lines(path)
    in_section = False
    items = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            in_section = stripped.lower().startswith(f"## {heading_prefix.lower()}")
            continue
        if in_section:
            if stripped.startswith("## "):
                break
            if stripped.startswith("- "):
                item = stripped[2:].strip()
                if item:
                    items.append(item)
                if len(items) >= max_items:
                    break
    return items


def collect_risks(paths, max_items: int = 3):
    matches = []
    for rel in paths:
        path = memory_root / rel
        for line in read_lines(path):
            stripped = line.strip()
            if not stripped:
                continue
            if re.search(r"\b(risk|blocked|critical|high|urgent)\b", stripped, re.IGNORECASE):
                if stripped.startswith("#") or stripped.lower().startswith("##"):
                    continue
                matches.append(f"{rel}: {stripped.lstrip('- ')}")
            if len(matches) >= max_items * 3:
                return matches[:max_items]
    return matches[:max_items]


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


state_path = Path(sys.argv[1])
memory_root = Path(sys.argv[2])
mode = sys.argv[3]
event = sys.argv[4]
status = sys.argv[5]
next_action = sys.argv[6]
next_step = sys.argv[7]
owner = sys.argv[8]
session_id = sys.argv[9]

if state_path.exists():
    try:
        raw = state_path.read_text(encoding="utf-8")
        state = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        state = {}
else:
    state = {}

state["schema_version"] = "agent-first-1"
state["session_id"] = session_id or state.get("session_id") or f"session-{uuid.uuid4()}"
state["owner"] = owner
state["mode"] = mode
state["status"] = status
state["event"] = event
state["last_updated"] = now_iso()
state["last_bootstrap_at"] = state.get("last_bootstrap_at", now_iso())

if event in {"bootstrap", "resume", "mode_resume", "mode_change"}:
    state["last_bootstrap_at"] = now_iso()
if status:
    state["last_context_check_at"] = now_iso()

current_context_path = memory_root / "short_term" / "current_context.md"
progress_path = memory_root / "long_term" / "progress.md"
session_notes_path = memory_root / "short_term" / "session_notes.md"

state["open_items"] = (
    extract_section_items(current_context_path, "Next Actions")
    or extract_section_items(progress_path, "Current Status")
)
state["next_checkpoint"] = "Review context and run /memory check before editing"
state["pending_conflicts"] = []

risks = collect_risks([current_context_path, progress_path, session_notes_path])
state["open_risks"] = risks or []
state["risk_level"] = "high" if any(
    "high" in (risk.lower() or "")
    or "critical" in (risk.lower() or "")
    or "blocked" in (risk.lower() or "")
    or "blocker" in (risk.lower() or "")
    for risk in risks
) else ("medium" if risks else "low")

state["next_action"] = next_action or state.get("next_action", "")
state["next_step"] = next_step or state.get("next_step", "")

state_path.parent.mkdir(parents=True, exist_ok=True)
state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")

print(state_path)
PY
