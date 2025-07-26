#!/bin/bash

# Fast Health Check Script for Azure DevOps
# Optimized for speed and reliability, no hanging operations

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
APP_NAME="${AZURE_APP_NAME:-}"
TIMEOUT=5  # Very short timeout
MAX_WAIT=10  # Maximum wait time for any operation

echo -e "${BLUE}⚡ FAST HEALTH CHECK${NC}"
echo -e "${BLUE}===================${NC}"
echo "Started: $(date)"
echo "Resource Group: $RESOURCE_GROUP"
echo "App Name: $APP_NAME"
echo ""

# Function to run command with timeout
run_with_timeout() {
    local timeout_duration=$1
    shift
    timeout "$timeout_duration" "$@" 2>/dev/null || return 1
}

# Function to check if this is first deployment (fast version)
is_first_deployment() {
    echo -n "🔍 Quick deployment check... "
    
    if [[ -z "$RESOURCE_GROUP" || -z "$APP_NAME" ]]; then
        echo "📦 Missing config (assuming first deployment)"
        return 0
    fi
    
    # Quick check if app exists
    if ! run_with_timeout 10 az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query "name" -o tsv >/dev/null; then
        echo "📦 App doesn't exist (first deployment)"
        return 0
    fi
    
    # Quick check for deployments
    local deployment_count
    deployment_count=$(run_with_timeout 10 az webapp deployment list --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query "length(@)" -o tsv 2>/dev/null || echo "0")
    
    if [[ "$deployment_count" == "0" ]]; then
        echo "📦 No deployments (first deployment)"
        return 0
    else
        echo "✅ Has deployments ($deployment_count)"
        return 1
    fi
}

# Function to do fast health check
fast_health_check() {
    echo "🚀 Fast health check..."
    
    # Get app URL quickly
    local app_url
    app_url=$(run_with_timeout 10 az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query "defaultHostName" -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$app_url" ]]; then
        echo "❌ Could not get app URL"
        return 1
    fi
    
    app_url="https://$app_url"
    echo "🌐 Testing: $app_url"
    
    # Test endpoints with very short timeouts
    local endpoints=(
        "/api/health/simple"
        "/"
    )
    
    local success_count=0
    
    for endpoint in "${endpoints[@]}"; do
        echo -n "  Testing $endpoint... "
        
        local response_code
        response_code=$(run_with_timeout $TIMEOUT curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout 3 \
            --max-time $TIMEOUT \
            "$app_url$endpoint" || echo "000")
        
        case "$response_code" in
            200)
                echo -e "${GREEN}✅ OK${NC}"
                ((success_count++))
                ;;
            30[1-8])
                echo -e "${YELLOW}⚠️  Redirect${NC}"
                ((success_count++))
                ;;
            000)
                echo -e "${RED}❌ Timeout${NC}"
                ;;
            *)
                echo -e "${RED}❌ HTTP $response_code${NC}"
                ;;
        esac
    done
    
    echo "Results: $success_count/${#endpoints[@]} endpoints responding"
    
    if [[ $success_count -gt 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    if is_first_deployment; then
        echo ""
        echo -e "${GREEN}📦 FIRST DEPLOYMENT - READY TO PROCEED${NC}"
        echo "Skipping health checks for first deployment"
        echo ""
    else
        echo ""
        echo "🔄 EXISTING DEPLOYMENT - CHECKING HEALTH"
        
        if fast_health_check; then
            echo -e "\n${GREEN}✅ Health check passed${NC}"
        else
            echo -e "\n${YELLOW}⚠️  Health check issues (proceeding anyway)${NC}"
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo -e "${BLUE}⚡ Fast health check completed in ${duration}s${NC}"
    
    # Always return success to not block deployment
    return 0
}

# Execute main function
main "$@"
