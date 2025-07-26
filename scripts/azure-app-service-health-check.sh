#!/bin/bash

# Azure App Service Health Check Script
# Optimized for the 503 Service Unavailable issue

set -euo pipefail

echo "=== App Service Health Check ==="
APP_SERVICE_NAME="${1:-pixelated}"
CUSTOM_DOMAIN="${2:-pixelatedempathy.com}"

# Get App Service URL
APP_URL=$(az webapp show \
  --name "$APP_SERVICE_NAME" \
  --resource-group pixelated-rg \
  --query defaultHostName \
  --output tsv 2>/dev/null || echo "")

if [ -z "$APP_URL" ]; then
  echo "❌ Failed to get App Service URL"
  exit 1
fi

FULL_URL="https://$APP_URL"
CUSTOM_URL="https://$CUSTOM_DOMAIN"

echo "Testing App Service at: $FULL_URL"
echo "Testing custom domain at: $CUSTOM_URL"

# Wait for deployment to complete
echo "Waiting 90 seconds for App Service deployment to complete..."
sleep 90

# Health check with retries
MAX_RETRIES=5
RETRY_COUNT=0
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Health check attempt $((RETRY_COUNT + 1))/$MAX_RETRIES"
  
  # Test custom domain first
  HTTP_STATUS=$(curl -I "$CUSTOM_URL" --connect-timeout 10 --max-time 30 2>/dev/null | head -n1 | cut -d' ' -f2 || echo "000")
  
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "✅ Custom domain health check passed: $HTTP_STATUS"
    SUCCESS=true
    break
  else
    echo "⚠️  Custom domain attempt $((RETRY_COUNT + 1)) failed with status: $HTTP_STATUS"
    
    # Try App Service URL as fallback
    HTTP_STATUS=$(curl -I "$FULL_URL" --connect-timeout 10 --max-time 30 2>/dev/null | head -n1 | cut -d' ' -f2 || echo "000")
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
      echo "✅ App Service URL health check passed: $HTTP_STATUS"
      SUCCESS=true
      break
    fi
    
    # Try health endpoint specifically
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FULL_URL/api/health/simple" --connect-timeout 10 --max-time 30 || echo "000")
    if [ "$HEALTH_STATUS" = "200" ]; then
      echo "✅ Health endpoint check passed: $HEALTH_STATUS"
      SUCCESS=true
      break
    fi
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "Waiting 30 seconds before next attempt..."
    sleep 30
  fi
done

if [ "$SUCCESS" = false ]; then
  echo "❌ App Service health check failed"
  
  # Diagnostic information
  echo ""
  echo "=== Diagnostic Information ==="
  echo "App Service Status:"
  az webapp show --name "$APP_SERVICE_NAME" --resource-group pixelated-rg --query "{name:name,state:state,hostNames:hostNames}" --output table || true
  
  echo ""
  echo "App Service Logs (last 10 lines):"
  az webapp log tail --name "$APP_SERVICE_NAME" --resource-group pixelated-rg --provider application --lines 10 || true
  
  exit 1
fi

echo "🎉 App Service health check completed successfully!"
echo "🌐 Live at: $CUSTOM_URL"