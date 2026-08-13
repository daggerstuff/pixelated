#!/usr/bin/env bash
#
# Pixelated Empathy Agent Fleet — systemd service installer
#
# Installs systemd unit files for all 8 agents on a bare-metal/VM host.
# Each agent runs as a dedicated systemd service with auto-restart.
#
# Prerequisites:
#   - Node.js 24.x installed (nvm use 24 or system package)
#   - pnpm installed globally
#   - Each agent built (pnpm exec eve build in agent directory)
#   - Environment file at /opt/pixelated/agents.env with required secrets
#
# Usage:
#   sudo bash agents/deploy/systemd/install.sh
#   sudo bash agents/deploy/systemd/install.sh --uninstall
#
set -euo pipefail

AGENTS=(
  supervisor:2000
  advisor:2005
  content:2010
  eve:2015
  intake:2020
  pipeline:2025
  qa:2030
  session:2035
)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/agents"
UNIT_DIR="/etc/systemd/system"
ENV_FILE="/opt/pixelated/agents.env"

NODE_BIN="$(which node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
  if [ -f "$HOME/.nvm/versions/node" ]; then
    NODE_BIN="$(ls -d $HOME/.nvm/versions/node/v24*/bin/node 2>/dev/null | head -1)"
  fi
fi
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js not found. Install Node 24.x first."
  exit 1
fi

echo "Using Node binary: $NODE_BIN"
echo "Agents directory:  $AGENTS_DIR"
echo "Env file:           $ENV_FILE"
echo ""

if [ "${1:-}" = "--uninstall" ]; then
  for entry in "${AGENTS[@]}"; do
    agent="${entry%%:*}"
    unit="pixelated-${agent}-agent.service"
    echo "Stopping and removing $unit..."
    systemctl stop "$unit" 2>/dev/null || true
    systemctl disable "$unit" 2>/dev/null || true
    rm -f "$UNIT_DIR/$unit"
  done
  systemctl daemon-reload
  echo "All agent services uninstalled."
  exit 0
fi

# Create env file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE from template..."
  cat > "$ENV_FILE" << 'ENVEOF'
# Pixelated Empathy Agent Fleet — Environment
# Fill in all required values before starting services.

# Cloudflare Workers AI
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_API_KEY=

# Eve HTTP Basic auth
EVE_AUTH_USERNAME=admin
EVE_AUTH_PASSWORD=

# Foresight MCP (streamable HTTP)
FORESIGHT_URL=http://127.0.0.1:8764/mcp

# MongoDB (session-agent only)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=pixelated_empathy

# Slack (optional)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Linear (optional)
LINEAR_AGENT_ACCESS_TOKEN=
LINEAR_WEBHOOK_SECRET=
ENVEOF
  chmod 600 "$ENV_FILE"
  echo "  Edit $ENV_FILE and fill in credentials before starting services."
fi

# Install each agent service
for entry in "${AGENTS[@]}"; do
  agent="${entry%%:*}"
  port="${entry##*:}"
  agent_dir="$AGENTS_DIR/${agent}-agent"
  unit="pixelated-${agent}-agent.service"

  if [ ! -d "$agent_dir" ]; then
    echo "WARN: $agent_dir does not exist, skipping $agent"
    continue
  fi

  if [ ! -f "$agent_dir/.output/server/index.mjs" ]; then
    echo "WARN: $agent not built (no .output/server/index.mjs), skipping $agent"
    echo "  Run: cd $agent_dir && pnpm exec eve build"
    continue
  fi

  echo "Installing $unit (port $port)..."

  cat > "$UNIT_DIR/$unit" << EOF
[Unit]
Description=Pixelated Empathy ${agent}-agent
After=network.target

[Service]
Type=simple
WorkingDirectory=${agent_dir}
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PORT=${port}
Environment=HOST=0.0.0.0
ExecStart=${NODE_BIN} .output/server/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${agent_dir}/.eve
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$unit"
  echo "  Installed and enabled. Start with: systemctl start $unit"
done

echo ""
echo "All agent services installed."
echo "Start all:  for u in pixelated-{supervisor,advisor,content,eve,intake,pipeline,qa,session}-agent; do systemctl start \$u; done"
echo "Check:      systemctl status pixelated-*-agent"
echo "Logs:       journalctl -u pixelated-supervisor-agent -f"
echo ""
echo "IMPORTANT: Edit $ENV_FILE with real credentials before starting services."
