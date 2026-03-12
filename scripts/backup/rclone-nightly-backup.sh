#!/usr/bin/env bash

# Portable Nightly Rclone Backup Script
# Target: Google Drive
# Source: ~/pixelated
# Retention: 2 most recent backups per host

# Configuration
SOURCE="$HOME/pixelated"
REMOTE_NAME="drive"
BACKUP_ROOT="backups/pixelated"
HOSTNAME=$(hostname)
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
DESTINATION="$REMOTE_NAME:$BACKUP_ROOT/$HOSTNAME/$TIMESTAMP"

# Exclude list (minimizes backup size and noise)
EXCLUDES=(
    "node_modules/**"
    ".git/**"
    ".venv/**"
    "__pycache__/**"
    ".astro/**"
    ".vite/**"
    "dist/**"
    "coverage/**"
    "tmp/**"
    "*.log"
)

echo "Starting backup of $SOURCE to $DESTINATION..."

# Build rclone command
# Note: Added --copy-links to follow symlinks if necessary
CMD=(rclone copy "$SOURCE" "$DESTINATION" --copy-links)
for item in "${EXCLUDES[@]}"; do
    CMD+=("--exclude" "$item")
done

# Execute backup
if "${CMD[@]}"; then
    echo "Backup successful: $TIMESTAMP"

    # Retention logic: Only keep the 2 most recent backups
    echo "Checking retention for $REMOTE_NAME:$BACKUP_ROOT/$HOSTNAME..."

    # List subdirectories (backups) and sort them
    mapfile -t BACKUPS < <(rclone lsd "$REMOTE_NAME:$BACKUP_ROOT/$HOSTNAME" 2>/dev/null | awk '{print $NF}' | sort)

    COUNT=${#BACKUPS[@]}

    if [ "$COUNT" -gt 2 ]; then
        TO_DELETE=$((COUNT - 2))
        echo "Found $COUNT backups. Deleting oldest $TO_DELETE..."

        for (( i=0; i<$TO_DELETE; i++ )); do
            OLD_BACKUP="${BACKUPS[$i]}"
            echo "Deleting oldest backup: $OLD_BACKUP"
            rclone purge "$REMOTE_NAME:$BACKUP_ROOT/$HOSTNAME/$OLD_BACKUP"
        done
    else
        echo "Keeping all $COUNT backups (retention limit is 2)."
    fi
else
    echo "Backup failed!"
    exit 1
fi

echo "Backup process completed."

# CRON SETUP INSTRUCTIONS:
# To run this every night at 2:00 AM, run 'crontab -e' and add:
# 0 2 * * * /home/vivi/pixelated/scripts/rclone-nightly-backup.sh >> /home/vivi/pixelated/scripts/backup.log 2>&1
