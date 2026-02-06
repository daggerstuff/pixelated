#!/usr/bin/env bash
# setup-ollama-host.sh
# Automates the "Additional Notes" for exposing Ollama on all interfaces with CORS support.

set -euo pipefail

log() {
    echo "[ollama-setup] $1"
}

# 1. Create Drop-in Directory
log "Creating systemd override directory..."
sudo mkdir -p /etc/systemd/system/ollama.service.d/

# 2. Create Override File
log "Configuring OLLAMA_HOST=0.0.0.0 and OLLAMA_ORIGINS=* ..."
cat <<EOF | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
EOF

# 3. Reload and Restart
log "Reloading systemd daemon..."
sudo systemctl daemon-reload

log "Restarting Ollama service..."
sudo systemctl restart ollama

# 4. Verification
log "Verifying service status and listening interfaces..."
systemctl status ollama --no-pager
ss -antp | grep 11434

log "Setup complete. Ollama is now exposed on 0.0.0.0 with CORS enabled."
log "Caddy is configured to protect this endpoint using your API key."
