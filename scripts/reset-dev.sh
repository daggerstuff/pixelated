#!/bin/bash

# Reset Development Environment for Pixelated Empathy
# This script cleans up and resets the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Resetting Pixelated Empathy Development Environment${NC}"

# Confirm reset action
read -p "⚠️  This will remove all Docker containers, volumes, and development data. Continue? [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Reset cancelled${NC}"
    exit 0
fi

# Stop all running containers
echo -e "${YELLOW}🛑 Stopping all services...${NC}"
docker-compose down --remove-orphans

# Remove all containers, networks, and volumes
echo -e "${YELLOW}🗑️  Removing containers and volumes...${NC}"
docker-compose down -v --remove-orphans

# Remove Docker images (optional - commented out to preserve build cache)
# echo -e "${YELLOW}🖼️  Removing Docker images...${NC}"
# docker-compose down --rmi all

# Clean up data directories
echo -e "${YELLOW}🧽 Cleaning data directories...${NC}"
sudo rm -rf docker/postgres/data/*
sudo rm -rf docker/redis/data/*
sudo rm -rf docker/prometheus/data/*
sudo rm -rf docker/grafana/data/*
sudo rm -rf logs/*

# Recreate directories with proper permissions
echo -e "${YELLOW}📁 Recreating directories...${NC}"
mkdir -p docker/postgres/data
mkdir -p docker/redis/data
mkdir -p docker/prometheus/data
mkdir -p docker/grafana/data
mkdir -p logs

chmod 777 docker/postgres/data
chmod 777 docker/redis/data
chmod 777 docker/prometheus/data
chmod 777 docker/grafana/data
chmod 777 logs

# Clean Node.js dependencies (optional)
read -p "🗑️  Remove node_modules and reinstall dependencies? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📦 Cleaning Node.js dependencies...${NC}"
    rm -rf node_modules
    rm -f pnpm-lock.yaml
    pnpm install
fi

# Prune Docker system (optional)
read -p "🧹 Run Docker system prune to free up space? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️  Pruning Docker system...${NC}"
    docker system prune -f
fi

echo -e "\n${GREEN}✨ Development environment reset completed!${NC}"
echo -e "\n${YELLOW}📋 Next steps:${NC}"
echo -e "1. Run: ${GREEN}./scripts/setup-dev.sh${NC} to set up the environment again"
echo -e "2. Or run: ${GREEN}./scripts/deploy.sh${NC} to deploy all services"

echo -e "\n${GREEN}🎉 Ready for a fresh start!${NC}"
