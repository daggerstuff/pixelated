#!/bin/bash

# Deploy Pixelated Empathy to Atlantic VPS
# Simple, reliable deployment to any VPS with SSH access

set -e

# Configuration
VPS_HOST=${1:-""}
VPS_USER=${2:-"root"}
VPS_PORT=${3:-"22"}
SSH_KEY=${4:-""}
DOMAIN=${5:-""}

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
    echo "Usage: $0 <VPS_HOST> [VPS_USER] [VPS_PORT] [SSH_KEY] [DOMAIN]"
    echo ""
    echo "Examples:"
    echo "  $0 your-vps-ip.com"
    echo "  $0 123.456.789.012 root 22"
    echo "  $0 your-vps.com root 22 ~/.ssh/id_rsa pixelatedempathy.com"
    echo ""
    echo "Parameters:"
    echo "  VPS_HOST  - Your VPS IP address or hostname (required)"
    echo "  VPS_USER  - SSH username (default: root)"
    echo "  VPS_PORT  - SSH port (default: 22)"
    echo "  SSH_KEY   - Path to SSH private key (optional)"
    echo "  DOMAIN    - Domain name for HTTPS (optional)"
    exit 1
}

# Validate inputs
if [[ -z "$VPS_HOST" ]]; then
    print_error "VPS host is required"
    show_usage
fi

print_header "🚀 Deploying Pixelated Empathy to VPS"
print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
print_status "Domain: ${DOMAIN:-"IP-based access"}"

# Build SSH command
SSH_CMD="ssh"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -p $VPS_PORT -o StrictHostKeyChecking=no"

SCP_CMD="scp"
if [[ -n "$SSH_KEY" ]]; then
    SCP_CMD="$SCP_CMD -i $SSH_KEY"
fi
SCP_CMD="$SCP_CMD -P $VPS_PORT -o StrictHostKeyChecking=no"

# Test SSH connection
print_header "Testing SSH connection..."
if $SSH_CMD $VPS_USER@$VPS_HOST "echo 'SSH connection successful'" 2>/dev/null; then
    print_status "✅ SSH connection working"
else
    print_error "❌ SSH connection failed"
    print_error "Please check:"
    print_error "1. VPS host/IP is correct: $VPS_HOST"
    print_error "2. SSH user is correct: $VPS_USER"
    print_error "3. SSH port is correct: $VPS_PORT"
    print_error "4. SSH key is correct: ${SSH_KEY:-"default key"}"
    print_error "5. VPS is running and accessible"
    exit 1
fi

# Create deployment package
print_header "Creating deployment package..."
PACKAGE_NAME="pixelated-$(date +%Y%m%d-%H%M%S).tar.gz"

print_status "Packaging application..."
tar -czf "/tmp/$PACKAGE_NAME" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude="*/.git" \
    --exclude="*/.git/*" \
    --exclude=ai/.git \
    --exclude=ai/data \
    --exclude=ai/models \
    --exclude=ai/datasets \
    --exclude=dist \
    --exclude=.astro \
    --exclude=.vite \
    --exclude=coverage \
    --exclude=test-results \
    --exclude=.oracle_deployment \
    --exclude="*.tar.gz" \
    .

print_status "✅ Package created: $PACKAGE_NAME"

# Upload package to VPS
print_header "Uploading package to VPS..."
$SCP_CMD "/tmp/$PACKAGE_NAME" $VPS_USER@$VPS_HOST:/tmp/

# Clean up local package
rm -f "/tmp/$PACKAGE_NAME"

# Deploy on VPS
print_header "Deploying application on VPS..."
$SSH_CMD $VPS_USER@$VPS_HOST << EOF
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "\${GREEN}[VPS]${NC} \$1"; }
print_error() { echo -e "\${RED}[VPS ERROR]${NC} \$1"; }

print_status "Starting deployment on VPS..."

# Update system
print_status "Updating system packages..."
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y curl wget git unzip
elif command -v yum &> /dev/null; then
    yum update -y
    yum install -y curl wget git unzip
