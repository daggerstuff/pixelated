#!/bin/bash

# Monitor Azure Deployment Progress
# Tracks the deployment and container startup to ensure fixes are applied

set -e

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
APP_SERVICE_NAME="${AZURE_APP_SERVICE_NAME:-pixelated-app}"
CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-pixelatedcr.azurecr.io}"
IMAGE_NAME="${AZURE_IMAGE_NAME:-pixelated-web}"
CHECK_INTERVAL=30

echo "🔍 Monitoring Azure Deployment Progress"
echo "======================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "App Service: $APP_SERVICE_NAME"
echo "Container Registry: $CONTAINER_REGISTRY"
echo "Image: $IMAGE_NAME"
echo ""

# Function to get latest image tag
get_latest_tag() {
    az acr repository show-tags \
        --name "${CONTAINER_REGISTRY%%.*}" \
        --repository "$IMAGE_NAME" \
        --orderby time_desc \
        --top 1 \
        --output tsv 2>/dev/null || echo "unknown"
}

# Function to get current app service image
get_current_image() {
    az webapp config container show \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[0].image" \
        --output tsv 2>/dev/null || echo "unknown"
}

# Function to check app service status
check_app_status() {
    az webapp show \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "state" \
        --output tsv 2>/dev/null || echo "unknown"
}

# Function to check recent logs for errors
check_recent_logs() {
    echo "📋 Checking recent container logs..."
    az webapp log tail \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --provider application \
        2>/dev/null | head -20 | grep -E "(astro:|exit code|startup|error)" || echo "No recent startup errors found"
}

# Main monitoring loop
echo "🚀 Starting deployment monitoring..."
echo ""

INITIAL_TAG=$(get_latest_tag)
echo "📌 Initial latest tag: $INITIAL_TAG"

CURRENT_IMAGE=$(get_current_image)
echo "📌 Current app service image: $CURRENT_IMAGE"

echo ""
echo "⏳ Waiting for new deployment..."

# Monitor for changes
LAST_TAG="$INITIAL_TAG"
COUNTER=0

while true; do
    sleep $CHECK_INTERVAL
    COUNTER=$((COUNTER + 1))
    
    echo "🔄 Check #$COUNTER ($(date '+%H:%M:%S'))"
    
    # Check for new image tag
    LATEST_TAG=$(get_latest_tag)
    if [ "$LATEST_TAG" != "$LAST_TAG" ] && [ "$LATEST_TAG" != "unknown" ]; then
        echo "🎉 New image detected: $LATEST_TAG"
        LAST_TAG="$LATEST_TAG"
        
        # Wait a bit for deployment
        echo "⏳ Waiting for deployment to update..."
        sleep 60
        
        # Check if app service is using the new image
        NEW_IMAGE=$(get_current_image)
        echo "📋 App service now using: $NEW_IMAGE"
        
        # Check app status
        APP_STATUS=$(check_app_status)
        echo "📊 App service status: $APP_STATUS"
        
        if [ "$APP_STATUS" = "Running" ]; then
            echo "✅ App service is running with new image!"
            echo ""
            echo "🔍 Checking for startup issues..."
            check_recent_logs
            echo ""
            echo "🌐 Testing app availability..."
            APP_URL="https://${APP_SERVICE_NAME}.azurewebsites.net"
            
            if curl -s --head --max-time 10 "$APP_URL" | head -1 | grep -q "200 OK"; then
                echo "✅ App is responding successfully!"
                echo "🎉 Deployment completed successfully!"
                exit 0
            else
                echo "⚠️ App is not responding properly. Continuing to monitor..."
            fi
        else
            echo "⚠️ App service status: $APP_STATUS - continuing to monitor..."
        fi
    else
        echo "⏳ Still waiting for new build (current: $LATEST_TAG)..."
    fi
    
    # Safety check - don't run forever
    if [ $COUNTER -gt 60 ]; then
        echo "⏰ Monitoring timeout reached (30 minutes)"
        echo "💡 Check Azure DevOps pipeline manually for build status"
        exit 1
    fi
done 