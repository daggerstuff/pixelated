#!/usr/bin/env bash
export BACKUP_SKIP_SECTIONS=".cache .cargo .claude .claude-mem .codeql .cursor .cursor-server .codex .gemini .gemini-* .kube .antigravity-server .aitk .hermes .local .npm .pnpm-store .yarn .gradle .rustup .android .tmp .Trash .cache-browser .venvs .virtualenvs .nvm .vscode-server .avm .bun .docker google-cloud-sdk Downloads Music Videos Pictures Desktop rclone-current-linux-amd64.zip Terax_0.8.2_amd64.deb"
export BACKUP_RCLONE_EXCLUDE_EXTRA="node_modules/**,.git/**,.venv/**,venv/**,__pycache__/**"
export RCLONE_TARGET="whitebat:training"

bash /home/vivi/pixelated/scripts/backup/backup-home-vivi.sh
