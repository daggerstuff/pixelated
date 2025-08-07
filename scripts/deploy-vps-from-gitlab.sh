#!/bin/bash

# Deploy Pixelated Empathy to VPS using GitLab Container Registry
# This pulls the pre-built container from GitLab instead of building locally

set -e

# Configuration
VPS_HOST=${1:-""}
VPS_USER=${2:-"root"}
VPS_PORT=${3:-"22"}
SSH_KEY=${4:-""}
DOMAIN=${5:-""}
GITLAB_REGISTRY="registry.gitlab.com"
GITLAB_PROJECT="pixelatedtech/pixelated"

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
    echo "  $0 208.117.84.253"
    echo "  $0 208.117.84.253 root 22"
    echo "  $0 208.117.84.253 root 22 ~/.ssh/planet pixelatedempathy.com"
    echo ""
    echo "This script pulls the container from GitLab Container Registry"
    echo "Make sure you've pushed your code to GitLab first!"
    exit 1
}

# Validate inputs
if [[ -z "$VPS_HOST" ]]; then
    print_error "VPS host is required"
    show_usage
fi

print_header "🚀 Deploying Pixelated Empathy from GitLab to VPS"
print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
print_status "Domain: ${DOMAIN:-"IP-based access"}"
print_status "GitLab Registry: $GITLAB_REGISTRY/$GITLAB_PROJECT"

# Build SSH command
SSH_CMD="ssh"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
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

# Check if we need to push to GitLab first
print_header "Checking GitLab repository status..."
if git status --porcelain | grep -q .; then
    print_warning "⚠️  You have uncommitted changes"
    read -p "Push current changes to GitLab? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Committing and pushing changes..."
        git add .
        git commit -m "Deploy to VPS: $(date)"
        git push origin master || git push origin master
    fi
else
    print_status "✅ Working directory clean"
    print_status "Pushing latest commits to GitLab..."
    git push origin master || git push origin master
fi

# Deploy on VPS using GitLab container
print_header "Deploying from GitLab Container Registry..."
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

print_status "Starting GitLab container deployment..."

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
    apt-get update
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
    systemctl enable caddy
fi

# Pull latest image from GitLab
print_status "Pulling latest image from GitLab Container Registry..."
docker pull $GITLAB_REGISTRY/$GITLAB_PROJECT:latest

# Stop existing container
print_status "Stopping existing container..."
docker stop pixelated-app 2>/dev/null || true
docker rm pixelated-app 2>/dev/null || true

# Run new container
print_status "Starting new container from GitLab image..."
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
    -e PUBLIC_URL=http://$VPS_HOST \\
    -e CORS_ORIGINS=http://$VPS_HOST,https://$VPS_HOST \\
    $GITLAB_REGISTRY/$GITLAB_PROJECT:latest

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

print_status "✅ GitLab container deployment completed!"
EOF

# Final health check
print_header "Performing health check..."
sleep 20

TARGET_URL="http://$VPS_HOST"
if [[ -n "$DOMAIN" ]]; then
    TARGET_URL="https://$DOMAIN"
fi

if curl -f "$TARGET_URL" > /dev/null 2>&1; then
    print_status "✅ Application is accessible at $TARGET_URL"
else
    print_warning "⚠️  Application not immediately accessible"
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
GITLAB_IMAGE=$GITLAB_REGISTRY/$GITLAB_PROJECT:latest
EOF

print_header "🎉 GitLab Container Deployment Complete!"
print_status ""
print_status "✅ Pixelated Empathy deployed from GitLab Container Registry!"
print_status "🌐 Application URL: $TARGET_URL"
print_status "🔗 Direct access: http://$VPS_HOST:4321"
print_status "🐳 Container: $GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
print_status ""
print_status "📋 Management commands:"
print_status "  Container logs: docker logs pixelated-app"
print_status "  Restart app: docker restart pixelated-app"
print_status "  Update from GitLab: docker pull $GITLAB_REGISTRY/$GITLAB_PROJECT:latest && docker restart pixelated-app"
print_status ""
print_status "🔄 To update your app:"
print_status "  1. Push changes to GitLab"
print_status "  2. Wait for CI/CD to build new image"
print_status "  3. Run: ./scripts/deploy-vps-from-gitlab.sh $VPS_HOST $VPS_USER $VPS_PORT \"$SSH_KEY\" \"$DOMAIN\""
