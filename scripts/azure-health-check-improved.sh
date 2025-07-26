#!/bin/bash

# Improved Azure Health Check Script
# Optimized for faster execution and better error handling

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TIMEOUT=30  # Reduced from 230s
MAX_RETRIES=3
RETRY_DELAY=10

# Health check results
HEALTH_ISSUES=()
WARNINGS=()
PASSED_CHECKS=()

echo -e "${BLUE}🏥 AZURE HEALTH CHECK - OPTIMIZED${NC}"
echo -e "${BLUE}=================================${NC}"
echo "Started: $(date)"
echo ""

# Function to check HTTP endpoint with retries
check_endpoint_with_retry() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    local timeout=${4:-$TIMEOUT}
    
    echo -n "🔍 Checking $name... "
    
    for attempt in $(seq 1 $MAX_RETRIES); do
        local response_code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout "$timeout" \
            --max-time "$timeout" \
            --retry 0 \
            "$url" 2>/dev/null || echo "000")
        
        if [[ "$response_code" == "$expected_code" ]]; then
            echo -e "${GREEN}✅ Healthy (HTTP $response_code)${NC}"
            PASSED_CHECKS+=("$name: HTTP $response_code")
            return 0
        elif [[ "$response_code" =~ ^[23] ]]; then
            echo -e "${YELLOW}⚠️  Warning (HTTP $response_code, expected $expected_code)${NC}"
            WARNINGS+=("$name: HTTP $response_code")
            return 1
        fi
        
        if [[ $attempt -lt $MAX_RETRIES ]]; then
            echo -n "❌ Attempt $attempt failed (HTTP $response_code), retrying in ${RETRY_DELAY}s... "
            sleep $RETRY_DELAY
        fi
    done
    
    echo -e "${RED}❌ Failed after $MAX_RETRIES attempts (HTTP $response_code)${NC}"
    HEALTH_ISSUES+=("$name: HTTP $response_code after $MAX_RETRIES attempts")
    return 1
}

# Function to check DNS resolution
check_dns() {
    local domain=$1
    echo -n "🌐 Checking DNS for $domain... "
    
    if nslookup "$domain" >/dev/null 2>&1; then
        local ip=$(nslookup "$domain" | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
        echo -e "${GREEN}✅ Resolved to $ip${NC}"
        PASSED_CHECKS+=("DNS $domain: Resolved to $ip")
        
        # Check if it's pointing to parking service
        if [[ "$ip" =~ ^108\.159\.227\. ]]; then
            echo -e "${RED}⚠️  WARNING: DNS points to parking service IP ($ip)${NC}"
            WARNINGS+=("DNS $domain: Points to parking service IP $ip")
        fi
        return 0
    else
        echo -e "${RED}❌ DNS resolution failed${NC}"
        HEALTH_ISSUES+=("DNS $domain: Resolution failed")
        return 1
    fi
}

# Function to check Azure App Service status
check_app_service() {
    local resource_group=$1
    local app_name=$2
    
    echo -n "☁️  Checking Azure App Service status... "
    
    local status
    status=$(az webapp show --resource-group "$resource_group" --name "$app_name" --query "state" -o tsv 2>/dev/null || echo "unknown")
    
    if [[ "$status" == "Running" ]]; then
        echo -e "${GREEN}✅ Running${NC}"
        PASSED_CHECKS+=("Azure App Service: Running")
        return 0
    else
        echo -e "${RED}❌ Status: $status${NC}"
        HEALTH_ISSUES+=("Azure App Service: Status $status")
        return 1
    fi
}

# Function to get app service URL
get_app_service_url() {
    local resource_group=$1
    local app_name=$2
    
    echo -n "🔍 Getting App Service URL... "
    
    local url
    url=$(az webapp show --resource-group "$resource_group" --name "$app_name" --query "defaultHostName" -o tsv 2>/dev/null || echo "")
    
    if [[ -n "$url" ]]; then
        url="https://$url"
        echo -e "${GREEN}✅ $url${NC}"
        echo "$url"
        return 0
    else
        echo -e "${RED}❌ Could not retrieve URL${NC}"
        HEALTH_ISSUES+=("App Service URL: Could not retrieve")
        return 1
    fi
}

# Main health check execution
main() {
    # Get Azure App Service details from environment or parameters
    local resource_group="${AZURE_RESOURCE_GROUP:-}"
    local app_name="${AZURE_APP_NAME:-}"
    
    if [[ -z "$resource_group" || -z "$app_name" ]]; then
        echo -e "${YELLOW}⚠️  Azure resource details not provided, skipping App Service checks${NC}"
    else
        # Check Azure App Service status
        check_app_service "$resource_group" "$app_name"
        
        # Get App Service URL
        local app_url
        app_url=$(get_app_service_url "$resource_group" "$app_name")
        
        if [[ -n "$app_url" ]]; then
            # Check App Service health endpoint
            check_endpoint_with_retry "App Service Health" "$app_url/api/health" 200 15
            
            # Check App Service simple health endpoint
            check_endpoint_with_retry "App Service Simple Health" "$app_url/api/health/simple" 200 10
        fi
    fi
    
    # Check custom domain
    check_dns "pixelatedempathy.com"
    check_endpoint_with_retry "Custom Domain" "https://pixelatedempathy.com/api/health/simple" 200 15
    
    # Check main application
    check_endpoint_with_retry "Main Application" "https://pixelatedempathy.com" 200 20
    
    # Summary
    echo ""
    echo -e "${BLUE}📋 HEALTH CHECK SUMMARY${NC}"
    echo -e "${BLUE}======================${NC}"
    
    echo -e "\n${GREEN}✅ PASSED CHECKS (${#PASSED_CHECKS[@]}):${NC}"
    for check in "${PASSED_CHECKS[@]}"; do
        echo "  ✅ $check"
    done
    
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo -e "\n${YELLOW}⚠️  WARNINGS (${#WARNINGS[@]}):${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo "  ⚠️  $warning"
        done
    fi
    
    if [[ ${#HEALTH_ISSUES[@]} -gt 0 ]]; then
        echo -e "\n${RED}❌ HEALTH ISSUES (${#HEALTH_ISSUES[@]}):${NC}"
        for issue in "${HEALTH_ISSUES[@]}"; do
            echo "  ❌ $issue"
        done
        
        echo -e "\n${YELLOW}🔧 RECOMMENDED ACTIONS:${NC}"
        echo "1. Check DNS configuration for pixelatedempathy.com"
        echo "2. Verify CloudFront distribution is properly configured"
        echo "3. Check application startup logs in Azure App Service"
        echo "4. Verify SSL certificate is valid and not expired"
        echo "5. Check if application is properly deployed and running"
        
        return 1
    else
        echo -e "\n${GREEN}🎉 All critical health checks passed!${NC}"
        return 0
    fi
}

# Execute main function
main "$@"
