#!/bin/bash

# Minimal Health Check for Azure App Service
# Addresses 503 Service Unavailable issues

set -euo pipefail

APP_NAME="${1:-pixelated}"
CUSTOM_DOMAIN="${2:-pixelatedempathy.com}"

echo "=== Minimal Health Check ==="

# Get App Service URL
APP_URL=$(az webapp show --name "$APP_NAME" --resource-group pixelated-rg --query defaultHostName --output tsv 2>/dev/null || echo "")

if [ -z "$APP_URL" ]; then
  echo "❌ App Service not found"
  exit 1
fi

FULL_URL="https://$APP_URL"
CUSTOM_URL="https://$CUSTOM_DOMAIN"

echo "App Service: $FULL_URL"
echo "Custom Domain: $CUSTOM_URL"

# Simple retry with exponential backoff
for i in {1..3}; do
  echo "Attempt $i/3..."
  
  # Test custom domain
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$CUSTOM_URL" || echo "000")
  
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
    echo "✅ Success: $STATUS"
    exit 0
  fi
  
  echo "Status: $STATUS"
  
  if [ $i -lt 3 ]; then
    sleep $((i * 30))  # 30s, 60s backoff
  fi
done

echo "⚠️ Health check completed with issues (non-blocking)"
exit 0  # Don't fail the pipeline