#!/usr/bin/env bash
#
# AI Agent Environment Setup Script - Pixelated Empathy
#
# This script provisions a clean Ubuntu 22.04 / 24.04 Cloud VM to run autonomous AI agents
# (such as Claude Code, Aider, Goose, OpenCode, or CI/CD runner environments).
#
# Runtimes installed:
#   - Node.js (24.16.0) & pnpm (11.3.0) & Bun (latest)
#   - Python (3.13) & uv (latest)
#   - Docker containers: MongoDB (6), Redis (7), PostgreSQL (15)
#   - Foresight MCP Server (synced and registered)
#
# AI Agent Tools pre-installed and auto-registered with Foresight MCP:
#   - @anthropic/claude-code (CLI Agent)
#   - Aider (CLI Agent)
#   - Goose (CLI Agent)
#   - OpenCode (CLI Agent)
#
# Usage:
#   sudo ./scripts/vps/agent-env-setup.sh
#

set -euo pipefail

# Output coloring
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO] $*${NC}"; }
log_success() { echo -e "${GREEN}[SUCCESS] ✓ $*${NC}"; }
log_warning() { echo -e "${YELLOW}[WARNING] ⚠️  $*${NC}"; }
log_error() { echo -e "${RED}[ERROR] ❌ $*${NC}" >&2; }

# Helper to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (or with sudo)"
        exit 1
    fi
}

# Helper to check command existence
command_exists() {
    command -v "$1" &>/dev/null
}

# Detect non-root user for service configuration
detect_user() {
    REAL_USER=${SUDO_USER:-$(whoami)}
    if [ "$REAL_USER" = "root" ]; then
        # Look for the first directory in /home
        REAL_USER=$(find /home -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | head -n 1)
        REAL_USER=${REAL_USER:-root}
    fi
    log_info "Target non-root user for workspace & services: $REAL_USER"
}

# Configure Swap Space
configure_swap() {
    log_info "Configuring swap space (4GB)..."
    if [ -f /swapfile ]; then
        log_warning "Swap file /swapfile already exists. Skipping swap creation."
        return
    fi
    
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_success "Swap space configured successfully"
}

# Install System Utilities
install_system_utils() {
    log_info "Updating system packages and installing utilities..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y \
        build-essential \
        curl \
        wget \
        git \
        tmux \
        jq \
        unzip \
        fail2ban \
        ufw \
        ca-certificates \
        gnupg \
        lsb-release
    
    # Allow essential ports in firewall
    ufw allow 22/tcp comment 'SSH'
    ufw --force enable
    log_success "System utilities installed and firewall configured"
}

# Install Docker CE and Docker Compose
install_docker() {
    log_info "Installing Docker & Docker Compose..."
    if command_exists docker; then
        log_warning "Docker is already installed. Skipping installation."
        return
    fi

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    if [ "$REAL_USER" != "root" ]; then
        usermod -aG docker "$REAL_USER"
    fi
    log_success "Docker & Docker Compose installed"
}

# Install Node.js, pnpm, and Bun
install_node_stack() {
    log_info "Installing Node.js stack..."
    local user_home
    if [ "$REAL_USER" = "root" ]; then
        user_home="/root"
    else
        user_home="/home/$REAL_USER"
    fi

    # Install NVM
    if [ ! -d "$user_home/.nvm" ]; then
        sudo -u "$REAL_USER" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    fi

    # Load NVM and install Node.js 24.16.0 (matching .nvmrc)
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        nvm install 24.16.0
        nvm alias default 24.16.0
    "

    # Install pnpm 11.3.0 globally
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        npm install -g pnpm@11.3.0
    "

    # Install Bun
    if ! sudo -u "$REAL_USER" command -v bun &>/dev/null; then
        sudo -u "$REAL_USER" bash -c "curl -fsSL https://bun.sh/install | bash"
    fi

    log_success "Node.js stack installed successfully"
}

# Install Python and uv
install_python_stack() {
    log_info "Installing Python stack..."
    sudo -u "$REAL_USER" bash -c "curl -LsSf https://astral.sh/uv/install.sh | sh"
    
    sudo -u "$REAL_USER" bash -c "
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        uv python install 3.13
    "
    log_success "Python stack installed successfully"
}

