#!/bin/bash

# Deploy Pixelated Empathy to VPS using rsync
# This uploads the entire project and sets up the environment

set -e

# Configuration
VPS_HOST=${1:-"209.208.79.191"}
VPS_USER=${2:-"vivi"}
VPS_PORT=${3:-"22"}
SSH_KEY=${4:-""}
DOMAIN=${5:-"pixelatedempathy.com"}
LOCAL_PROJECT_DIR="/home/vivi/pixelated"
REMOTE_PROJECT_DIR="/home/vivi/pixelated"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Show usage
show_usage() {
    echo "Usage: $0 [VPS_HOST] [VPS_USER] [VPS_PORT] [SSH_KEY] [DOMAIN]"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 208.117.84.253 root 22"
    echo "  $0 208.117.84.253 root 22 ~/.ssh/atlanta pixelatedempathy.com"
    echo ""
    echo "This script syncs the entire project to VPS and sets up deployment"
    exit 1
}

print_header "🚀 Deploying Pixelated Empathy to VPS via rsync"
print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
print_status "Domain: ${DOMAIN:-"IP-based access"}"
print_status "Local dir: $LOCAL_PROJECT_DIR"
print_status "Remote dir: $REMOTE_PROJECT_DIR"

# Build SSH command
SSH_CMD="ssh"
RSYNC_SSH_OPTS=""
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
    RSYNC_SSH_OPTS="-e 'ssh -i $SSH_KEY -p $VPS_PORT'"
else
    RSYNC_SSH_OPTS="-e 'ssh -p $VPS_PORT'"
fi
SSH_CMD="$SSH_CMD -p $VPS_PORT -o StrictHostKeyChecking=no"

# Test SSH connection
print_header "Testing SSH connection..."
if $SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_status "✅ SSH connection working"
else
    print_error "❌ SSH connection failed"
    exit 1
fi

