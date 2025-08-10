#!/bin/bash

# Cleanup script for root-owned leftovers from old deployment
# Run as root or with sudo

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[CLEANUP]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "Starting cleanup of root leftovers..."

# Remove old repo backup
if [ -d "/root/pixelated-backup" ]; then
    print_status "Removing /root/pixelated-backup..."
    rm -rf /root/pixelated-backup
else
    print_status "/root/pixelated-backup not found, skipping."
fi

# Find containers using old image
OLD_IMAGE_ID=$(docker images --format '{{.ID}} {{.Repository}} {{.Tag}}' | grep 'pixelated' | awk '{print $1}')
if [ -n "$OLD_IMAGE_ID" ]; then
    print_status "Looking for containers using old image $OLD_IMAGE_ID..."
    CONTAINERS=$(docker ps -a --filter "ancestor=$OLD_IMAGE_ID" --format '{{.ID}} {{.Names}}')
    if [ -n "$CONTAINERS" ]; then
        echo "$CONTAINERS" | while read -r cid name; do
            print_status "Stopping and removing container $name ($cid)..."
            docker stop "$cid" 2>/dev/null || true
            docker rm "$cid" 2>/dev/null || true
        done
    else
        print_status "No containers found using old image."
    fi
    print_status "Removing old image $OLD_IMAGE_ID..."
    docker rmi -f "$OLD_IMAGE_ID"
else
    print_status "No old pixelated images found."
fi

# Remove Caddy config referencing /root/pixelated
print_status "Checking Caddy config for /root/pixelated references..."
if grep -q '/root/pixelated' /etc/caddy/Caddyfile 2>/dev/null; then
    print_warning "Found /root/pixelated in /etc/caddy/Caddyfile. Please update manually if needed."
else
    print_status "No /root/pixelated references in /etc/caddy/Caddyfile."
fi

# Remove systemd units referencing /root/pixelated
print_status "Checking systemd units for /root/pixelated references..."
grep -rl '/root/pixelated' /etc/systemd/system 2>/dev/null | while read -r unit; do
    print_warning "Found /root/pixelated in $unit. Please update or remove manually if needed."
done

# Remove root-owned logs/caches from old deployment
print_status "Cleaning up old logs and caches..."
rm -rf /root/.cache/pixelated /root/.local/share/pixelated /root/.config/pixelated 2>/dev/null || true

# Build new image from /home/vivi/pixelated
print_status "Building new Docker image from /home/vivi/pixelated..."
docker build -t pixelated-empathy:latest /home/vivi/pixelated

# Restart new container with new image
print_status "Restarting new container with latest image..."
docker stop pixelated-app 2>/dev/null || true
docker rm pixelated-app 2>/dev/null || true
docker run -d \
  --name pixelated-app \
  --restart unless-stopped \
  -p 4321:4321 \
  -e NODE_ENV=production \
  -e PORT=4321 \
  -e WEB_PORT=4321 \
  -e LOG_LEVEL=info \
  -e ENABLE_RATE_LIMITING=true \
  -e RATE_LIMIT_WINDOW=60 \
  -e RATE_LIMIT_MAX_REQUESTS=100 \
  -e ENABLE_HIPAA_COMPLIANCE=true \
  -e ENABLE_AUDIT_LOGGING=true \
  -e ENABLE_DATA_MASKING=true \
  -e ASTRO_TELEMETRY_DISABLED=1 \
  -e PUBLIC_URL="http://localhost:4321" \
  -e CORS_ORIGINS="http://localhost:4321" \
  pixelated-empathy:latest

print_status "Cleanup and restart complete."