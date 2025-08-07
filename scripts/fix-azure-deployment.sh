#!/bin/bash

# Quick fix for Azure deployment issues
set -euo pipefail

RESOURCE_GROUP="pixelated-rg"
APP_SERVICE_NAME="pixelated"
ACR_NAME="pixelatedcr"

echo "🔧 Fixing Azure deployment issues..."

# 1. Check if the correct Docker image exists
echo "📦 Checking Docker images in ACR..."
az acr repository list --name "$ACR_NAME" --output table

echo ""
echo "📋 Available tags for pixelated image:"
az acr repository show-tags --name "$ACR_NAME" --repository "pixelated" --output table || echo "No pixelated repository found"

# 2. Update App Service to use latest tag as fallback
echo ""
echo "🔄 Updating App Service to use latest image..."
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value --output tsv)

# Configure App Service with latest image
az webapp config container set \
  --name "$APP_SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --container-image-name "$ACR_LOGIN_SERVER/pixelated:latest" \
  --container-registry-url "https://$ACR_LOGIN_SERVER" \
  --container-registry-user "$ACR_USERNAME" \
  --container-registry-password "$ACR_PASSWORD"

# 3. Set correct environment variables
echo ""
echo "⚙️  Setting App Service configuration..."
az webapp config appsettings set \
  --name "$APP_SERVICE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NODE_ENV=production \
    PORT=4321 \
    WEBSITES_PORT=4321 \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false

# 4. Restart the App Service
echo ""
echo "🔄 Restarting App Service..."
az webapp restart --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP"

echo ""
echo "✅ Fix applied! Waiting 60 seconds for restart..."
sleep 60

# 5. Test the deployment
echo ""
echo "🧪 Testing deployment..."
APP_URL=$(az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName --output tsv)

if [ -n "$APP_URL" ]; then
  echo "Testing: https://$APP_URL"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_URL" --connect-timeout 10 --max-time 30 || echo "000")
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ App Service is responding correctly!"
  else
    echo "⚠️  App Service returned status: $HTTP_STATUS"
    echo "Testing health endpoint..."
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_URL/api/health/simple" --connect-timeout 10 --max-time 30 || echo "000")
    echo "Health endpoint status: $HEALTH_STATUS"
  fi
fi

echo ""
echo "🌐 Custom domain: https://pixelatedempathy.com"
echo "🔗 App Service URL: https://$APP_URL"