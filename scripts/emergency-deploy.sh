#!/bin/bash
# Emergency fallback - create only essential resources with Azure CLI
set -e

RESOURCE_GROUP="$1"
LOCATION="$2"
ENVIRONMENT="$3"

if [ -z "$RESOURCE_GROUP" ] || [ -z "$LOCATION" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <resource-group> <location> <environment>"
    exit 1
fi

echo "=== Emergency Infrastructure Deployment ==="
echo "Creating minimal required infrastructure using Azure CLI commands"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo "============================================="

# Generate unique suffix
UNIQUE_SUFFIX=$(echo -n "${RESOURCE_GROUP}-${ENVIRONMENT}" | sha256sum | cut -c1-8)
echo "Using unique suffix: $UNIQUE_SUFFIX"

# 1. Ensure resource group exists
echo "1. Checking resource group..."
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "Creating resource group..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
fi
echo "✅ Resource group ready"

# 2. Create Container Registry (CRITICAL for Docker build)
echo "2. Creating Container Registry..."
ACR_NAME="pixelatedcr"
if az acr create \
    --name "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard \
    --admin-enabled true \
    --tags Environment="$ENVIRONMENT" Project="PixelatedEmpathy" ManagedBy="EmergencyDeployment" \
    --only-show-errors; then
    echo "✅ Container Registry created: $ACR_NAME"
    echo "   Login server: ${ACR_NAME}.azurecr.io"
else
    echo "❌ Failed to create Container Registry"
    exit 1
fi

# 3. Create Log Analytics workspace (for monitoring)
echo "3. Creating Log Analytics workspace..."
LOG_WORKSPACE="pixel-log-${UNIQUE_SUFFIX}"
if az monitor log-analytics workspace create \
    --workspace-name "$LOG_WORKSPACE" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku perGB2018 \
    --retention-time 30 \
    --tags Environment="$ENVIRONMENT" Project="PixelatedEmpathy" ManagedBy="EmergencyDeployment" \
    --only-show-errors; then
    echo "✅ Log Analytics workspace created: $LOG_WORKSPACE"
    LOG_WORKSPACE_ID="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.OperationalInsights/workspaces/$LOG_WORKSPACE"
else
    echo "⚠️  Failed to create Log Analytics workspace, continuing without it..."
    LOG_WORKSPACE_ID=""
fi

# 4. Create Container Apps environment
echo "4. Creating Container Apps environment..."
APP_ENV="pixel-env-${UNIQUE_SUFFIX}"

# Try with Log Analytics first, then without if it fails
if [ -n "$LOG_WORKSPACE_ID" ]; then
    CREATE_ENV_COMMAND="az containerapp env create \
        --name '$APP_ENV' \
        --resource-group '$RESOURCE_GROUP' \
        --location '$LOCATION' \
        --logs-workspace-id '$LOG_WORKSPACE_ID' \
        --tags Environment='$ENVIRONMENT' Project='PixelatedEmpathy' ManagedBy='EmergencyDeployment' \
        --only-show-errors"
else
    CREATE_ENV_COMMAND="az containerapp env create \
        --name '$APP_ENV' \
        --resource-group '$RESOURCE_GROUP' \
        --location '$LOCATION' \
        --tags Environment='$ENVIRONMENT' Project='PixelatedEmpathy' ManagedBy='EmergencyDeployment' \
        --only-show-errors"
fi

if eval "$CREATE_ENV_COMMAND"; then
    echo "✅ Container Apps environment created: $APP_ENV"
else
    echo "⚠️  Failed to create Container Apps environment"
    echo "This is not critical - the environment can be created later"
fi

# 5. Create a simple container app (placeholder)
echo "5. Creating placeholder container app..."
CONTAINER_APP="pixel-app-${UNIQUE_SUFFIX}"

if az containerapp create \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$APP_ENV" \
    --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
    --target-port 80 \
    --ingress 'external' \
    --query properties.configuration.ingress.fqdn \
    --tags Environment="$ENVIRONMENT" Project="PixelatedEmpathy" ManagedBy="EmergencyDeployment" \
    --only-show-errors 2>/dev/null; then
    echo "✅ Placeholder container app created: $CONTAINER_APP"
    
    # Get the app URL
    APP_URL=$(az containerapp show \
        --name "$CONTAINER_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.configuration.ingress.fqdn \
        --output tsv 2>/dev/null || echo "")
    
    if [ -n "$APP_URL" ]; then
        echo "   App URL: https://$APP_URL"
    fi
else
    echo "⚠️  Failed to create placeholder container app"
    echo "This is not critical - the app will be created during deployment"
fi

# Summary
echo ""
echo "🎉 Emergency deployment completed!"
echo "================================="
echo "✅ Resource Group: $RESOURCE_GROUP"
echo "✅ Container Registry: $ACR_NAME (${ACR_NAME}.azurecr.io)"
if [ -n "$LOG_WORKSPACE_ID" ]; then
    echo "✅ Log Analytics: $LOG_WORKSPACE"
else
    echo "⚠️  Log Analytics: Not created"
fi
if az containerapp env show --name "$APP_ENV" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "✅ Container Environment: $APP_ENV"
else
    echo "⚠️  Container Environment: Not created"
fi
echo ""
echo "The Docker build stage should now be able to proceed with the Container Registry."
