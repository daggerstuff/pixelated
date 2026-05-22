#!/usr/bin/env bash
set -euo pipefail

BACKUP_SERVICE="${BACKUP_SERVICE:-backup-home-vivi.service}"
BACKUP_LOG="${BACKUP_LOG:-/home/vivi/.local/share/home_backups/backup.log}"
MAX_DURATION_SECONDS="${BACKUP_MAX_DURATION_SECONDS:-28800}"
MAX_SINCE_LAST_SUCCESS_SECONDS="${BACKUP_MAX_SINCE_LAST_SUCCESS_SECONDS:-90000}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_PREFIX="${ALERT_PREFIX:-backup-home-vivi}"

SUDO=()

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

send_slack_alert() {
  local message="$1"
  if [[ -z "${SLACK_WEBHOOK_URL}" ]]; then
    echo "[alert] $message"
    return 0
  fi
  local escaped
  escaped="$(json_escape "$message")"
  curl -sS -X POST \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${escaped}\"}" \
    "$SLACK_WEBHOOK_URL" >/dev/null
}

check_service_result() {
  local result
  result="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p Result --value 2>/dev/null || echo "unknown")"
  local active
  active="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p ActiveState --value 2>/dev/null || echo "unknown")"
  local last_trigger
  last_trigger="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p LastTriggerUSec --value 2>/dev/null || echo "")"

  if [[ "$result" == "timeout" ]]; then
    send_slack_alert "⚠️ ${ALERT_PREFIX}: BACKUP TIMED OUT. Service killed after exceeding TimeoutStartSec. Last trigger: ${last_trigger:-unknown}"
    return 1
  fi

  if [[ "$result" == "failed" || "$active" == "failed" ]]; then
    local exit_code
    exit_code="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p ExecMainStatus --value 2>/dev/null || echo "unknown")"
    send_slack_alert "⚠️ ${ALERT_PREFIX}: BACKUP FAILED. Result=${result}, ActiveState=${active}, ExitCode=${exit_code}"
    return 1
  fi

  return 0
}

check_last_completion() {
  if [[ ! -f "$BACKUP_LOG" ]]; then
    send_slack_alert "⚠️ ${ALERT_PREFIX}: Backup log file missing at ${BACKUP_LOG}"
    return 1
  fi

  local last_success
  last_success="$(grep -E 'Backup completed successfully' "$BACKUP_LOG" | tail -1 || true)"
  if [[ -z "$last_success" ]]; then
    send_slack_alert "⚠️ ${ALERT_PREFIX}: No successful backup completions found in log"
    return 1
  fi

  local last_success_ts
  last_success_ts="$(echo "$last_success" | grep -oP '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}' || true)"
  if [[ -z "$last_success_ts" ]]; then
    return 0
  fi

  local last_success_epoch
  last_success_epoch="$(date -d "$last_success_ts" +%s 2>/dev/null || echo 0)"
  local now_epoch
  now_epoch="$(date +%s)"
  local elapsed=$((now_epoch - last_success_epoch))

  if (( elapsed > MAX_SINCE_LAST_SUCCESS_SECONDS )); then
    local elapsed_hours
    elapsed_hours=$((elapsed / 3600))
    send_slack_alert "⚠️ ${ALERT_PREFIX}: Last successful backup was ${elapsed_hours}h ago (threshold: $((MAX_SINCE_LAST_SUCCESS_SECONDS / 3600))h). Log entry: ${last_success}"
    return 1
  fi

  return 0
}

check_duration() {
  local active
  active="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p ActiveState --value 2>/dev/null || echo "unknown")"

  if [[ "$active" != "active" ]]; then
    return 0
  fi

  local elapsed
  elapsed="$("${SUDO[@]}" systemctl show "$BACKUP_SERVICE" -p ActiveEnterTimestamp --value 2>/dev/null || echo "")"
  if [[ -z "$elapsed" ]]; then
    return 0
  fi

  local start_epoch
  start_epoch="$(date -d "$elapsed" +%s 2>/dev/null || echo 0)"
  if (( start_epoch == 0 )); then
    return 0
  fi

  local now_epoch
  now_epoch="$(date +%s)"
  local running_seconds=$((now_epoch - start_epoch))

  if (( running_seconds > MAX_DURATION_SECONDS )); then
    local running_hours
    running_hours=$((running_seconds / 3600))
    send_slack_alert "⚠️ ${ALERT_PREFIX}: Backup has been running for ${running_hours}h (threshold: $((MAX_DURATION_SECONDS / 3600))h). May be stuck."
    return 1
  fi

  return 0
}

exit_code=0

check_service_result || exit_code=1
check_last_completion || exit_code=1
check_duration || exit_code=1

if (( exit_code == 0 )); then
  echo "[watchdog] ${ALERT_PREFIX}: All checks passed"
fi

exit $exit_code