elif command -v dnf &> /dev/null; then
    dnf update -y
    dnf install -y curl wget git unzip
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# Install Caddy if not present
if ! command -v caddy &> /dev/null; then
    print_status "Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
    systemctl enable caddy
fi

# Extract application
print_status "Extracting application..."
cd /opt
rm -rf pixelated-old
if [ -d pixelated ]; then
    mv pixelated pixelated-old
fi
mkdir -p pixelated
cd pixelated
tar -xzf /tmp/$PACKAGE_NAME

# Install dependencies
print_status "Installing dependencies..."
if [ -f package.json ]; then
    # Install pnpm if not present
    if ! command -v pnpm &> /dev/null; then
        npm install -g pnpm
    fi
    
    pnpm install
    pnpm run build
fi

# Build Docker image
print_status "Building Docker image..."
docker build -t pixelated-empathy:latest .

# Stop existing container
print_status "Stopping existing container..."
docker stop pixelated-app 2>/dev/null || true
docker rm pixelated-app 2>/dev/null || true

# Run new container
print_status "Starting new container..."
docker run -d \\
    --name pixelated-app \\
    --restart unless-stopped \\
    -p 4321:4321 \\
    -e NODE_ENV=production \\
    -e PORT=4321 \\
    pixelated-empathy:latest

# Wait for container to start
sleep 10

# Check container status
if docker ps | grep -q pixelated-app; then
    print_status "✅ Container is running"
else
    print_error "❌ Container failed to start"
    docker logs pixelated-app
    exit 1
fi

# Configure Caddy
print_status "Configuring Caddy..."
cat > /etc/caddy/Caddyfile << 'CADDY_EOF'
${DOMAIN:-$VPS_HOST} {
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
caddy validate --config /etc/caddy/Caddyfile

print_status "Starting Caddy..."
systemctl restart caddy

# Clean up
rm -f /tmp/$PACKAGE_NAME

print_status "✅ Deployment completed successfully!"
EOF

# Final health check
print_header "Performing health check..."
sleep 15

TARGET_URL="http://$VPS_HOST"
if [[ -n "$DOMAIN" ]]; then
    TARGET_URL="https://$DOMAIN"
fi

if curl -f "$TARGET_URL" > /dev/null 2>&1; then
    print_status "✅ Application is accessible at $TARGET_URL"
else
    print_warning "⚠️  Application not immediately accessible (may need DNS propagation)"
    print_status "Try accessing: http://$VPS_HOST:4321 (direct container access)"
fi

# Save deployment info
print_header "Saving deployment information..."
cat > .vps_deployment << EOF
VPS_HOST=$VPS_HOST
VPS_USER=$VPS_USER
VPS_PORT=$VPS_PORT
SSH_KEY=$SSH_KEY
DOMAIN=$DOMAIN
DEPLOYED_AT=$(date)
APPLICATION_URL=$TARGET_URL
DIRECT_URL=http://$VPS_HOST:4321
SSH_COMMAND=$SSH_CMD $VPS_USER@$VPS_HOST
EOF

print_header "🎉 Deployment Summary"
print_status ""
print_status "✅ Pixelated Empathy deployed successfully!"
print_status "🌐 Application URL: $TARGET_URL"
print_status "🔗 Direct access: http://$VPS_HOST:4321"
print_status "🔧 SSH access: $SSH_CMD $VPS_USER@$VPS_HOST"
print_status ""
print_status "📋 Management commands:"
print_status "  Container logs: docker logs pixelated-app"
print_status "  Restart app: docker restart pixelated-app"
print_status "  Caddy logs: journalctl -u caddy -f"
print_status "  Caddy reload: systemctl reload caddy"
print_status ""
print_status "🔄 To update your app:"
print_status "  ./scripts/deploy-to-vps.sh $VPS_HOST $VPS_USER $VPS_PORT \"$SSH_KEY\" \"$DOMAIN\""
print_status ""
print_status "Deployment info saved to: .vps_deployment"
