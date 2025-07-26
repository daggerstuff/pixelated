#!/bin/bash

# Force Azure App Service Container Redeploy Script
# This script forces a fresh deployment to resolve container startup issues

set -e

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
APP_SERVICE_NAME="${AZURE_APP_SERVICE_NAME:-pixelated-app}"
CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-pixelatedcr.azurecr.io}"
IMAGE_NAME="${AZURE_IMAGE_NAME:-pixelated-app}"

echo "🚀 Force Azure App Service Container Redeploy"
echo "================================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "App Service: $APP_SERVICE_NAME"
echo "Container Registry: $CONTAINER_REGISTRY"
echo "Image: $IMAGE_NAME"
echo ""

# Check if logged into Azure
if ! az account show > /dev/null 2>&1; then
    echo "❌ Please login to Azure first: az login"
    exit 1
fi

# Stop the app service
echo "🛑 Stopping App Service..."
az webapp stop --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP"

# Clear any cached container images
echo "🧹 Clearing container cache..."
az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "mcr.microsoft.com/appsvc/staticsite:latest"

# Wait for the change to propagate
echo "⏳ Waiting for cache clear..."
sleep 30

# Get the latest image tag
LATEST_TAG=$(az acr repository show-tags \
    --name "$(echo $CONTAINER_REGISTRY | cut -d'.' -f1)" \
    --repository "$IMAGE_NAME" \
    --orderby time_desc \
    --output tsv | head -n 1)

echo "📋 Latest available tag: $LATEST_TAG"

# Force pull the latest image with timestamp to avoid caching
FORCE_TAG="latest-$(date +%s)"
echo "🔄 Forcing fresh deployment with tag: $FORCE_TAG"

# Set the container configuration with the latest image
az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$CONTAINER_REGISTRY/$IMAGE_NAME:latest" \
    --docker-registry-server-url "https://$CONTAINER_REGISTRY"

# Set critical environment variables
echo "🔧 Setting environment variables..."
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        "WEBSITES_PORT=3000" \
        "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false" \
        "SCM_DO_BUILD_DURING_DEPLOYMENT=false" \
        "NODE_ENV=production" \
        "PORT=3000"

# Restart the app service
echo "🔄 Restarting App Service..."
az webapp restart --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP"

# Wait for startup
echo "⏳ Waiting for application startup..."
sleep 60

# Check health
echo "🏥 Checking application health..."
APP_URL="https://$(az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostName" --output tsv)"

echo "🔍 Testing application at: $APP_URL"

# Test health endpoint
if curl -f --max-time 10 "$APP_URL/api/health/simple" > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️ Health check failed, but continuing..."
fi

# Test main page
if curl -f --max-time 10 "$APP_URL" > /dev/null 2>&1; then
    echo "✅ Main page accessible!"
else
    echo "⚠️ Main page check failed"
fi

# Show recent logs
echo "📋 Recent application logs:"
az webapp log tail \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --provider application \
    --output tsv | head -20

echo ""
echo "✅ Forced redeploy completed!"
echo "🌐 Application URL: $APP_URL"
echo "🔍 Monitor logs: az webapp log tail --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP" 