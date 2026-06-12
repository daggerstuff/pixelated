#!/usr/bin/env bash
set -euo pipefail
# Provision Ubuntu 24.04 VM for Cursor Agent (Pixelated Empathy codebase) on Legend

R_USER=${SUDO_USER:-$(whoami)}
[ "$R_USER" = "root" ] && R_USER=$(find /home -maxdepth 1 -type d -printf '%f\n' | head -n 1) || true
R_USER=${R_USER:-root}
HOME_DIR=$([ "$R_USER" = "root" ] && echo "/root" || echo "/home/$R_USER")
WS_DIR="/home/$R_USER/pixelated"

info()  { echo "[INFO] $*"; }
ok()    { echo "[OK] $*"; }
die()   { echo "[ERROR] $*" >&2; exit 1; }

[ $EUID -eq 0 ] || die "must run as root"

setup_swap() {
  [ -f /swapfile ] && return
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "swap 4G"
}

install_system() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get upgrade -y
  apt-get install -y build-essential curl wget git tmux jq unzip fail2ban ufw ca-certificates gnupg lsb-release rsync
  
  # CRITICAL: Allow both standard port 22 and custom SSH port 22022 to avoid lockouts!
  ufw allow 22/tcp
  ufw allow 22022/tcp
  ufw --force enable
  ok "system utils + firewall configured (SSH port 22022 allowed)"
}

install_docker() {
  command -v docker &>/dev/null && return
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker && systemctl start docker
  [ "$R_USER" != "root" ] && usermod -aG docker "$R_USER"
  ok "docker + compose"
}

install_node() {
  [ ! -d "$HOME_DIR/.nvm" ] && sudo -u "$R_USER" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  sudo -u "$R_USER" bash -c 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm install 24.16.0; nvm alias default 24.16.0; npm install -g pnpm@11.3.0'
  [ ! -f "$HOME_DIR/.bun/bin/bun" ] && sudo -u "$R_USER" bash -c "curl -fsSL https://bun.sh/install | bash"
  ok "node 24.16.0 + pnpm + bun"
}

install_python() {
  sudo -u "$R_USER" bash -c "curl -LsSf https://astral.sh/uv/install.sh | sh"
  sudo -u "$R_USER" bash -c 'export PATH="$HOME/.local/bin:$PATH"; uv python install 3.13'
  ok "python 3.13 + uv"
}

setup_repo() {
  if [ -f "package.json" ] && [ -d ".git" ]; then
    WS_DIR=$(pwd)
  else
    WS_DIR="/home/$R_USER/pixelated"
  fi
  [ ! -d "$WS_DIR" ] && sudo -u "$R_USER" git clone --recurse-submodules https://github.com/pixelatedempathy/pixelated.git "$WS_DIR"
  cd "$WS_DIR"
  if [ ! -f ".env" ]; then
    sudo -u "$R_USER" cp .env.example .env
    PG_PASS=$(openssl rand -hex 16); RD_PASS=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32); ENC_KEY=$(openssl rand -hex 16)
    sudo -u "$R_USER" sed -i "s|DATABASE_URL=postgresql://.*|DATABASE_URL=postgresql://pixelated:$PG_PASS@localhost:5432/pixelated_empathy|g" .env
    sudo -u "$R_USER" sed -i "s|REDIS_URL=redis://.*|REDIS_URL=redis://:$RD_PASS@localhost:6379/0|g" .env
    sudo -u "$R_USER" sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SEC|g" .env
    sudo -u "$R_USER" sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENC_KEY|g" .env
    sudo -u "$R_USER" sed -i "s|MONGODB_URI=mongodb+srv://.*|MONGODB_URI=mongodb://localhost:27017/pixelated_empathy|g" .env
    echo -e "REDIS_PASSWORD=$RD_PASS\nPOSTGRES_PASSWORD=$PG_PASS\nPGBOUNCER_PASSWORD=$PG_PASS" >> .env
    ok ".env initialized"
  else
    info "Verifying existing .env database configurations..."
    if ! grep -q "^POSTGRES_PASSWORD=" .env; then
      PG_PASS=$(openssl rand -hex 16)
      echo "POSTGRES_PASSWORD=$PG_PASS" >> .env
      info "Generated and added POSTGRES_PASSWORD to .env"
    fi
    if ! grep -q "^PGBOUNCER_PASSWORD=" .env; then
      PG_PASS=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2-)
      if [ -z "$PG_PASS" ]; then PG_PASS=$(openssl rand -hex 16); fi
      echo "PGBOUNCER_PASSWORD=$PG_PASS" >> .env
      info "Generated and added PGBOUNCER_PASSWORD to .env"
    fi
    if ! grep -q "^REDIS_PASSWORD=" .env; then
      RD_PASS=$(openssl rand -hex 16)
      echo "REDIS_PASSWORD=$RD_PASS" >> .env
      info "Generated and added REDIS_PASSWORD to .env"
    fi
    PG_PASS=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2- | tr -d "'\"")
    RD_PASS=$(grep -E "^REDIS_PASSWORD=" .env | cut -d'=' -f2- | tr -d "'\"")
    
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://pixelated:$PG_PASS@localhost:5432/pixelated_empathy|g" .env
    sed -i "s|DATABASE_URL_UNPOOLED=.*|DATABASE_URL_UNPOOLED=postgresql://pixelated:$PG_PASS@localhost:5432/pixelated_empathy|g" .env
    sed -i "s|MONGODB_URI=.*|MONGODB_URI=mongodb://localhost:27017/pixelated_empathy|g" .env
    sed -i "s|REDIS_URL=.*|REDIS_URL=redis://:$RD_PASS@localhost:6379/0|g" .env
    ok ".env database configurations updated for local services"
  fi
}

