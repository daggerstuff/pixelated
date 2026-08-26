#!/usr/bin/env bash
#
# Cursor Web & Cloud VM Environment Setup Script - Pixelated Empathy
#
# This script provisions a clean Ubuntu 22.04 / 24.04 Cloud VM for remote development,
# installs all required runtimes (Node 24.16.0, pnpm 11.12.0, python 3.13, uv),
# boots up the required database containers (Mongo, Redis, Postgres),
# installs the Cursor CLI Tunnel daemon, and sets up a systemd service for persistent access.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/.../cursor-web-setup.sh | sudo bash
#   OR run locally:
#   sudo ./scripts/vps/cursor-web-setup.sh
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
    log_info "Configuring swap space..."
    if [ -f /swapfile ]; then
        log_warning "Swap file /swapfile already exists. Skipping swap creation."
        return
    fi
    
    # Create a 4GB swap file
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_success "4GB swap space configured successfully"
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

    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    # Add real user to docker group
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
        log_info "Downloading NVM..."
        sudo -u "$REAL_USER" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    fi

    # Load NVM and install Node.js 24.16.0 (matching .nvmrc)
    log_info "Installing Node.js 24.16.0..."
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        nvm install 24.16.0
        nvm alias default 24.16.0
    "

  # Install pnpm 11.12.0 globally
    log_info "Installing pnpm 11.12.0..."
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"
        npm install -g pnpm
    "

    # Install Bun
    if ! sudo -u "$REAL_USER" command -v bun &>/dev/null; then
        log_info "Installing Bun..."
        sudo -u "$REAL_USER" bash -c "curl -fsSL https://bun.sh/install | bash"
    fi

    log_success "Node.js stack installed successfully"
}

# Install Python and uv
install_python_stack() {
    log_info "Installing Python stack..."
    # Install uv
    sudo -u "$REAL_USER" bash -c "curl -LsSf https://astral.sh/uv/install.sh | sh"
    
    # Install Python 3.13 via uv
    log_info "Installing Python 3.13..."
    sudo -u "$REAL_USER" bash -c "
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        uv python install 3.13
    "
    log_success "Python stack installed successfully"
}

# Setup local repository
setup_repository() {
    # Determine workspace directory
    if [ -f "package.json" ] && [ -d ".git" ]; then
        WORKSPACE_DIR=$(pwd)
        log_info "Detected local workspace in current directory: $WORKSPACE_DIR"
    else
        WORKSPACE_DIR="/home/$REAL_USER/pixelated"
        log_info "Workspace directory will be: $WORKSPACE_DIR"
    fi

    # Clone repository if needed
    if [ ! -d "$WORKSPACE_DIR" ]; then
        log_info "Cloning repository..."
        sudo -u "$REAL_USER" git clone --recurse-submodules "https://github.com/pixelatedempathy/pixelated.git" "$WORKSPACE_DIR"
        log_success "Repository cloned to $WORKSPACE_DIR"
    else
        log_info "Workspace directory already exists, skipping clone."
    fi

    # Configure Environment File
    cd "$WORKSPACE_DIR"
    if [ ! -f ".env" ]; then
        log_info "Configuring .env file from template..."
        sudo -u "$REAL_USER" cp .env.example .env
        
        # Generate random secrets
        POSTGRES_PASS=$(openssl rand -hex 16)
        REDIS_PASS=$(openssl rand -hex 16)
        JWT_SEC=$(openssl rand -hex 32)
        ENCRYPTION_K=$(openssl rand -hex 16) # 32-character key for aes-256-gcm
        
        # Replace template placeholders
        sudo -u "$REAL_USER" sed -i "s|DATABASE_URL=postgresql://.*|DATABASE_URL=postgresql://pixelated:$POSTGRES_PASS@localhost:5432/pixelated_empathy|g" .env
        sudo -u "$REAL_USER" sed -i "s|REDIS_URL=redis://.*|REDIS_URL=redis://:$REDIS_PASS@localhost:6379/0|g" .env
        sudo -u "$REAL_USER" sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SEC|g" .env
        sudo -u "$REAL_USER" sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_K|g" .env
        sudo -u "$REAL_USER" sed -i "s|MONGODB_URI=mongodb+srv://.*|MONGODB_URI=mongodb://localhost:27017/pixelated_empathy|g" .env
        
        # Add discrete variables if missing
        if ! grep -q "REDIS_PASSWORD=" .env; then
            echo "REDIS_PASSWORD=$REDIS_PASS" >> .env
        fi
        if ! grep -q "POSTGRES_PASSWORD=" .env; then
            echo "POSTGRES_PASSWORD=$POSTGRES_PASS" >> .env
        fi
        
        log_success ".env file initialized with secure passwords"
    else
        log_warning ".env file already exists. Skipping templates setup."
    fi
}