# Setup local repository
setup_repository() {
    if [ -f "package.json" ] && [ -d ".git" ]; then
        WORKSPACE_DIR=$(pwd)
    else
        WORKSPACE_DIR="/home/$REAL_USER/pixelated"
    fi
    log_info "Workspace directory is: $WORKSPACE_DIR"

    if [ ! -d "$WORKSPACE_DIR" ]; then
        log_info "Cloning repository..."
        sudo -u "$REAL_USER" git clone --recurse-submodules "https://github.com/pixelatedempathy/pixelated.git" "$WORKSPACE_DIR"
        log_success "Repository cloned to $WORKSPACE_DIR"
    fi

    # Configure Environment File
    cd "$WORKSPACE_DIR"
    if [ ! -f ".env" ]; then
        log_info "Configuring .env file..."
        sudo -u "$REAL_USER" cp .env.example .env
        
        POSTGRES_PASS=$(openssl rand -hex 16)
        REDIS_PASS=$(openssl rand -hex 16)
        JWT_SEC=$(openssl rand -hex 32)
        ENCRYPTION_K=$(openssl rand -hex 16)
        
        sudo -u "$REAL_USER" sed -i "s|DATABASE_URL=postgresql://.*|DATABASE_URL=postgresql://pixelated:$POSTGRES_PASS@localhost:5432/pixelated_empathy|g" .env
        sudo -u "$REAL_USER" sed -i "s|REDIS_URL=redis://.*|REDIS_URL=redis://:$REDIS_PASS@localhost:6379/0|g" .env
        sudo -u "$REAL_USER" sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SEC|g" .env
        sudo -u "$REAL_USER" sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_K|g" .env
        sudo -u "$REAL_USER" sed -i "s|MONGODB_URI=mongodb+srv://.*|MONGODB_URI=mongodb://localhost:27017/pixelated_empathy|g" .env
        
        if ! grep -q "REDIS_PASSWORD=" .env; then
            echo "REDIS_PASSWORD=$REDIS_PASS" >> .env
        fi
        if ! grep -q "POSTGRES_PASSWORD=" .env; then
            echo "POSTGRES_PASSWORD=$POSTGRES_PASS" >> .env
        fi
        
        log_success ".env file initialized"
    fi
}

# Boot Databases
start_databases() {
    log_info "Booting MongoDB, Redis, and PostgreSQL containers..."
    cd "$WORKSPACE_DIR"

    docker network create docker_web 2>/dev/null || true

    local pg_pass
    local redis_pass
    pg_pass=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2-)
    redis_pass=$(grep -E "^REDIS_PASSWORD=" .env | cut -d'=' -f2-)

    export POSTGRES_PASSWORD="$pg_pass"
    export REDIS_PASSWORD="$redis_pass"

    docker compose -f docker/docker-compose.db.yml up -d
    docker compose -f docker/docker-compose.local-mongo.yml up -d

    log_success "Databases are running"
}

# Setup and Build Foresight MCP
setup_foresight() {
    log_info "Setting up Foresight MCP..."
    cd "$WORKSPACE_DIR/foresight-mcp"
    sudo -u "$REAL_USER" bash -c "
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        uv sync
    "
    
    # Bootstrap local memory folders
    cd "$WORKSPACE_DIR"
    sudo -u "$REAL_USER" mkdir -p .foresight
    sudo -u "$REAL_USER" mkdir -p .cursor/memory/short_term
    sudo -u "$REAL_USER" mkdir -p .cursor/memory/long_term
    
    if [ -f "scripts/memory/bootstrap-memory-session.sh" ]; then
        # Create a basic memory config if missing
        if [ ! -f ".cursor/memory/config.json" ]; then
            cat <<EOF > ".cursor/memory/config.json"
{
  "project_name": "pixelated-empathy",
  "enabled": true
}
EOF
            chown -R "$REAL_USER:$REAL_USER" .cursor/memory
        fi
        sudo -u "$REAL_USER" bash scripts/memory/bootstrap-memory-session.sh PLAN || true
    fi
    log_success "Foresight MCP synced and bootstrapped"
}

