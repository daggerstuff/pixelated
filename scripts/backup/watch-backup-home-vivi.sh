#!/usr/bin/env bash

set -euo pipefail

SERVICE="${1:-backup-home-vivi.service}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLL_SECONDS="${BACKUP_MONITOR_POLL_SECONDS:-30}"
JOURNAL_TAIL_LINES="${BACKUP_MONITOR_JOURNAL_TAIL_LINES:-30}"
EXIT_ON_FAILURE_ONLY="${BACKUP_MONITOR_EXIT_ON_FAILURE_ONLY:-1}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

load_slack_webhook() {
  if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
    return 0
  fi

  local env_file="${PROJECT_ROOT}/.env"
  local webhook_line

  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  webhook_line="$(rg -n "^SLACK_WEBHOOK_URL=" "$env_file" | tail -n 1 | cut -d= -f2- || true)"
  if [[ -z "$webhook_line" ]]; then
    return 1
  fi

  webhook_line="${webhook_line#\"}"
  webhook_line="${webhook_line#\'}"
  webhook_line="${webhook_line%\"}"
  webhook_line="${webhook_line%\'}"
  SLACK_WEBHOOK_URL="$webhook_line"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

send_slack_alert() {
  local message="$1"
  local escaped_message

  if [[ -z "${SLACK_WEBHOOK_URL}" ]]; then
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] WARN: curl missing, cannot send Slack alert"
    return 0
  fi

  escaped_message="$(json_escape "$message")"
  curl -sS -X POST \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${escaped_message}\"}" \
    "$SLACK_WEBHOOK_URL" >/dev/null
}

get_state() {
  "${SUDO[@]}" systemctl show "$SERVICE" \
    -p ActiveState \
    -p SubState \
    -p Result \
    -p NRestarts \
    -p ExecMainPID \
    -p ExecMainStatus \
    -p InvocationID \
    2>/dev/null || true
}

state_to_string() {
  local systemctl_property="$1"
  echo "$systemctl_property" | tr '\n' ' '
}

load_slack_webhook
echo "[monitor] Watching ${SERVICE} every ${POLL_SECONDS}s"
if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
  echo "[monitor] Slack alerts: enabled"
else
  echo "[monitor] Slack alerts: disabled (set SLACK_WEBHOOK_URL in environment or .env)"
fi
echo "[monitor] Failure/finish markers:"
echo "  - Result: timeout"
echo "  - Result: failed"
echo "  - ActiveState: failed"
echo "  - 'Backup completed successfully' in journal"
echo "  - 'Sectioned sync completed with' in journal"

previous_state="$(get_state)"
previous_active_state="$(printf '%s\n' "$previous_state" | awk -F= '/^ActiveState=/{print $2}')"
LAST_ALERT_KEY=""
LAST_COMPLETION_MARKER=""

while true; do
  current_state="$(get_state)"
  if [[ "$current_state" != "$previous_state" ]]; then
    echo "[$(date -Iseconds)] state changed"
    echo "  prev: $(state_to_string "$previous_state")"
    echo "  now : $(state_to_string "$current_state")"
    previous_state="$current_state"
  fi

  result_value="$(printf '%s\n' "$current_state" | awk -F= '/^Result=/{print $2}' || true)"
  active_state="$(printf '%s\n' "$current_state" | awk -F= '/^ActiveState=/{print $2}' || true)"

  failure_key=""
  if [[ "$result_value" == "timeout" || "$result_value" == "failed" || "$active_state" == "failed" ]]; then
    failure_key="${result_value}|${active_state}"
    if [[ "$failure_key" != "${LAST_ALERT_KEY:-}" ]]; then
      echo "[$(date -Iseconds)] ALERT: service failure detected (Result=${result_value:-unknown}, ActiveState=${active_state:-unknown})"
      send_slack_alert "⚠️ Backup failure detected for ${SERVICE}. Result=${result_value:-unknown}, ActiveState=${active_state:-unknown}."
      LAST_ALERT_KEY="$failure_key"
    fi
  else
    LAST_ALERT_KEY=""
  fi

  recent_events="$(
    "${SUDO[@]}" journalctl -u "$SERVICE" -n "$JOURNAL_TAIL_LINES" --no-pager \
      | grep -E "Backup completed successfully|Sectioned sync completed with|Result: timeout|Heartbeat: backup still running|Skipping auto section|Starting sectioned sync" \
      | tail -n 5
  )"
  if [[ -n "$recent_events" ]]; then
    echo "$recent_events"
  fi

  if [[ "$previous_active_state" == "active" && "$active_state" == "inactive" ]]; then
    completion_line="$(
      "${SUDO[@]}" journalctl -u "$SERVICE" -n "$JOURNAL_TAIL_LINES" --no-pager \
        | grep -E "Backup completed successfully|Sectioned sync completed with" \
        | tail -n 1 || true
    )"
    if [[ -n "$completion_line" && "${LAST_COMPLETION_MARKER:-}" != "${completion_line}" ]]; then
      LAST_COMPLETION_MARKER="${completion_line}"
      echo "[$(date -Iseconds)] INFO: service finished. ${completion_line}"
      send_slack_alert "✅ ${SERVICE} finished successfully. ${completion_line}"
    fi
  fi

  if [[ "$active_state" == "failed" ]] && [[ "$EXIT_ON_FAILURE_ONLY" == "1" ]]; then
    send_slack_alert "⛔ ${SERVICE} entered failed state. Monitoring exiting."
    echo "[$(date -Iseconds)] failed and exiting (failure-only mode)."
    exit 1
  fi

  if [[ "$active_state" == "inactive" || "$active_state" == "deactivating" ]] && [[ "$EXIT_ON_FAILURE_ONLY" != "1" ]]; then
    "${SUDO[@]}" journalctl -u "$SERVICE" --no-pager -n "$JOURNAL_TAIL_LINES" --since "5 min ago"
    echo "[$(date -Iseconds)] service no longer running. Exiting (EXIT_ON_FAILURE_ONLY=0)."
    exit 0
  fi

  previous_active_state="$active_state"
  sleep "$POLL_SECONDS"
done
