#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting optimized Docker build...${NC}"

# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Clean up any existing containers/images to free space
echo -e "${YELLOW}🧹 Cleaning up existing Docker resources...${NC}"
docker system prune -f --volumes || true
docker builder prune -f || true

# Check available disk space
echo -e "${YELLOW}💾 Checking disk space...${NC}"
df -h /

# Build with optimizations
echo -e "${GREEN}🔨 Building Docker image with optimizations...${NC}"
docker build \
  --progress=plain \
  --no-cache \
  --rm \
  --compress \
  --squash \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --build-arg NODE_VERSION=22 \
  --build-arg PNPM_VERSION=10.15.0 \
  -t pixelated:latest \
  -t pixelated:$(date +%Y%m%d-%H%M%S) \
  .

echo -e "${GREEN}✅ Docker build completed successfully!${NC}"

# Show final image size
echo -e "${YELLOW}📊 Final image size:${NC}"
docker images pixelated:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Clean up build cache after successful build
echo -e "${YELLOW}🧹 Cleaning up build cache...${NC}"
docker builder prune -f

echo -e "${GREEN}🎉 Build process complete!${NC}"