# Boot Databases
start_databases() {
    log_info "Booting MongoDB, Redis, and PostgreSQL containers..."
    cd "$WORKSPACE_DIR"

    # Make sure docker_web network exists (referenced by local-mongo compose configuration)
    docker network create docker_web 2>/dev/null || true

    # Extract passwords from .env
    local pg_pass
    local redis_pass
    pg_pass=$(grep -E "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2-)
    redis_pass=$(grep -E "^REDIS_PASSWORD=" .env | cut -d'=' -f2-)

    export POSTGRES_PASSWORD="$pg_pass"
    export REDIS_PASSWORD="$redis_pass"

    # Run docker compose using absolute or relative paths
    docker compose -f infra/docker/docker-compose.db.yml up -d
    docker compose -f infra/docker/docker-compose.local-mongo.yml up -d

    log_success "Database containers are running:"
    docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
}

# Install Cursor CLI & Tunnel
install_cursor_web() {
    log_info "Installing Cursor CLI for Web Tunnels..."
    
    # Download latest Cursor CLI for Linux x64
    curl -Lk 'https://api2.cursor.sh/updates/download-latest?os=cli-linux-x64' --output /tmp/cursor_cli.tar.gz
    tar -xzf /tmp/cursor_cli.tar.gz -C /tmp

    if [ -f "/tmp/bin/cursor" ]; then
        mv /tmp/bin/cursor /usr/local/bin/cursor
    elif [ -f "/tmp/cursor" ]; then
        mv /tmp/cursor /usr/local/bin/cursor
    else
        local extracted_bin
        extracted_bin=$(find /tmp -maxdepth 2 -name "cursor" -type f | head -n 1)
        if [ -n "$extracted_bin" ]; then
            mv "$extracted_bin" /usr/local/bin/cursor
        else
            log_error "Could not find extracted cursor binary"
            exit 1
        fi
    fi

    chmod +x /usr/local/bin/cursor
    log_success "Cursor CLI installed to /usr/local/bin/cursor"

    # Create systemd service unit
    log_info "Setting up systemd service template..."
    cat <<EOF > /etc/systemd/system/cursor-tunnel.service
[Unit]
Description=Cursor CLI Tunnel
After=network.target docker.service

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=/home/$REAL_USER
ExecStart=/usr/local/bin/cursor tunnel --accept-server-license-terms
Restart=always
RestartSec=10
Environment=PATH=/home/$REAL_USER/.local/bin:/home/$REAL_USER/.nvm/versions/node/v24.16.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=HOME=/home/$REAL_USER

[Install]
WantedBy=multi-user.target
EOF

    log_success "Systemd service created: /etc/systemd/system/cursor-tunnel.service"
}

# Run setup checks
run_workspace_checks() {
    log_info "Running project workspace checks..."
    cd "$WORKSPACE_DIR"
    
    # Load NVM and run pnpm install
    sudo -u "$REAL_USER" bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
        export PATH=\"\$HOME/.local/bin:\$PATH\"
        cd \"$WORKSPACE_DIR\"
        chmod +x scripts/devops/pnpm-install-with-fallback.sh
        scripts/devops/pnpm-install-with-fallback.sh
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
    install_cursor_web
    run_workspace_checks
    
    echo -e "\n=========================================================================="
    echo -e "${GREEN}🎉 PROVISIONING AND SETUP COMPLETED SUCCESSFULLY! 🎉${NC}"
    echo -e "=========================================================================="
    echo -e "\n${CYAN}Follow these steps to connect your local Cursor editor to the VM:${NC}"
    echo -e "1. Run the one-time authentication command as the developer user:"
    echo -e "   ${YELLOW}sudo -u $REAL_USER cursor tunnel --accept-server-license-terms${NC}"
    echo -e "2. Click the login URL provided in the terminal output and authorize."
    echo -e "3. Once authenticated, press ${YELLOW}Ctrl+C${NC} to terminate the interactive tunnel."
    echo -e "4. Start and enable the systemd service for persistent background tunnel access:"
    echo -e "   ${YELLOW}sudo systemctl daemon-reload && sudo systemctl enable --now cursor-tunnel${NC}"
    echo -e "5. Connect from your local Cursor desktop app or open via vscode.dev / cursor.sh web access."
    echo -e "\n${CYAN}Running the application:${NC}"
    echo -e "- Access your workspace at: ${BLUE}$WORKSPACE_DIR${NC}"
    echo -e "- Build and start all services via: ${BLUE}pnpm dev:all-services${NC}"
    echo -e "=========================================================================="
}

main
