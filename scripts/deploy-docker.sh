#!/bin/bash

# Pixelated Empathy - Docker Deployment Script
# This script builds and deploys the application using Docker

set -e

# Configuration
VPS_HOST="${VPS_HOST:-208.117.84.253}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
SSH_KEY="${SSH_KEY:-/home/vivi/.ssh/planet}"
DOMAIN="${DOMAIN:-pixelatedempathy.com}"
IMAGE_NAME="pixelated-empathy"
CONTAINER_NAME="pixelated-empathy"
APP_PORT="4321"
HOST_PORT="80"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# SSH command helper
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -p $VPS_PORT"

print_header "🚀 Starting Docker deployment for Pixelated Empathy"
echo "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
echo "Image: $IMAGE_NAME"
echo "Container: $CONTAINER_NAME"
echo ""

# Test SSH connection
print_header "Testing SSH connection..."
if $SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'"; then
    print_success "SSH connection working"
else
    print_error "SSH connection failed"
    exit 1
fi

# Build Docker image locally
print_header "Building Docker image..."
if docker build -t "$IMAGE_NAME:latest" .; then
    print_success "Docker image built successfully"
else
    print_error "Docker build failed"
    exit 1
fi

# Save Docker image to tar.gz
print_header "Saving Docker image..."
if docker save "$IMAGE_NAME:latest" | gzip > "$IMAGE_NAME.tar.gz"; then
    IMAGE_SIZE=$(du -h "$IMAGE_NAME.tar.gz" | cut -f1)
    print_success "Docker image saved ($IMAGE_SIZE)"
else
    print_error "Failed to save Docker image"
    exit 1
fi

# Copy image to VPS
print_header "Copying Docker image to VPS..."
if scp -i "$SSH_KEY" -P "$VPS_PORT" "$IMAGE_NAME.tar.gz" "$VPS_USER@$VPS_HOST:/tmp/"; then
    print_success "Docker image copied to VPS"
else
    print_error "Failed to copy Docker image"
    exit 1
fi

# Deploy on VPS
print_header "Deploying on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" << EOF
set -e

echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME || echo "Container not running"
docker rm $CONTAINER_NAME || echo "Container not found"

echo "📦 Loading Docker image..."
cd /tmp
docker load < $IMAGE_NAME.tar.gz
rm $IMAGE_NAME.tar.gz

echo "🚀 Starting new container..."
docker run -d \\
  --name $CONTAINER_NAME \\
  --restart unless-stopped \\
  -p $HOST_PORT:$APP_PORT \\
  -e NODE_ENV=production \\
  -e HOST=0.0.0.0 \\
  -e PORT=$APP_PORT \\
  --health-cmd="curl -f http://localhost:$APP_PORT/api/health/simple || exit 1" \\
  --health-interval=30s \\
  --health-timeout=10s \\
  --health-start-period=30s \\
  --health-retries=3 \\
  $IMAGE_NAME:latest

echo "⏳ Waiting for container to be healthy..."
timeout 120 bash -c 'until docker inspect --format="{{.State.Health.Status}}" $CONTAINER_NAME | grep -q "healthy"; do sleep 5; echo "Waiting for health check..."; done' || {
  echo "❌ Container failed to become healthy"
  docker logs $CONTAINER_NAME
  exit 1
}

echo "✅ Container is healthy!"
docker ps | grep $CONTAINER_NAME

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"
echo "🌐 Application should be available at: http://$VPS_HOST"
EOF

# Clean up local files
rm -f "$IMAGE_NAME.tar.gz"

print_success "🎉 Deployment completed successfully!"
print_success "🌐 Application should be available at: http://$VPS_HOST"
