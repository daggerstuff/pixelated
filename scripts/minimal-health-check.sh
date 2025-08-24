#!/bin/bash

# Enhanced Health Check for Azure App Service
# Tests Azure App Service first, then custom domain

set -euo pipefail

APP_NAME="${1:-pixelated}"
CUSTOM_DOMAIN="${2:-pixelatedempathy.com}"

echo "🏥 Running PRODUCTION health checks"
echo "ℹ️ Testing Azure App Service first, then custom domain"

# Get App Service URL
APP_URL=$(az webapp show --name "$APP_NAME" --resource-group pixelated-rg --query defaultHostName --output tsv 2>/dev/null || echo "pixelated.azurewebsites.net")

AZURE_URL="https://$APP_URL"
CUSTOM_URL="https://$CUSTOM_DOMAIN"

echo "Azure App Service: $AZURE_URL"
echo "Custom Domain: $CUSTOM_URL"

# Function to check endpoint with detailed logging
check_endpoint() {
  local url="$1"
  local endpoint_name="$2"
  local max_attempts=3
  
  for attempt in $(seq 1 $max_attempts); do
    echo "🔄 Checking $endpoint_name (attempt $attempt/$max_attempts): $url"
    
    # Use curl with comprehensive error reporting
    local curl_output
    curl_output=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total};CONNECT:%{time_connect}" \
                      --connect-timeout 15 \
                      --max-time 45 \
                      --user-agent "Azure-HealthCheck/1.0" \
                      --location \
                      --fail-with-body \
                      "$url" 2>&1 || echo "HTTPSTATUS:000;TIME:0;CONNECT:0;ERROR:Connection failed")
    
    # Parse curl output
    local status="000"
    local total_time="0"
    
    if [[ $curl_output =~ HTTPSTATUS:([0-9]+) ]]; then
      status="${BASH_REMATCH[1]}"
    fi
    
    if [[ $curl_output =~ TIME:([0-9.]+) ]]; then
      total_time="${BASH_REMATCH[1]}"
    fi
    
    echo "📊 $endpoint_name HTTP Status: $status"
    
    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
      echo "✅ $endpoint_name health check passed (${total_time}s)"
      return 0
    elif [ "$status" = "000" ]; then
      echo "⚠️ $endpoint_name connection failed - possible DNS/network issue"
    else
      echo "⚠️ $endpoint_name returned HTTP $status"
    fi
    
    if [ $attempt -lt $max_attempts ]; then
      local wait_time=$((attempt * 10))
      echo "⏳ Waiting ${wait_time}s before retry..."
      sleep $wait_time
    fi
  done
  
  echo "❌ $endpoint_name health check failed after $max_attempts attempts"
  return 1
}

# Test Azure App Service first (most likely to work)
echo ""
echo "=== Testing Azure App Service ==="
AZURE_SUCCESS=false

AZURE_ENDPOINTS=(
  "$AZURE_URL"
  "$AZURE_URL/api/health/simple"
  "$AZURE_URL/api/health"
)

AZURE_NAMES=(
  "Azure App Service Root"
  "Azure Health Simple API"
  "Azure Health Main API"
)

for i in "${!AZURE_ENDPOINTS[@]}"; do
  if check_endpoint "${AZURE_ENDPOINTS[$i]}" "${AZURE_NAMES[$i]}"; then
    AZURE_SUCCESS=true
    break
  fi
done

# Test Custom Domain
echo ""
echo "=== Testing Custom Domain ==="
CUSTOM_SUCCESS=false

CUSTOM_ENDPOINTS=(
  "$CUSTOM_URL"
  "$CUSTOM_URL/api/health/simple"
  "$CUSTOM_URL/api/health"
)

CUSTOM_NAMES=(
  "Custom Domain Root"
  "Custom Domain Health Simple API"
  "Custom Domain Health Main API"
)

for i in "${!CUSTOM_ENDPOINTS[@]}"; do
  if check_endpoint "${CUSTOM_ENDPOINTS[$i]}" "${CUSTOM_NAMES[$i]}"; then
    CUSTOM_SUCCESS=true
    break
  fi
done

# Report results
echo ""
echo "=== Health Check Summary ==="
if [ "$AZURE_SUCCESS" = true ]; then
  echo "✅ Azure App Service: HEALTHY"
else
  echo "❌ Azure App Service: FAILED"
fi

if [ "$CUSTOM_SUCCESS" = true ]; then
  echo "✅ Custom Domain: HEALTHY"
else
  echo "❌ Custom Domain: FAILED"
fi

# Determine overall status
if [ "$AZURE_SUCCESS" = true ] && [ "$CUSTOM_SUCCESS" = true ]; then
  echo ""
  echo "🎉 All systems healthy!"
  exit 0
elif [ "$AZURE_SUCCESS" = true ]; then
  echo ""
  echo "⚠️ Azure App Service is healthy, but custom domain has issues"
  echo "🔍 DNS Configuration Issue:"
  echo "   Your custom domain $CUSTOM_DOMAIN needs to point to $APP_URL"
  echo "   Current DNS points to: $(dig +short $CUSTOM_DOMAIN | head -1)"
  echo "   Should point to: $APP_URL (CNAME) or Azure IP (A record)"
  
  # Non-blocking for CI/CD - Azure is working
  exit 0
else
  echo ""
  echo "❌ Both Azure App Service and custom domain failed"
  echo "🔍 Troubleshooting steps:"
  echo "   1. Check Azure App Service deployment status"
  echo "   2. Review application logs in Azure portal"
  echo "   3. Verify application is starting correctly"
  echo "   4. Check for configuration issues"
  
  # This is a real problem - exit with error
  exit 1
fi