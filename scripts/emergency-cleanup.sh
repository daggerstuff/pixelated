#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}🚨 EMERGENCY DOCKER CLEANUP${NC}"
echo "This will remove Docker containers, images, and build cache!"
echo ""

# Show current space
echo -e "${YELLOW}Current disk usage:${NC}"
df -h /

read -p "Continue with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

echo -e "${YELLOW}🧹 Stopping all containers...${NC}"
docker stop $(docker ps -aq) 2>/dev/null || true

echo -e "${YELLOW}🗑️  Removing all containers...${NC}"
docker rm $(docker ps -aq) 2>/dev/null || true

echo -e "${YELLOW}🖼️  Removing all images...${NC}"
docker rmi $(docker images -q) 2>/dev/null || true

echo -e "${YELLOW}🏗️  Removing build cache...${NC}"
docker builder prune -af

echo -e "${YELLOW}🧽 System cleanup...${NC}"
docker system prune -af --volumes

echo -e "${YELLOW}📦 Cleaning package manager caches...${NC}"
pnpm store prune 2>/dev/null || true
npm cache clean --force 2>/dev/null || true

echo -e "${YELLOW}🗂️  Cleaning temporary files...${NC}"
rm -rf /tmp/.astro 2>/dev/null || true
rm -rf /tmp/.vite 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo -e "${YELLOW}New disk usage:${NC}"
df -h /