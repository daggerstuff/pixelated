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
print_header() { echo -e "${BLUE}[DEBUG]${NC} $1"; }

# Build SSH command
SSH_CMD="ssh -t"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -p $VPS_PORT -o StrictHostKeyChecking=no"

print_header "🔍 DEBUGGING SPACE USAGE ON VPS: $VPS_HOST"

# Test SSH connection
print_status "Testing SSH connection..."
if $SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_status "✅ SSH connection working"
else
    print_error "❌ SSH connection failed"
    exit 1
fi

# Run comprehensive space analysis on VPS
print_header "Running space analysis on VPS..."
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
print_header() { echo -e "${BLUE}[VPS DEBUG]${NC} $1"; }

print_header "🔍 VPS SPACE DETECTIVE - Finding what's eating 150GB"
echo "======================================================"

print_status "📊 OVERALL DISK USAGE:"
df -h

print_status "🗂️  ROOT DIRECTORY BREAKDOWN:"
du -h --max-depth=1 / 2>/dev/null | sort -hr

print_status "🐳 DOCKER SPACE USAGE:"
if command -v docker &> /dev/null; then
    docker system df -v 2>/dev/null || echo "Docker system df failed"
    
    print_status "Docker root directory:"
    du -sh /var/lib/docker 2>/dev/null || echo "Cannot access /var/lib/docker"
    
    print_status "Docker overlay2 (container layers):"
    du -sh /var/lib/docker/overlay2 2>/dev/null || echo "Cannot access overlay2"
    
    print_status "Docker images:"
    du -sh /var/lib/docker/image 2>/dev/null || echo "Cannot access docker images"
    
    print_status "Docker containers:"
    du -sh /var/lib/docker/containers 2>/dev/null || echo "Cannot access docker containers"
    
    print_status "Docker build cache:"
    docker builder du 2>/dev/null || echo "No build cache info"
    
    print_status "All Docker images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>/dev/null || echo "No images"
    
    print_status "Docker containers (all):"
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}" 2>/dev/null || echo "No containers"
else
    print_warning "Docker not installed or not accessible"
fi

print_status "📁 LARGEST FILES ON SYSTEM (>500MB):"
find / -type f -size +500M -exec ls -lh {} \; 2>/dev/null | head -20 || echo "No large files found"

print_status "🗄️  LOG FILES:"
du -sh /var/log/* 2>/dev/null | sort -hr | head -10 || echo "No log files"

print_status "💾 TEMP DIRECTORIES:"
echo "/tmp usage:"
du -sh /tmp/* 2>/dev/null | sort -hr | head -10 || echo "Empty /tmp"
echo "/var/tmp usage:"
du -sh /var/tmp/* 2>/dev/null | sort -hr | head -10 || echo "Empty /var/tmp"

print_status "🏠 HOME DIRECTORIES:"
du -sh /home/* 2>/dev/null | sort -hr || echo "No home directories"
du -sh /root/* 2>/dev/null | sort -hr | head -10 || echo "Empty /root"

print_status "🔧 PACKAGE MANAGER CACHES:"
echo "APT cache:"
du -sh /var/cache/apt 2>/dev/null || echo "N/A"
echo "NPM cache:"
du -sh ~/.npm 2>/dev/null || echo "N/A"
echo "PNPM store:"
du -sh ~/.local/share/pnpm 2>/dev/null || echo "N/A"
du -sh ~/.pnpm-store 2>/dev/null || echo "N/A"

print_status "🐍 PYTHON/NODE CACHES:"
find /root -name "__pycache__" -type d -exec du -sh {} \; 2>/dev/null | head -10 || echo "No Python caches"
find /root -name "node_modules" -type d -exec du -sh {} \; 2>/dev/null | head -10 || echo "No node_modules"

print_status "📦 PROJECT DIRECTORIES:"
if [ -d "/root/pixelated" ]; then
    echo "Current pixelated project:"
    du -sh /root/pixelated/* 2>/dev/null | sort -hr | head -10
    
    if [ -d "/root/pixelated/node_modules" ]; then
        echo "node_modules breakdown:"
        du -sh /root/pixelated/node_modules/* 2>/dev/null | sort -hr | head -10
    fi
fi

if [ -d "/root/pixelated-backup" ]; then
    echo "Backup pixelated project:"
    du -sh /root/pixelated-backup 2>/dev/null
fi

print_status "🚨 DOCKER BUILD ARTIFACTS:"
if [ -d "/var/lib/docker/tmp" ]; then
    echo "Docker tmp:"
    du -sh /var/lib/docker/tmp 2>/dev/null
fi

if [ -d "/var/lib/docker/buildkit" ]; then
    echo "Docker buildkit:"
    du -sh /var/lib/docker/buildkit 2>/dev/null
fi

# Check for any massive directories
print_status "🎯 DIRECTORIES OVER 1GB:"
find / -type d -exec du -s {} \; 2>/dev/null | awk '$1 > 1048576 {print $1/1024 "MB", $2}' | sort -nr | head -20

print_status "🔍 ANALYSIS COMPLETE"
print_warning "Look for the largest consumers above - likely Docker overlay2, build cache, or multiple node_modules"
EOF

print_header "🎉 VPS space analysis complete!"
print_status "Check the output above to identify what's consuming your 150GB"