#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Lower concurrency to prevent Civo S3 HTTP2 GOAWAY errors
export BACKUP_RCLONE_TRANSFERS=8
export BACKUP_RCLONE_CHECKERS=8

export BACKUP_RCLONE_EXCLUDE_EXTRA="node_modules/**,.git/**,.venv/**,venv/**,__pycache__/**,.nvm/**,.vscode-server/**,.avm/**,.bun/**,.docker/**,google-cloud-sdk/**,Downloads/**,Music/**,Videos/**,Pictures/**,Desktop/**,rclone-current-linux-amd64.zip,Terax_0.8.2_amd64.deb,.npm/**,.local/share/pnpm/**,.rustup/**,.cargo/**,.cache/**"
export RCLONE_TARGET="whitebat:training"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "${SCRIPT_DIR}/backup-home-vivi.sh"