start_dbs() {
  cd "$WS_DIR"
  docker network create docker_web 2>/dev/null || true
  export POSTGRES_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2- | tr -d "'\"")
  export REDIS_PASSWORD=$(grep -E "^REDIS_PASSWORD=" .env | cut -d'=' -f2- | tr -d "'\"")
  export PGBOUNCER_PASSWORD=$(grep -E "^PGBOUNCER_PASSWORD=" .env | cut -d'=' -f2- | tr -d "'\"")
  docker compose -f docker/docker-compose.db.yml up -d
  docker compose -f docker/docker-compose.local-mongo.yml up -d
  ok "databases running"
}

setup_foresight() {
  cd "$WS_DIR/foresight-mcp"
  sudo -u "$R_USER" bash -c 'export PATH="$HOME/.local/bin:$PATH"; uv sync'
  cd "$WS_DIR"
  sudo -u "$R_USER" mkdir -p .foresight .cursor/memory/{short_term,long_term}
  if [ -f "scripts/memory/bootstrap-memory-session.sh" ] && [ ! -f ".cursor/memory/config.json" ]; then
    echo '{"project_name":"pixelated-empathy","enabled":true}' > ".cursor/memory/config.json"
    chown -R "$R_USER:$R_USER" .cursor/memory
  fi
  sudo -u "$R_USER" bash -c "cat > \"$HOME_DIR/.claude.json\" << 'MCP'
{
  \"mcpServers\": {
    \"foresight\": {
      \"command\": \"$WS_DIR/scripts/memory/foresight-mcp-server.sh\",
      \"args\": [],
      \"env\": {
        \"FORESIGHT_DB_PATH\": \"$WS_DIR/.foresight/memory.db\",
        \"FORESIGHT_USER_ID\": \"$R_USER\"
      }
    }
  }
}
MCP"
  chown "$R_USER:$R_USER" "$HOME_DIR/.claude.json" 2>/dev/null || true
  ok "foresight mcp ready"
}

install_deps() {
  cd "$WS_DIR"
  
  # Install Node dependencies
  sudo -u "$R_USER" bash -c 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; export PATH="$HOME/.local/bin:$PATH"; pnpm install --no-frozen-lockfile'
  
  # Re-create and sync python environments via uv
  info "Rebuilding Python virtual environments..."
  sudo -u "$R_USER" bash -c 'export PATH="$HOME/.local/bin:$PATH"; uv sync'
  
  if [ -d "ai-services" ]; then
    info "Setting up Python environment for ai-services..."
    cd "ai-services"
    sudo -u "$R_USER" bash -c 'export PATH="$HOME/.local/bin:$PATH"; uv venv --clear && uv pip install -r requirements.txt'
    cd ..
  fi
  
  ok "dependencies installed and python virtual environments synced"
}

MODE=${1:-all}

if [ "$MODE" = "system" ] || [ "$MODE" = "all" ]; then
  info "Running system provisioning..."
  setup_swap
  install_system
  install_docker
  install_node
  install_python
fi

if [ "$MODE" = "app" ] || [ "$MODE" = "all" ]; then
  info "Running app provisioning..."
  setup_repo
  start_dbs
  setup_foresight
  install_deps
fi


echo -e "\n====== CURSOR AGENT ENV READY ======"
echo "Workspace: $WS_DIR"
echo "Node: 24.16.0 | Python: 3.13 | Docker: mongo+redis+postgres"
echo "Foresight MCP registered for user: $R_USER"
echo "Connect Cursor Agent via SSH to this machine."
echo "======================================"
