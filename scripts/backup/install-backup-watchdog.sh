#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This script must be run as root (sudo $0)"
  exit 1
fi

echo "Installing backup watchdog systemd units..."

cat > /etc/systemd/system/backup-watchdog.service << 'SVCEOF'
[Unit]
Description=Watchdog check for backup-home-vivi completion and health
After=backup-home-vivi.service

[Service]
Type=oneshot
User=vivi
Group=vivi
Environment=HOME=/home/vivi
Environment=BACKUP_SERVICE=backup-home-vivi.service
Environment=BACKUP_LOG=/home/vivi/.local/share/home_backups/backup.log
Environment=BACKUP_MAX_DURATION_SECONDS=28800
Environment=BACKUP_MAX_SINCE_LAST_SUCCESS_SECONDS=90000
ExecStart=/usr/bin/env bash /home/vivi/pixelated/scripts/backup/backup-watchdog.sh
StandardOutput=journal
StandardError=journal
SVCEOF

cat > /etc/systemd/system/backup-watchdog.timer << 'TMREOF'
[Unit]
Description=Periodic watchdog check for backup-home-vivi health

[Timer]
OnCalendar=*-*-* 06:00:00
OnCalendar=*-*-* 18:00:00
Persistent=true
RandomizedDelaySec=600
Unit=backup-watchdog.service

[Install]
WantedBy=timers.target
TMREOF

mkdir -p /etc/systemd/system/backup-home-vivi.service.d
cat > /etc/systemd/system/backup-home-vivi.service.d/override.conf << 'OVREOF'
[Unit]
OnFailure=backup-watchdog.service
OVREOF

systemctl daemon-reload
systemctl enable --now backup-watchdog.timer

echo "Done. Watchdog timer enabled (runs at 06:00 and 18:00 UTC)."
echo "OnFailure hook added to backup-home-vivi.service."
echo "Run 'systemctl status backup-watchdog.timer' to verify."
