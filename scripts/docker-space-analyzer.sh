#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Docker Space Analyzer${NC}"
echo "=================================="

# Check system disk space
echo -e "\n${YELLOW}💾 System Disk Usage:${NC}"
df -h /

# Check Docker disk usage
echo -e "\n${YELLOW}🐳 Docker Disk Usage:${NC}"
docker system df

# Show Docker images
echo -e "\n${YELLOW}📦 Docker Images:${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Show Docker containers
echo -e "\n${YELLOW}📋 Docker Containers:${NC}"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}"

# Show build cache
echo -e "\n${YELLOW}🗂️  Build Cache:${NC}"
docker builder du

# Analyze project size
echo -e "\n${YELLOW}📊 Project Directory Sizes:${NC}"
echo "Top 10 largest directories in project:"
du -sh ./* 2>/dev/null | sort -hr | head -10

# Check node_modules size if it exists
if [ -d "node_modules" ]; then
    echo -e "\n${YELLOW}📦 Node Modules Analysis:${NC}"
    echo "node_modules size: $(du -sh node_modules | cut -f1)"
    echo "Top 10 largest packages:"
    du -sh node_modules/* 2>/dev/null | sort -hr | head -10
fi

# Check for large files
echo -e "\n${YELLOW}🔍 Large Files (>100MB):${NC}"
find . -type f -size +100M -exec ls -lh {} \; 2>/dev/null | head -10 || echo "No large files found"

# Recommendations
echo -e "\n${GREEN}💡 Recommendations:${NC}"
echo "1. Clean Docker system: docker system prune -af --volumes"
echo "2. Remove unused images: docker image prune -af"
echo "3. Clear build cache: docker builder prune -af"
echo "4. Use .dockerignore to exclude unnecessary files"
echo "5. Use multi-stage builds to reduce final image size"
echo "6. Consider using Alpine Linux base images"

# Cleanup commands
echo -e "\n${RED}🧹 Emergency Cleanup Commands:${NC}"
echo "⚠️  WARNING: These will remove data!"
echo ""
echo "# Remove all stopped containers, unused networks, images, and build cache:"
echo "docker system prune -af --volumes"
echo ""
echo "# Remove all Docker data (DESTRUCTIVE):"
echo "docker system prune -af --volumes && docker builder prune -af"
echo ""
echo "# Clean npm/pnpm cache:"
echo "pnpm store prune && npm cache clean --force"

# Check if we're running out of space
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 5000000 ]; then  # Less than 5GB
    echo -e "\n${RED}⚠️  WARNING: Low disk space detected!${NC}"
    echo "Available space: $(df -h / | awk 'NR==2 {print $4}')"
    echo "Consider running cleanup commands above."
fi