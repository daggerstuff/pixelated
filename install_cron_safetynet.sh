#!/bin/bash
set -e

SCRIPT_PATH="/home/vivi/pixelated/.agent/safety-net/safety-net-backup.sh"
LOG_PATH="/home/vivi/pixelated/.agent/safety-net/backup.log"
CRON_SCHEDULE="0 */4 * * *" # Every 4 hours

# Make the backup script executable
chmod +x "$SCRIPT_PATH"

# Prepare the cron job line
CRON_JOB="$CRON_SCHEDULE $SCRIPT_PATH >> $LOG_PATH 2>&1"

# Get current crontab content (ignoring error if empty)
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

# Check if the job already exists
if echo "$CURRENT_CRONTAB" | grep -Fq "$SCRIPT_PATH"; then
    echo "Cron job already exists. Skipping installation."
    echo "Current crontab:"
    crontab -l
    exit 0
fi

# Append the new job
(echo "$CURRENT_CRONTAB"; echo "$CRON_JOB") | crontab -

echo "Safety Net cron job installed successfully!"
echo "It will run every 4 hours: $CRON_SCHEDULE"
echo "Backup location: /home/vivi/pixelated/.agent/safety-net/snapshots"
echo "Backup log: $LOG_PATH"