# Install and Configure AI Agents
install_ai_agents() {
    log_info "Installing AI Agent Tools..."
    
    # 1. Claude Code
    log_info "Installing @anthropic/claude-code..."
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        npm install -g @anthropic/claude-code
    "

    # 2. Aider
    log_info "Installing aider..."
    sudo -u "$REAL_USER" bash -c "
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        uv tool install aider-chat || uv pip install --user aider-chat
    "

    # 3. Goose
    log_info "Installing Goose..."
    if ! command_exists goose; then
        curl -fsSL https://github.com/block/goose/releases/latest/download/goose-linux-x86_64 -o /usr/local/bin/goose || true
        if [ -f /usr/local/bin/goose ]; then
            chmod +x /usr/local/bin/goose
        fi
    fi

    # 4. OpenCode
    log_info "Installing OpenCode..."
    if ! command_exists opencode; then
        curl -fsSL https://opencode.ai/install.sh | bash 2>/dev/null || true
    fi

    # Config Folder setup
    local user_home
    if [ "$REAL_USER" = "root" ]; then
        user_home="/root"
    else
        user_home="/home/$REAL_USER"
    fi
    mkdir -p "$user_home/.config"
    
    # Standard local Foresight MCP Configuration block
    local mcp_config_json
    mcp_config_json=$(cat <<EOF
{
  "mcpServers": {
    "foresight": {
      "command": "$WORKSPACE_DIR/scripts/memory/foresight-mcp-server.sh",
      "args": [],
      "env": {
        "FORESIGHT_DB_PATH": "$WORKSPACE_DIR/.foresight/memory.db",
        "FORESIGHT_USER_ID": "$REAL_USER"
      }
    }
  }
}
EOF
)

    # Register with Claude CLI / Claude Desktop
    echo "Registering Foresight MCP for Claude..."
    mkdir -p "$user_home/.config/Claude"
    echo "$mcp_config_json" > "$user_home/.config/Claude/claude_desktop_config.json"
    echo "$mcp_config_json" > "$user_home/.claude.json"

    # Register with Goose
    echo "Registering Foresight MCP for Goose..."
    mkdir -p "$user_home/.config/goose"
    cat <<EOF > "$user_home/.config/goose/config.yaml"
mcpServers:
  foresight:
    command: "$WORKSPACE_DIR/scripts/memory/foresight-mcp-server.sh"
    args: []
    env:
      FORESIGHT_DB_PATH: "$WORKSPACE_DIR/.foresight/memory.db"
      FORESIGHT_USER_ID: "$REAL_USER"
EOF

    # Register with OpenCode
    echo "Registering Foresight MCP for OpenCode..."
    mkdir -p "$user_home/.config/opencode"
    cat <<EOF > "$user_home/.config/opencode/mcp.json"
{
  "mcp": {
    "foresight": {
      "type": "local",
      "command": ["$WORKSPACE_DIR/scripts/memory/foresight-mcp-server.sh"],
      "enabled": true,
      "environment": {
        "FORESIGHT_DB_PATH": "$WORKSPACE_DIR/.foresight/memory.db",
        "FORESIGHT_USER_ID": "$REAL_USER"
      }
    }
  }
}
EOF

    chown -R "$REAL_USER:$REAL_USER" "$user_home/.config"
    chown -R "$REAL_USER:$REAL_USER" "$user_home/.claude.json" 2>/dev/null || true
    log_success "AI Agent Tools installed and registered with Foresight MCP"
}

# Run setup checks
run_workspace_checks() {
    log_info "Running project workspace checks..."
    cd "$WORKSPACE_DIR"
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        cd \"$WORKSPACE_DIR\"
        pnpm install --no-frozen-lockfile
    "
    log_success "Workspace dependencies successfully installed"
}

main() {
    check_root
    detect_user
    configure_swap
    install_system_utils
    install_docker
    install_node_stack
    install_python_stack
    setup_repository
    start_databases
    setup_foresight
    install_ai_agents
    run_workspace_checks
    
    echo -e "\n=========================================================================="
    echo -e "${GREEN}🎉 AI AGENT CLOUD ENVIRONMENT PROVISIONED SUCCESSFULLY! 🎉${NC}"
    echo -e "=========================================================================="
    echo -e "\n${CYAN}Installed Runtimes:${NC}"
    echo -e "  - Node:     Node.js 24.16.0 (pnpm 11.3.0)"
    echo -e "  - Python:   Python 3.13 (uv manager)"
    echo -e "  - Docker:   MongoDB, Redis, PostgreSQL running"
    echo -e "  - Memory:   Foresight MCP initialized"
    echo -e "\n${CYAN}Available AI Coding Agents (registered with Foresight MCP):${NC}"
    echo -e "  - Claude Code CLI  (run: ${YELLOW}claude${NC})"
    echo -e "  - Aider CLI        (run: ${YELLOW}aider${NC})"
    echo -e "  - Goose CLI        (run: ${YELLOW}goose${NC})"
    echo -e "  - OpenCode CLI     (run: ${YELLOW}opencode${NC})"
    echo -e "=========================================================================="
}

main
