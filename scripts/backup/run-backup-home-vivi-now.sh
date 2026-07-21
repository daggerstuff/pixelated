#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-backup-home-vivi.service}"
MONITOR="${2:-1}"
MONITOR="${MONITOR,,}"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

start_backup() {
  echo "[backup-run] Starting ${SERVICE} with --no-block"
  "${SUDO[@]}" systemctl start --no-block "$SERVICE"
  echo "[backup-run] Started. Monitoring if enabled."
}

if [[ "$MONITOR" == "0" || "$MONITOR" == "false" || "$MONITOR" == "no" ]]; then
  start_backup
  exit 0
fi

start_backup

echo "[backup-run] Tail logs:"
echo "[backup-run] Tip: press Ctrl+C to detach; backup keeps running."
"${SUDO[@]}" journalctl -u "$SERVICE" --no-pager -f | rg "Effective BACKUP_|Effective BACKUP_SKIP_SECTIONS|Starting sectioned sync|Skipping auto section|Section sync completed successfully|Sectioned sync completed with|Backup completed successfully|ERROR|FAIL|heartbeat|Heartbeat"
