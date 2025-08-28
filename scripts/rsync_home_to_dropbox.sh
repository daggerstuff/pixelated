#!/bin/bash
# Sync $HOME to Dropbox using rclone, using API key from .env.

set -euo pipefail

# Load Dropbox API token from .env (must be set as DROPBOX_TOKEN)
if ! grep -q '^DROPBOX_TOKEN=' .env; then
  echo "Missing DROPBOX_TOKEN in .env. Aborting."
  exit 1
fi

export $(grep '^DROPBOX_TOKEN=' .env | xargs)

REMOTE_NAME="dropbox"
REMOTE_PATH="${REMOTE_NAME}:backup/home"
LOCAL_PATH="$HOME"
EXCLUDES=( "**/uvx --from git+https://github.com/oraios/serena serena-mcp-server

.cache" "**/.local/share/Trash" "**/node_modules" "**/Downloads" "**/.venv" )

EXCLUDE_FLAGS=""
for EX in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+="--exclude $EX "
done

# rclone config is expected to have Dropbox set up with token from $DROPBOX_TOKEN
# Generate config dynamically if not set
RCLONE_CONF="${HOME}/.config/rclone/rclone.conf"
if ! grep -q "\[${REMOTE_NAME}\]" "$RCLONE_CONF" 2>/dev/null; then
  mkdir -p "$(dirname "$RCLONE_CONF")"
  cat > "$RCLONE_CONF" <<EOF
[${REMOTE_NAME}]
type = dropbox
token = $DROPBOX_TOKEN
EOF
fi

echo "Syncing $LOCAL_PATH → $REMOTE_PATH"
echo "Excluding: ${EXCLUDES[*]}"
rclone sync $LOCAL_PATH "$REMOTE_PATH" $EXCLUDE_FLAGS --progress --copy-links --transfers 8 --checkers 16 --log-level INFO

if [ $? -eq 0 ]; then
  echo "Dropbox sync completed successfully!"
else
  echo "Sync failed. Check rclone log/output above."
  exit 1
fi
  