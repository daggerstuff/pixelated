#!/bin/bash

# Production Health Check Script
# Comprehensive health monitoring for production deployment

set -euo pipefail

# Configuration
BASE_URL="${1:-https://pixelatedempathy.com}"
TIMEOUT="${2:-30}"
MAX_RETRIES="${3:-3}"

echo "🏥 Running PRODUCTION health checks against $BASE_URL"
echo "ℹ️ Production failures will trigger alerts and notifications"

# Health check endpoints to test
declare -A ENDPOINTS=(
  ["Main Site"]="$BASE_URL"
  ["Health API"]="$BASE_URL/api/health"
  ["Simple Health"]="$BASE_URL/api/health/simple"
  ["V1 Health"]="$BASE_URL/api/v1/health"
)

# Function to perform health check with retries
check_endpoint() {
  local name="$1"
  local url="$2"
  local success=false
  
  for attempt in $(seq 1 $MAX_RETRIES); do
    echo "🔄 Checking $name (attempt $attempt/$MAX_RETRIES): $url"
    
    # Perform the health check
    local http_code
    local response_time
    local connect_time
    
    # Use curl with comprehensive metrics
    local curl_result
    curl_result=$(curl -s -w "HTTP:%{http_code};TOTAL:%{time_total};CONNECT:%{time_connect};SIZE:%{size_download}" \
                      --connect-timeout $TIMEOUT \
                      --max-time $((TIMEOUT * 2)) \
                      --user-agent "Production-HealthCheck/1.0" \
                      --location \
                      --fail-with-body \
                      "$url" 2>/dev/null || echo "HTTP:000;TOTAL:0;CONNECT:0;SIZE:0")
    
    # Parse results
    if [[ $curl_result =~ HTTP:([0-9]+) ]]; then
      http_code="${BASH_REMATCH[1]}"
    else
      http_code="000"
    fi
    
    if [[ $curl_result =~ TOTAL:([0-9.]+) ]]; then
      response_time="${BASH_REMATCH[1]}"
    else
      response_time="0"
    fi
    
    echo "📊 $name HTTP Status: $http_code"
    
    # Check if the response is successful
    if [[ "$http_code" =~ ^(200|301|302)$ ]]; then
      echo "✅ $name is healthy (${response_time}s response time)"
      success=true
      break
    elif [ "$http_code" = "000" ]; then
      echo "⚠️ $name connection failed"
    else
      echo "⚠️ $name returned HTTP $http_code"
    fi
    
    if [ $attempt -lt $MAX_RETRIES ]; then
      local wait_time=10
      echo "⏳ Waiting ${wait_time}s before retry..."
      sleep $wait_time
    fi
  done
  
  if [ "$success" = false ]; then
    echo "❌ $name failed after $MAX_RETRIES attempts"
    return 1
  fi
  
  return 0
}

# Track overall health status
OVERALL_SUCCESS=true
FAILED_ENDPOINTS=()

# Test each endpoint
for endpoint_name in "${!ENDPOINTS[@]}"; do
  endpoint_url="${ENDPOINTS[$endpoint_name]}"
  
  if ! check_endpoint "$endpoint_name" "$endpoint_url"; then
    OVERALL_SUCCESS=false
    FAILED_ENDPOINTS+=("$endpoint_name")
  fi
  
  echo ""  # Add spacing between checks
done

# Report final status
echo "=================================="
if [ "$OVERALL_SUCCESS" = true ]; then
  echo "🎉 All health checks passed!"
  echo "✅ Production system is healthy"
  exit 0
else
  echo "❌ Health check failures detected:"
  for failed in "${FAILED_ENDPOINTS[@]}"; do
    echo "   - $failed"
  done
  
  echo ""
  echo "🔍 Troubleshooting steps:"
  echo "1. Check application deployment status"
  echo "2. Verify DNS and SSL configuration"
  echo "3. Review application logs"
  echo "4. Check database connectivity"
  echo "5. Verify all services are running"
  
  # For production monitoring, we want to know about failures
  # but not necessarily fail the entire pipeline
  echo ""
  echo "⚠️ Production health check completed with issues"
  exit 1  # Exit with error for monitoring systems
fi