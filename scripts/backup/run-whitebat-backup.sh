#!/usr/bin/env bash
export BACKUP_SKIP_SECTIONS=".cache .cargo .claude .claude-mem .codeql .cursor .cursor-server .codex .gemini .gemini-* .kube .antigravity-server .aitk .hermes .local .npm .pnpm-store .yarn .gradle .rustup .android .tmp .Trash .cache-browser .venvs .virtualenvs"
export BACKUP_RCLONE_EXCLUDE_EXTRA="node_modules/**,.git/**,.venv/**,venv/**,__pycache__/**,.nvm/**,.vscode-server/**,.avm/**,.bun/**,.docker/**,google-cloud-sdk/**,Downloads/**,Music/**,Videos/**,Pictures/**,Desktop/**,rclone-current-linux-amd64.zip,Terax_0.8.2_amd64.deb,.npm/**,.local/share/pnpm/**,.rustup/**,.cargo/**,.cache/**,.casino-postgres/**,.payram-core/**,.gemini/**,.local/share/opencode/**"
export RCLONE_TARGET="whitebat:training"
export BACKUP_RCLONE_FAST_LIST=false
# Use a stable prefix so retention cleanup works regardless of the host
# that created the backup. Hostname is logged separately for traceability.
export BACKUP_RUN_PREFIX="home-pixelated-run"
export BACKUP_RCLONE_TRANSFERS=2
export BACKUP_RCLONE_CHECKERS=2
export BACKUP_RCLONE_EXTRA_ARGS="--tpslimit 4 --tpslimit-burst 4"
export GODEBUG=http2client=0

bash /home/vivi/pixelated/scripts/backup/backup-home-vivi.sh