# Create rsync exclude file
print_header "Preparing rsync exclusions..."
cat > /tmp/rsync-exclude << 'EOF'
.git/
node_modules/
.next/
.nuxt/
dist/
build/
coverage/
.cache/
*.log
.DS_Store
Thumbs.db
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.mypy_cache/
venv/
.venv/
ai/venv/
ai/.venv/
ai/*.pt
ai/*.pth
ai/*.model
ai/*.pkl
.docker/
docker-compose.override.yml
temp/
tmp/
EOF

print_status "✅ Rsync exclusions prepared"

# Sync project files
print_header "Syncing project files to VPS..."
print_status "This may take a few minutes for the initial sync..."

if eval rsync -avz --progress --delete \
    --exclude-from=/tmp/rsync-exclude \
    "$LOCAL_PROJECT_DIR/" \
    "$VPS_USER@$VPS_HOST:$REMOTE_PROJECT_DIR/" \
    "$RSYNC_SSH_OPTS"; then
    print_status "✅ Project files synced successfully"
else
    print_error "❌ Rsync failed"
    exit 1
fi

# Set up VPS environment
print_header "Setting up VPS environment..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << EOF
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "\${GREEN}[VPS]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS ERROR]${NC} \$1"; }

print_status "Setting up VPS environment..."

# Update system
print_status "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install security basics
print_status "Installing security packages (ufw, fail2ban, unattended-upgrades)..."
sudo apt-get install -y ufw fail2ban unattended-upgrades

# Configure UFW firewall
print_status "Configuring UFW firewall rules..."
sudo ufw allow $VPS_PORT/tcp    # Allow SSH
sudo ufw allow 80/tcp           # Allow HTTP
sudo ufw allow 443/tcp          # Allow HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable

# Enable and start fail2ban
print_status "Enabling fail2ban for SSH brute-force protection..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# SSH hardening reminder
print_status "Review SSH configuration for security:"
print_status "  - Disable root login (PermitRootLogin no)"
print_status "  - Disable password authentication (PasswordAuthentication no)"
print_status "  - Change SSH port if desired"
print_status "  - Use key-based authentication only"
print_status "  - Edit /etc/ssh/sshd_config and restart sshd: systemctl restart sshd"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $VPS_USER 2>/dev/null || true
fi

# Install Node.js if not present or wrong version
NODE_VERSION=\$(command -v node && node --version || echo "none")
if [[ "\$NODE_VERSION" != "v22"* ]]; then
    print_status "Current Node version: \$NODE_VERSION, upgrading to Node.js 22 via nvm..."

    # Check if nvm is already installed
    if [[ -s "\$HOME/.nvm/nvm.sh" ]]; then
        print_status "nvm already installed, loading existing installation..."
        export NVM_DIR="\$HOME/.nvm"
        [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
        [ -s "\$NVM_DIR/bash_completion" ] && \\. "\$NVM_DIR/bash_completion"
    else
        print_status "Installing nvm (first time setup)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="\$HOME/.nvm"
        [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
        [ -s "\$NVM_DIR/bash_completion" ] && \\. "\$NVM_DIR/bash_completion"

        # Add nvm to bashrc for future sessions
        if ! grep -q "NVM_DIR" ~/.bashrc; then
            echo 'export NVM_DIR="\$HOME/.nvm"' >> ~/.bashrc
            echo '[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"' >> ~/.bashrc
            echo '[ -s "\$NVM_DIR/bash_completion" ] && \\. "\$NVM_DIR/bash_completion"' >> ~/.bashrc
        fi
    fi

    # Install and use Node 22
    nvm install 22
    nvm use 22
    nvm alias default 22
    print_status "Node.js 22 installation completed"
else
    print_status "Node.js 22 already installed: \$NODE_VERSION"
fi

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
    print_status "Installing pnpm..."
    npm install -g pnpm
fi

# Install Git if not present
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt-get install -y git
fi

# Install Caddy if domain is configured
if [[ -n "$DOMAIN" ]] && ! command -v caddy &> /dev/null; then
    print_status "Installing Caddy for domain: $DOMAIN"
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    sudo apt-get install -y caddy
    sudo systemctl enable caddy
fi

print_status "✅ VPS environment setup complete"
EOF

# Set up project on VPS
print_header "Setting up project on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << EOF
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "\${GREEN}[VPS]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS ERROR]${NC} \$1"; }
print_warning() { echo -e "\${YELLOW}[VPS WARNING]${NC} \$1"; }

cd $REMOTE_PROJECT_DIR

# Clean any cached pnpm/node state that might be causing issues
print_status "Cleaning cached state..."
rm -rf node_modules/.pnpm
rm -rf ~/.pnpm-store
rm -rf ~/.cache/pnpm
rm -rf .astro
pnpm store prune || true

# Load nvm environment and ensure Node 22 is active
print_status "Loading Node.js environment..."
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
[ -s "\$NVM_DIR/bash_completion" ] && \\. "\$NVM_DIR/bash_completion"

# Force reload nvm and switch to Node 22
print_status "Switching to Node 22..."
nvm use 22 || {
    print_error "Failed to switch to Node 22"
    nvm list
    exit 1
}

# Update PATH to ensure Node 22 binaries are used
export PATH="\$NVM_DIR/versions/node/v22.18.0/bin:\$PATH"

# Verify Node version
NODE_VERSION=\$(node --version)
WHICH_NODE=\$(which node)
print_status "Using Node version: \$NODE_VERSION from \$WHICH_NODE"
if [[ "\$NODE_VERSION" != "v22"* ]]; then
    print_error "Wrong Node version: \$NODE_VERSION (expected v22.x)"
    print_error "Node path: \$WHICH_NODE"
    print_error "PATH: \$PATH"
    exit 1
fi

# Install pnpm with Node 22 (force reinstall to ensure it uses Node 22)
print_status "Installing pnpm with Node 22..."
npm install -g pnpm

# Verify pnpm is using Node 22
PNPM_VERSION=\$(pnpm --version)
WHICH_PNPM=\$(which pnpm)
PNPM_NODE_VERSION=\$(pnpm exec node --version)
print_status "Using pnpm version: \$PNPM_VERSION from \$WHICH_PNPM"
print_status "pnpm is using Node version: \$PNPM_NODE_VERSION"

if [[ "\$PNPM_NODE_VERSION" != "v22"* ]]; then
    print_error "pnpm is using wrong Node version: \$PNPM_NODE_VERSION"
    exit 1
fi

print_status "Installing project dependencies..."
# First try with frozen lockfile, if it fails, regenerate it
if ! pnpm install --frozen-lockfile; then
    print_warning "Frozen lockfile failed, regenerating lockfile..."
    pnpm install --no-frozen-lockfile
fi

print_status "Building project..."
# Set Node options for build
export NODE_OPTIONS="--max-old-space-size=8192"
pnpm build

print_status "Building Docker container..."
docker build -t pixelated-empathy:latest .

print_status "✅ Project setup complete"
EOF

# Archive old repo in root home (VPS)
print_header "Archiving old repo in /root/pixelated on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << EOF
set -e

print_status() { echo -e "\${GREEN}[VPS]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS ERROR]${NC} \$1"; }

if [ -d "/root/pixelated" ]; then
    print_status "Stopping Caddy and Docker containers using /root/pixelated..."
    sudo systemctl stop caddy || true
    sudo docker stop pixelated-app || true
    print_status "Archiving /root/pixelated to /root/pixelated-backup..."
    sudo mv /root/pixelated /root/pixelated-backup
    print_status "Archive complete."
else
    print_status "/root/pixelated does not exist, nothing to archive."
fi
EOF

# Deploy the application
print_header "Deploying application..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << EOF
set -e

print_status() { echo -e "\${GREEN}[VPS]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS ERROR]${NC} \$1"; }

cd $REMOTE_PROJECT_DIR

# Stop existing container
print_status "Stopping existing container..."
docker stop pixelated-app 2>/dev/null || true
docker rm pixelated-app 2>/dev/null || true

# Set up environment variables
PUBLIC_URL="http://$VPS_HOST"
CORS_ORIGINS="http://$VPS_HOST,https://$VPS_HOST"

if [[ -n "$DOMAIN" ]]; then
    PUBLIC_URL="https://$DOMAIN"
    CORS_ORIGINS="\$CORS_ORIGINS,http://$DOMAIN,https://$DOMAIN"
fi

# Run new container
print_status "Starting new container..."
docker run -d \\
  --name pixelated-app \\
  --restart unless-stopped \\
  -p 4321:4321 \\
  -e NODE_ENV=production \\
  -e PORT=4321 \\
  -e WEB_PORT=4321 \\
  -e LOG_LEVEL=info \\
  -e ENABLE_RATE_LIMITING=true \\
  -e RATE_LIMIT_WINDOW=60 \\
  -e RATE_LIMIT_MAX_REQUESTS=100 \\
  -e ENABLE_HIPAA_COMPLIANCE=true \\
  -e ENABLE_AUDIT_LOGGING=true \\
  -e ENABLE_DATA_MASKING=true \\
  -e ASTRO_TELEMETRY_DISABLED=1 \\
  -e PUBLIC_URL="\$PUBLIC_URL" \\
  -e CORS_ORIGINS="\$CORS_ORIGINS" \\
  pixelated-empathy:latest

# Wait for container to start
sleep 15

# Check container status
if docker ps | grep -q pixelated-app; then
    print_status "✅ Container is running"
    docker logs --tail 10 pixelated-app
else
    print_error "❌ Container failed to start"
    docker logs pixelated-app
    exit 1
fi

# Configure Caddy if domain is set
if [[ -n "$DOMAIN" ]]; then
    print_status "Configuring Caddy for domain: $DOMAIN"
    sudo tee /etc/caddy/Caddyfile > /dev/null << 'CADDY_EOF'
$DOMAIN {
    reverse_proxy localhost:4321

    # Enable compression
    encode gzip

    # Security headers
    header {
        # Enable HSTS
        Strict-Transport-Security max-age=31536000;
        # Prevent MIME sniffing
        X-Content-Type-Options nosniff
        # Prevent clickjacking
        X-Frame-Options DENY
        # XSS protection
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy strict-origin-when-cross-origin
    }

    # Health check endpoint
    handle /api/health* {
        reverse_proxy localhost:4321
    }

    # Static assets with long cache
    handle /assets/* {
        reverse_proxy localhost:4321
        header Cache-Control "public, max-age=31536000, immutable"
    }

    # All other requests
    handle {
        reverse_proxy localhost:4321
    }
}
CADDY_EOF

    # Test and reload Caddy
    print_status "Testing Caddy configuration..."
    sudo caddy validate --config /etc/caddy/Caddyfile

    print_status "Starting Caddy..."
    sudo systemctl restart caddy
fi

print_status "✅ Application deployment completed!"

# Show access URLs
print_status "Application URLs:"
print_status "  Direct: http://$VPS_HOST:4321"
if [[ -n "$DOMAIN" ]]; then
    print_status "  Domain: https://$DOMAIN"
fi
EOF

# Clean up
rm -f /tmp/rsync-exclude

print_header "🎉 Deployment completed successfully!"
print_status ""
print_status "Your application is now running on:"
print_status "  Direct access: http://$VPS_HOST:4321"
if [[ -n "$DOMAIN" ]]; then
    print_status "  Domain access: https://$DOMAIN"
fi
print_status ""
print_status "For future updates, you can either:"
print_status "  1. Run this script again to sync all changes"
print_status "  2. SSH to the VPS and use 'git pull' in $REMOTE_PROJECT_DIR"
print_status ""
print_status "SSH to your VPS: ssh $VPS_USER@$VPS_HOST"
