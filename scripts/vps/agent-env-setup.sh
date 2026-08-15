#!/usr/bin/env bash
set -euo pipefail
# Provision VM for Cursor Agent (Pixelated Empathy codebase)

R_USER=${SUDO_USER:-$(whoami)}
[ "$R_USER" = "root" ] && R_USER=$(find /home -maxdepth 1 -type d -printf '%f\n' | head -n 1) || true
R_USER=${R_USER:-root}
HOME_DIR=$([ "$R_USER" = "root" ] && echo "/root" || echo "/home/$R_USER")
HAS_SUDO=false; command -v sudo &>/dev/null && HAS_SUDO=true
SUD() { $HAS_SUDO && sudo "$@" || "$@"; }

setup_swap() {
  [ -f /swapfile ] && return
  SUD fallocate -l 4G /swapfile 2>/dev/null || SUD dd if=/dev/zero of=/swapfile bs=1M count=4096 2>/dev/null || true
  [ -f /swapfile ] && SUD chmod 600 /swapfile && SUD mkswap /swapfile && SUD swapon /swapfile && echo '/swapfile none swap sw 0 0' | SUD tee -a /etc/fstab >/dev/null && echo "swap 4G" || true
}

install_system() {
  command -v apt-get &>/dev/null || return
  DEBIAN_FRONTEND=noninteractive SUD apt-get update -y && SUD apt-get upgrade -y 2>/dev/null || true
  SUD apt-get install -y build-essential curl wget git tmux jq unzip ca-certificates gnupg lsb-release 2>/dev/null || true
  SUD ufw allow 22/tcp 2>/dev/null && SUD ufw --force enable 2>/dev/null || true
}

install_docker() {
  command -v docker &>/dev/null && return
  command -v apt-get &>/dev/null || return
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | SUD gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes 2>/dev/null || true
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | SUD tee /etc/apt/sources.list.d/docker.list >/dev/null 2>/dev/null || true
  SUD apt-get update -y && SUD apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
  SUD systemctl enable docker 2>/dev/null && SUD systemctl start docker 2>/dev/null || true
  [ "$R_USER" != "root" ] && $HAS_SUDO && SUD usermod -aG docker "$R_USER" 2>/dev/null || true
}

install_node() {
  [ ! -d "$HOME_DIR/.nvm" ] && su "$R_USER" -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" || true
  su "$R_USER" -c 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm install 24.16.0; nvm alias default 24.16.0; npm install -g pnpm@11.21.0'
  [ ! -f "$HOME_DIR/.bun/bin/bun" ] && su "$R_USER" -c "curl -fsSL https://bun.sh/install | bash" || true
}

install_python() {
  su "$R_USER" -c "curl -LsSf https://astral.sh/uv/install.sh | sh" 2>/dev/null || true
  su "$R_USER" -c 'export PATH="$HOME/.local/bin:$PATH"; uv python install 3.13' 2>/dev/null || true
}

setup_repo() {
  if [ -f "package.json" ] && [ -d ".git" ]; then WS_DIR=$(pwd)
  else WS_DIR="/home/$R_USER/pixelated"; fi
  [ ! -d "$WS_DIR" ] && su "$R_USER" -c "git clone --recurse-submodules https://github.com/pixelatedempathy/pixelated.git \"$WS_DIR\"" 2>/dev/null || true
  cd "$WS_DIR" || return
  if [ ! -f ".env" ]; then
    [ -f .env.example ] && cp .env.example .env
    PG_PASS=$(openssl rand -hex 16); RD_PASS=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32); ENC_KEY=$(openssl rand -hex 16)
    sed -i "s|DATABASE_URL=postgresql://.*|DATABASE_URL=postgresql://pixelated:$PG_PASS@localhost:5432/pixelated_empathy|g" .env 2>/dev/null || true
    sed -i "s|REDIS_URL=redis://.*|REDIS_URL=redis://:$RD_PASS@localhost:6379/0|g" .env 2>/dev/null || true
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SEC|g" .env 2>/dev/null || true
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENC_KEY|g" .env 2>/dev/null || true
    sed -i "s|MONGODB_URI=mongodb+srv://.*|MONGODB_URI=mongodb://localhost:27017/pixelated_empathy|g" .env 2>/dev/null || true
    echo -e "REDIS_PASSWORD=$RD_PASS\nPOSTGRES_PASSWORD=$PG_PASS" >> .env 2>/dev/null || true
  fi
}

start_dbs() {
  command -v docker &>/dev/null || return
  cd "$WS_DIR" || return
  docker network create docker_web 2>/dev/null || true
  export POSTGRES_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2-)
  export REDIS_PASSWORD=$(grep -E "^REDIS_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2-)
  [ -f docker/docker-compose.db.yml ] && docker compose -f docker/docker-compose.db.yml up -d 2>/dev/null || true
  [ -f docker/docker-compose.local-mongo.yml ] && docker compose -f docker/docker-compose.local-mongo.yml up -d 2>/dev/null || true
}

setup_foresight() {
  [ ! -d "$WS_DIR/foresight" ] && return
  cd "$WS_DIR/foresight"
  su "$R_USER" -c 'export PATH="$HOME/.local/bin:$PATH"; uv sync' 2>/dev/null || true
  cd "$WS_DIR"
  mkdir -p .foresight .cursor/memory/{short_term,long_term} 2>/dev/null || true
  [ ! -f ".cursor/memory/config.json" ] && echo '{"project_name":"pixelated-empathy","enabled":true}' > .cursor/memory/config.json 2>/dev/null || true
  cat > "$HOME_DIR/.claude.json" 2>/dev/null <<-MCP || true
{
  "mcpServers": {
    "foresight": {
      "command": "$WS_DIR/scripts/memory/foresight-server.sh",
      "args": [],
      "env": {
        "FORESIGHT_DB_PATH": "$WS_DIR/.foresight/memory.db",
        "FORESIGHT_USER_ID": "$R_USER"
      }
    }
  }
}
MCP
}

install_deps() {
  cd "$WS_DIR" || return
  [ ! -f "package.json" ] && return
  su "$R_USER" -c 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; export PATH="$HOME/.local/bin:$PATH"; pnpm install --no-frozen-lockfile' 2>/dev/null || true
}

[ -f /swapfile ] || setup_swap
install_system
install_docker
install_node
install_python
setup_repo
start_dbs
setup_foresight
install_deps
echo "done"
