#!/bin/bash

# Health Check Script for Pixelated Empathy Microservices
# This script checks the health of all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Pixelated Empathy Health Check${NC}"
echo -e "${YELLOW}Checking service health...${NC}\n"

# Function to check HTTP endpoint
check_http() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "🔍 Checking $service_name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null); then
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ Healthy (HTTP $response)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Warning (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Unhealthy (Connection failed)${NC}"
        return 1
    fi
}

# Function to check Docker service
check_docker_service() {
    local service_name=$1
    
    echo -n "🐳 Checking Docker service $service_name... "
    
    if docker-compose ps --services --filter "status=running" | grep -q "^$service_name$"; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Not running${NC}"
        return 1
    fi
}

# Track overall health
overall_health=0

echo -e "${YELLOW}📊 Docker Services Status:${NC}"
services=("web" "bias-detection" "ai-service" "analytics" "postgres" "redis" "nginx" "prometheus" "grafana")

for service in "${services[@]}"; do
    if ! check_docker_service "$service"; then
        overall_health=1
    fi
done

echo -e "\n${YELLOW}🌐 HTTP Health Checks:${NC}"

# Check web application
if ! check_http "Web Application" "http://localhost:3000"; then
    overall_health=1
fi

# Check bias detection service
if ! check_http "Bias Detection Service" "http://localhost:8001/health"; then
    overall_health=1
fi

# Check AI service
if ! check_http "AI Service" "http://localhost:8002/health"; then
    overall_health=1
fi

# Check analytics service
if ! check_http "Analytics Service" "http://localhost:8003/health"; then
    overall_health=1
fi

# Check NGINX
if ! check_http "NGINX Proxy" "http://localhost/health" "200"; then
    overall_health=1
fi

# Check Prometheus
if ! check_http "Prometheus" "http://localhost:9090/-/healthy"; then
    overall_health=1
fi

# Check Grafana
if ! check_http "Grafana" "http://localhost:3001/api/health"; then
    overall_health=1
fi

echo -e "\n${YELLOW}🗄️ Database Connectivity:${NC}"

# Check PostgreSQL connectivity
echo -n "🐘 Checking PostgreSQL... "
if docker-compose exec -T postgres pg_isready -U pixelated_user >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    overall_health=1
fi

# Check Redis connectivity
echo -n "📮 Checking Redis... "
if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    overall_health=1
fi

# Summary
echo -e "\n${YELLOW}📋 Summary:${NC}"
if [ $overall_health -eq 0 ]; then
    echo -e "${GREEN}🎉 All services are healthy!${NC}"
    echo -e "\n${YELLOW}🔗 Service URLs:${NC}"
    echo -e "🌐 Web Application: http://localhost:3000"
    echo -e "🔍 Bias Detection: http://localhost:8001"
    echo -e "🤖 AI Service: http://localhost:8002"
    echo -e "📊 Analytics: http://localhost:8003"
    echo -e "📈 Prometheus: http://localhost:9090"
    echo -e "📊 Grafana: http://localhost:3001"
    echo -e "🌍 Main Proxy: http://localhost"
else
    echo -e "${RED}⚠️  Some services are not healthy${NC}"
    echo -e "\n${YELLOW}🔧 Troubleshooting:${NC}"
    echo -e "1. Check service logs: ${BLUE}docker-compose logs [service-name]${NC}"
    echo -e "2. Restart services: ${BLUE}docker-compose restart${NC}"
    echo -e "3. Check configuration: ${BLUE}docker-compose config${NC}"
    echo -e "4. Reset environment: ${BLUE}./scripts/reset-dev.sh${NC}"
    exit 1
fi
