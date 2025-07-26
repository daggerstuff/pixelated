#!/bin/bash

# Deploy Pixelated Empathy Microservices
# This script handles the complete deployment of the microservices architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

echo -e "${GREEN}🚀 Deploying Pixelated Empathy Microservices${NC}"

# Check if required files exist
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Docker Compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Environment file not found. Copying from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Please edit .env file with your actual values before running again${NC}"
        exit 1
    else
        echo -e "${RED}❌ No .env.example file found${NC}"
        exit 1
    fi
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
echo -e "${YELLOW}🔍 Checking dependencies...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies check passed${NC}"

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p docker/postgres/data
mkdir -p docker/redis/data
mkdir -p docker/prometheus/data
mkdir -p docker/grafana/data
mkdir -p logs

# Set proper permissions
chmod 777 docker/postgres/data
chmod 777 docker/redis/data
chmod 777 docker/prometheus/data
chmod 777 docker/grafana/data
chmod 777 logs

# Build and start services
echo -e "${YELLOW}🏗️  Building images...${NC}"
docker compose build

echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"

# List of services to check for health
SERVICES_TO_CHECK=("nginx" "frontend" "bias-detection-service")

for service in "${SERVICES_TO_CHECK[@]}"; do
    echo -e "${YELLOW}Waiting for $service to be healthy...${NC}"
    until [ "$(docker inspect --format='{{.State.Health.Status}}' $(docker compose ps -q $service))" = "healthy" ]; do
        sleep 5;
    done
    echo -e "${GREEN}✅ $service is healthy!${NC}"
done

# Display access information
echo -e "\n${GREEN}🎉 Deployment completed!${NC}"
echo -e "\n${YELLOW}📋 Service URLs:${NC}"
echo -e "🌐 Web Application: http://localhost"
echo -e "🔍 Bias Detection API (via Nginx): http://localhost/api/bias-detection"
# Add other service URLs as needed, e.g., for Grafana, Prometheus if they are added to docker-compose.yml
# echo -e "📊 Grafana Dashboard: http://localhost:3001 (admin/admin)"
# echo -e "📈 Prometheus: http://localhost:9090"
# echo -e "🤖 AI Service API: http://localhost:8002"
# echo -e "📊 Analytics API: http://localhost:8003"


echo -e "\n${YELLOW}📋 Useful commands:${NC}"
echo -e "View logs: docker compose logs -f [service_name]"
echo -e "Stop services: docker compose down"
echo -e "Restart service: docker compose restart [service_name]"
echo -e "View status: docker compose ps"

echo -e "\n${GREEN}✨ Happy coding!${NC}"
