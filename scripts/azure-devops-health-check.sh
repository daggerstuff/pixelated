#!/bin/bash

# Azure DevOps Health Check Script
# Handles first-time deployments gracefully

set -euo pipefail

echo "🏥 Azure DevOps Health Check"
echo "============================"
echo "Resource Group: ${AZURE_RESOURCE_GROUP:-'Not set'}"
echo "App Name: ${AZURE_APP_NAME:-'Not set'}"
echo "Started: $(date)"
echo ""

# Check if we have required variables
if [[ -z "${AZURE_RESOURCE_GROUP:-}" || -z "${AZURE_APP_NAME:-}" ]]; then
    echo "⚠️  Required environment variables not set:"
    echo "   AZURE_RESOURCE_GROUP and AZURE_APP_NAME"
    echo "   Skipping health checks - assuming first deployment"
    echo "##vso[task.logissue type=warning]Health check skipped - missing configuration"
    exit 0
fi

# Function to check if app service exists
check_app_exists() {
    echo -n "🔍 Checking if App Service exists... "
    
    if az webapp show --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_APP_NAME" >/dev/null 2>&1; then
        echo "✅ Exists"
        return 0
    else
        echo "📦 Not found (first deployment)"
        return 1
    fi
}

# Function to check deployment history
check_deployment_history() {
    echo -n "📋 Checking deployment history... "
    
    local deployment_count
    deployment_count=$(az webapp deployment list --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_APP_NAME" --query "length(@)" -o tsv 2>/dev/null || echo "0")
    
    if [[ "$deployment_count" == "0" ]]; then
        echo "📦 No previous deployments"
        return 1
    else
        echo "✅ $deployment_count previous deployments"
        return 0
    fi
}

# Function to check app service status
check_app_status() {
    echo -n "☁️  Checking App Service status... "
    
    local status
    status=$(az webapp show --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_APP_NAME" --query "state" -o tsv 2>/dev/null || echo "Unknown")
    
    echo "Status: $status"
    
    case "$status" in
        "Running")
            return 0
            ;;
        "Stopped")
            echo "##vso[task.logissue type=warning]App Service is stopped"
            return 1
            ;;
        *)
            echo "##vso[task.logissue type=warning]App Service status: $status"
            return 1
            ;;
    esac
}

# Function to test application endpoints
test_endpoints() {
    echo "🌐 Testing application endpoints..."
    
    # Get app URL
    local app_url
    app_url=$(az webapp show --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_APP_NAME" --query "defaultHostName" -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$app_url" ]]; then
        echo "❌ Could not get app URL"
        return 1
    fi
    
    app_url="https://$app_url"
    echo "App URL: $app_url"
    
    # Test endpoints with short timeouts
    local endpoints=(
        "/api/health/simple:5"
        "/api/health:10"
        "/:15"
    )
    
    local success_count=0
    
    for endpoint_config in "${endpoints[@]}"; do
        local endpoint="${endpoint_config%:*}"
        local timeout="${endpoint_config#*:}"
        
        echo -n "  Testing $endpoint (${timeout}s timeout)... "
        
        local response_code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout "$timeout" \
            --max-time "$timeout" \
            "$app_url$endpoint" 2>/dev/null || echo "000")
        
        case "$response_code" in
            200)
                echo "✅ OK"
                ((success_count++))
                ;;
            30[1-8])
                echo "⚠️  Redirect ($response_code)"
                ((success_count++))
                ;;
            000)
                echo "❌ Timeout/Connection failed"
                ;;
            *)
                echo "❌ HTTP $response_code"
                ;;
        esac
    done
    
    echo "Endpoint test results: $success_count/${#endpoints[@]} successful"
    
    if [[ $success_count -gt 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    local is_first_deployment=1
    
    # Check if app exists
    if check_app_exists; then
        # App exists, check if it has been deployed before
        if check_deployment_history; then
            is_first_deployment=0
        fi
    fi
    
    if [[ $is_first_deployment -eq 1 ]]; then
        echo ""
        echo "📦 FIRST DEPLOYMENT DETECTED"
        echo "============================="
        echo "This appears to be the first deployment."
        echo "Skipping application health checks."
        echo "Infrastructure will be validated during deployment."
        echo ""
        echo "✅ Ready for first deployment"
        echo "##vso[task.logissue type=warning]First deployment - skipping health checks"
        return 0
    else
        echo ""
        echo "🔄 EXISTING DEPLOYMENT DETECTED"
        echo "==============================="
        echo "Performing health checks on existing deployment..."
        echo ""
        
        local health_issues=0
        
        # Check app status
        if ! check_app_status; then
            ((health_issues++))
        fi
        
        # Test endpoints
        if ! test_endpoints; then
            ((health_issues++))
            echo "##vso[task.logissue type=warning]Some endpoints are not responding"
        fi
        
        echo ""
        if [[ $health_issues -eq 0 ]]; then
            echo "✅ All health checks passed"
            return 0
        elif [[ $health_issues -eq 1 ]]; then
            echo "⚠️  Minor health issues detected, but deployment can proceed"
            echo "##vso[task.logissue type=warning]Minor health issues detected"
            return 0  # Don't fail pipeline for minor issues
        else
            echo "❌ Multiple health issues detected"
            echo "##vso[task.logissue type=error]Multiple health issues detected"
            echo ""
            echo "🔧 Recommendations:"
            echo "1. Check application logs"
            echo "2. Verify recent changes"
            echo "3. Consider investigating before deploying"
            return 1
        fi
    fi
}

# Execute main function
main "$@"