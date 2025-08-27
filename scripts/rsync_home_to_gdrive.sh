#!/bin/bash
# Syncs your entire $HOME directory to your Google Drive rclone remote ("gdrive") using rsync-like logic.

set -euo pipefail

# Configurable variables
REMOTE_NAME="gdrive"
REMOTE_PATH="${REMOTE_NAME}:backup/home"
LOCAL_PATH="$HOME"

# Optional: exclude certain folders/files (edit as needed!)
EXCLUDES=( ".cache" ".local/share/Trash" "node_modules" "Downloads" )

# Build the rclone exclude flags
EXCLUDE_FLAGS=""
for EX in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+="--exclude $EX "
done

echo "Starting sync: $LOCAL_PATH → $REMOTE_PATH"
echo "Excluding: ${EXCLUDES[*]}"
echo

rclone sync $LOCAL_PATH "$REMOTE_PATH" $EXCLUDE_FLAGS --progress --copy-links --drive-skip-shortcuts --transfers 16 --checkers 32 --log-level INFO

if [ $? -eq 0 ]; then
  echo "Sync completed successfully!"
else
  echo "Sync failed. Please check rclone logs for details."
  exit 1
fi

# Reference: See docs/google_drive_rclone_setup.md for remote setup instructions
  