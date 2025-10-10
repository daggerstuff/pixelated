#!/bin/bash
# Traefik Migration Test Script

set -e

echo "🔍 Testing Traefik Migration..."
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local url=$1
    local expected_status=$2
    local test_name=$3
    
    echo -n "Testing $test_name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status)"
        return 1
    fi
}

# Check if Traefik is running
echo -e "\n${YELLOW}1. Checking Traefik container...${NC}"
if docker ps | grep -q traefik; then
    echo -e "${GREEN}✓${NC} Traefik container is running"
else
    echo -e "${RED}✗${NC} Traefik container is not running"
    exit 1
fi

# Check Traefik metrics endpoint
echo -e "\n${YELLOW}2. Checking Traefik metrics...${NC}"
test_endpoint "http://localhost:8082/metrics" 200 "Prometheus metrics"

# Check configuration files exist
echo -e "\n${YELLOW}3. Checking configuration files...${NC}"
files=(
    "docker/traefik/traefik.yml"
    "docker/traefik/dynamic.yml"
    "docker/traefik/Dockerfile"
    "docker/traefik/README.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file is missing"
    fi
done

# Check NGINX is removed
echo -e "\n${YELLOW}4. Verifying NGINX removal...${NC}"
if [ ! -d "load-balancer" ]; then
    echo -e "${GREEN}✓${NC} load-balancer directory removed"
else
    echo -e "${RED}✗${NC} load-balancer directory still exists"
fi

if [ ! -d "docker/nginx" ]; then
    echo -e "${GREEN}✓${NC} docker/nginx directory removed"
else
    echo -e "${RED}✗${NC} docker/nginx directory still exists"
fi

# Check docker-compose files updated
echo -e "\n${YELLOW}5. Checking docker-compose updates...${NC}"
if grep -q "traefik:" docker-compose.prod.yml; then
    echo -e "${GREEN}✓${NC} docker-compose.prod.yml uses Traefik"
else
    echo -e "${RED}✗${NC} docker-compose.prod.yml not updated"
fi

if grep -q "traefik:" mcp_server/docker-compose.yml; then
    echo -e "${GREEN}✓${NC} mcp_server/docker-compose.yml uses Traefik"
else
    echo -e "${RED}✗${NC} mcp_server/docker-compose.yml not updated"
fi

# Check Prometheus config
echo -e "\n${YELLOW}6. Checking Prometheus configuration...${NC}"
if grep -q "job_name: 'traefik'" monitoring/prometheus/prometheus.yml; then
    echo -e "${GREEN}✓${NC} Prometheus configured to scrape Traefik"
else
    echo -e "${RED}✗${NC} Prometheus config not updated"
fi

if grep -q "nginx-exporter" monitoring/prometheus/prometheus.yml; then
    echo -e "${YELLOW}⚠${NC} NGINX exporter still in Prometheus config (can be removed)"
fi

# Test rate limiting (if service is up)
echo -e "\n${YELLOW}7. Testing rate limiting (optional)...${NC}"
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "Sending 10 rapid requests to test rate limiting..."
    for i in {1..10}; do
        status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/test 2>/dev/null || echo "000")
        echo -n "$status "
    done
    echo ""
    echo -e "${YELLOW}ℹ${NC} Check if any requests were rate limited (HTTP 429)"
else
    echo -e "${YELLOW}⊘${NC} Service not accessible for rate limit testing"
fi

# Summary
echo -e "\n${YELLOW}================================${NC}"
echo -e "✅ Traefik migration verification complete!"
echo ""
echo "Next steps:"
echo "1. Review configuration in docker/traefik/"
echo "2. Update environment variables if needed"
echo "3. Deploy with: docker-compose -f docker-compose.prod.yml up -d"
echo "4. Monitor logs: docker logs traefik -f"
echo "5. Access dashboard: https://traefik.pixelated-empathy.com"
echo ""
echo "Documentation: docker/traefik/README.md"
echo "Migration guide: docs/NGINX_TO_TRAEFIK_MIGRATION.md"
