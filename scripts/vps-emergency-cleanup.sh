#!/bin/bash

set -euo pipefail

# Configuration from your rsync.sh
VPS_HOST=${1:-"45.55.211.39"}
VPS_USER=${2:-"root"}
VPS_PORT=${3:-"22"}
SSH_KEY=${4:-"~/.ssh/planet"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[LOCAL]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[CLEANUP]${NC} $1"; }

# Build SSH command
SSH_CMD="ssh -t"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -p $VPS_PORT -o StrictHostKeyChecking=no"

print_header "🚨 EMERGENCY VPS CLEANUP: $VPS_HOST"
print_error "⚠️  WARNING: This will remove Docker containers, images, and build cache!"

read -p "Continue with VPS cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Test SSH connection
print_status "Testing SSH connection..."
if $SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_status "✅ SSH connection working"
else
    print_error "❌ SSH connection failed"
    exit 1
fi

# Run cleanup on VPS
print_header "Running emergency cleanup on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << 'EOF'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS]${NC} $1"; }
print_error() { echo -e "${RED}[VPS ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS WARNING]${NC} $1"; }

print_status "🚨 EMERGENCY VPS CLEANUP STARTING"

# Show current space
print_status "Current disk usage:"
df -h /

print_status "🛑 Stopping all Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || true

print_status "🗑️  Removing all Docker containers..."
docker rm $(docker ps -aq) 2>/dev/null || true

print_status "🖼️  Removing all Docker images..."
docker rmi $(docker images -q) 2>/dev/null || true

print_status "🏗️  Removing Docker build cache..."
docker builder prune -af 2>/dev/null || true

print_status "🧽 Docker system cleanup..."
docker system prune -af --volumes 2>/dev/null || true

print_status "📦 Cleaning package manager caches..."
rm -rf ~/.npm 2>/dev/null || true
rm -rf ~/.pnpm-store 2>/dev/null || true
rm -rf ~/.local/share/pnpm 2>/dev/null || true
rm -rf ~/.cache 2>/dev/null || true

print_status "🗂️  Cleaning temporary files..."
rm -rf /tmp/* 2>/dev/null || true
rm -rf /var/tmp/* 2>/dev/null || true

print_status "🧹 Cleaning APT cache..."
apt-get clean 2>/dev/null || true
apt-get autoclean 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

print_status "📋 Cleaning logs..."
journalctl --vacuum-time=1d 2>/dev/null || true
find /var/log -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true

print_status "🗄️  Cleaning old project backups..."
rm -rf /root/pixelated-backup* 2>/dev/null || true

print_status "🐍 Cleaning Python caches..."
find /root -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find /root -name "*.pyc" -delete 2>/dev/null || true

print_status "📦 Cleaning old node_modules..."
find /root -name "node_modules" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true

print_status "✅ VPS cleanup complete!"
print_status "New disk usage:"
df -h /

print_status "🔍 Remaining large directories:"
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -10
EOF

print_header "🎉 VPS cleanup completed!"
print_status "Your VPS should now have significantly more free space"