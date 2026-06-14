#!/bin/bash

# Governance Audit: Log session end with summary statistics

set -euo pipefail

if [[ "${SKIP_GOVERNANCE_AUDIT:-}" == "true" ]]; then
  exit 0
fi

INPUT=$(cat)

mkdir -p logs/copilot/governance

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="logs/copilot/governance/audit.log"

# Count events from this session (filter by session start timestamp)
TOTAL=0
THREATS=0
SESSION_START=""
if [[ -f "$LOG_FILE" ]]; then
  # Find the last session_start event to scope stats to current session
  SESSION_START=$(grep '"session_start"' "$LOG_FILE" 2>/dev/null | tail -1 | jq -r '.timestamp' 2>/dev/null || echo "")
  if [[ -n "$SESSION_START" ]]; then
    # Count events after session start
    TOTAL=$(awk -v start="$SESSION_START" -F'"timestamp":"' '{split($2,a,"\""); if(a[1]>=start) count++} END{print count+0}' "$LOG_FILE" 2>/dev/null || true)
    THREATS=$(awk -v start="$SESSION_START" -F'"timestamp":"' '{split($2,a,"\""); if(a[1]>=start && /threat_detected/) count++} END{print count+0}' "$LOG_FILE" 2>/dev/null || true)
  else
    TOTAL=$(wc -l < "$LOG_FILE" 2>/dev/null || true)
    THREATS=$(grep -c '"threat_detected"' "$LOG_FILE" 2>/dev/null || true)
  fi
fi

jq -Rnc \
  --arg timestamp "$TIMESTAMP" \
  --arg total "$TOTAL" \
  --arg threats "$THREATS" \
  '{"timestamp":$timestamp,"event":"session_end","total_events":($total|tonumber? // 0),"threats_detected":($threats|tonumber? // 0)}' \
  >> "$LOG_FILE"

if [[ "${THREATS:-0}" -gt 0 ]]; then
  echo "⚠️ Session ended: $THREATS threat(s) detected in $TOTAL events"
else
  echo "✅ Session ended: $TOTAL events, no threats"
fi

exit 0
