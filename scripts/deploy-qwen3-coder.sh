#!/usr/bin/env zsh
set -euo pipefail

# Deploy Qwen Coder (Ollama + LiteLLM) to a remote VPS
# Usage: scripts/deploy-qwen3-coder.sh [IP] [USER] [KEY_PATH]
# Defaults: IP=45.55.211.39 USER=root KEY_PATH=~/.ssh/planet

IP=${1:-45.55.211.39}
USER=${2:-root}
KEY=${3:-$HOME/.ssh/planet}
SRC_DIR="infra/qwen3-coder"
REMOTE_DIR="/root/qwen3-coder"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: SSH key not found at $KEY" >&2
  exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: Source directory $SRC_DIR not found. Run from repo root." >&2
  exit 1
fi

echo "[1/6] Copying $SRC_DIR to $USER@$IP:$REMOTE_DIR ..."
rsync -avz -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" "$SRC_DIR/" "$USER@$IP:$REMOTE_DIR/"

echo "[2/6] Ensuring Docker is installed and running..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$IP" bash -s <<'REMOTE'
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
sudo systemctl enable --now docker || true
REMOTE

echo "[3/6] Creating .env if missing and generating API key..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$IP" bash -s <<'REMOTE'
set -euo pipefail
cd /root/qwen3-coder
if [[ ! -f .env ]]; then
  cp .env.example .env
  KEY=$(openssl rand -hex 24)
  sed -i "s|LITELLM_MASTER_KEY=.*|LITELLM_MASTER_KEY=$KEY|" .env
fi
REMOTE

echo "[4/6] Building and starting Docker services..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$IP" bash -s <<'REMOTE'
set -euo pipefail
cd /root/qwen3-coder
# Prefer docker compose plugin
if docker compose version >/dev/null 2>&1; then
  docker compose build --pull
  docker compose up -d --remove-orphans
else
  # fallback to docker-compose (legacy)
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose build --pull
    docker-compose up -d --remove-orphans
  else
    echo "Docker compose not found" >&2
    exit 1
  fi
fi
REMOTE

echo "[5/6] Pulling model qwen3-coder:latest on host (one-time; may take a while)..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$IP" bash -s <<'REMOTE'
set -euo pipefail
# Ensure host Ollama is running and reachable
if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "Ollama not detected. Install/start Ollama on host and expose 11434."
  exit 1
fi
until curl -sSf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; do
  echo "Waiting for host ollama on 11434..."
  sleep 2
done
if ! ollama list | grep -q "qwen3-coder:latest"; then
  ollama pull qwen3-coder:latest
fi
REMOTE

echo "[6/6] Verifying API and printing config..."
API_KEY=$(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$IP" "grep LITELLM_MASTER_KEY /root/qwen3-coder/.env | cut -d= -f2")
cat <<EOF

Done. Configure Claude Code Open with:
- Base URL: http://$IP:8080/v1
- API Key: $API_KEY
- Model: qwen3-coder

Quick test from your machine:
  curl -s http://$IP:8080/v1/models -H "Authorization: Bearer $API_KEY" | jq

EOF
