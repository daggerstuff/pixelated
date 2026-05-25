#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo $0"
  exit 1
fi

sed -i 's/Environment=BACKUP_KEEP_RUNS=6/Environment=BACKUP_KEEP_RUNS=2/' /etc/systemd/system/backup-home-vivi.service
systemctl daemon-reload
echo "BACKUP_KEEP_RUNS set to 2. Daemon reloaded."
echo "Next backup run will prune old runs down to 2."
