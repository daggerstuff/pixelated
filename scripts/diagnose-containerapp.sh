#!/bin/bash

# Diagnose Container App Infrastructure
# Usage: ./diagnose-containerapp.sh <resource-group-name>

set -euo pipefail

RESOURCE_GROUP="${1:-}"

if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "Usage: $0 <resource-group-name>"
    exit 1
fi

echo "🔍 Diagnosing Container App Infrastructure in Resource Group: $RESOURCE_GROUP"
echo "=================================================================="

# Check if resource group exists
echo "📋 Checking Resource Group..."
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "✅ Resource Group '$RESOURCE_GROUP' exists"
else
    echo "❌ Resource Group '$RESOURCE_GROUP' not found"
    exit 1
fi

# Check Container App Environments
echo ""
echo "🌍 Checking Container App Environments..."
ENVIRONMENTS=$(az containerapp env list --resource-group "$RESOURCE_GROUP" --query "[].name" --output tsv 2>/dev/null || echo "")

if [[ -n "$ENVIRONMENTS" ]]; then
    echo "✅ Found Container App Environments:"
    echo "$ENVIRONMENTS" | while read -r env_name; do
        if [[ -n "$env_name" ]]; then
            echo "   - $env_name"
            
            # Get environment status
            STATUS=$(az containerapp env show --name "$env_name" --resource-group "$RESOURCE_GROUP" --query "properties.provisioningState" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Status: $STATUS"
            
            # Get environment location
            LOCATION=$(az containerapp env show --name "$env_name" --resource-group "$RESOURCE_GROUP" --query "location" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Location: $LOCATION"
        fi
    done
else
    echo "⚠️  No Container App Environments found"
fi

# Check Container Apps
echo ""
echo "📱 Checking Container Apps..."
CONTAINER_APPS=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query "[].name" --output tsv 2>/dev/null || echo "")

if [[ -n "$CONTAINER_APPS" ]]; then
    echo "✅ Found Container Apps:"
    echo "$CONTAINER_APPS" | while read -r app_name; do
        if [[ -n "$app_name" ]]; then
            echo "   - $app_name"
            
            # Get app status
            STATUS=$(az containerapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "properties.provisioningState" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Provisioning Status: $STATUS"
            
            # Get running status
            RUNNING_STATUS=$(az containerapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "properties.runningStatus" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Running Status: $RUNNING_STATUS"
            
            # Get FQDN
            FQDN=$(az containerapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "properties.configuration.ingress.fqdn" --output tsv 2>/dev/null || echo "None")
            echo "     FQDN: $FQDN"
            
            # Get replica count
            REPLICAS=$(az containerapp replica list --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "length(@)" --output tsv 2>/dev/null || echo "0")
            echo "     Active Replicas: $REPLICAS"
        fi
    done
else
    echo "⚠️  No Container Apps found"
fi

# Check Container Registry
echo ""
echo "🐳 Checking Container Registry..."
REGISTRIES=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[].name" --output tsv 2>/dev/null || echo "")

if [[ -n "$REGISTRIES" ]]; then
    echo "✅ Found Container Registries:"
    echo "$REGISTRIES" | while read -r registry_name; do
        if [[ -n "$registry_name" ]]; then
            echo "   - $registry_name"
            
            # Get registry status
            STATUS=$(az acr show --name "$registry_name" --resource-group "$RESOURCE_GROUP" --query "provisioningState" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Status: $STATUS"
            
            # Get login server
            LOGIN_SERVER=$(az acr show --name "$registry_name" --resource-group "$RESOURCE_GROUP" --query "loginServer" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Login Server: $LOGIN_SERVER"
            
            # Check if admin is enabled
            ADMIN_ENABLED=$(az acr show --name "$registry_name" --resource-group "$RESOURCE_GROUP" --query "adminUserEnabled" --output tsv 2>/dev/null || echo "false")
            echo "     Admin Enabled: $ADMIN_ENABLED"
            
            # List repositories
            REPOS=$(az acr repository list --name "$registry_name" --output tsv 2>/dev/null || echo "")
            if [[ -n "$REPOS" ]]; then
                echo "     Repositories:"
                echo "$REPOS" | while read -r repo; do
                    if [[ -n "$repo" ]]; then
                        echo "       - $repo"
                        # Get latest tags
                        TAGS=$(az acr repository show-tags --name "$registry_name" --repository "$repo" --orderby time_desc --top 3 --output tsv 2>/dev/null || echo "")
                        if [[ -n "$TAGS" ]]; then
                            echo "         Latest tags: $(echo "$TAGS" | tr '\n' ' ')"
                        fi
                    fi
                done
            else
                echo "     No repositories found"
            fi
        fi
    done
else
    echo "⚠️  No Container Registries found"
fi

# Check Log Analytics Workspace
echo ""
echo "📊 Checking Log Analytics Workspace..."
WORKSPACES=$(az monitor log-analytics workspace list --resource-group "$RESOURCE_GROUP" --query "[].name" --output tsv 2>/dev/null || echo "")

if [[ -n "$WORKSPACES" ]]; then
    echo "✅ Found Log Analytics Workspaces:"
    echo "$WORKSPACES" | while read -r workspace_name; do
        if [[ -n "$workspace_name" ]]; then
            echo "   - $workspace_name"
            
            # Get workspace status
            STATUS=$(az monitor log-analytics workspace show --workspace-name "$workspace_name" --resource-group "$RESOURCE_GROUP" --query "provisioningState" --output tsv 2>/dev/null || echo "Unknown")
            echo "     Status: $STATUS"
        fi
    done
else
    echo "⚠️  No Log Analytics Workspaces found"
fi

# Summary
echo ""
echo "📋 Diagnosis Summary"
echo "==================="

# Count resources
ENV_COUNT=$(echo "$ENVIRONMENTS" | grep -c . || echo "0")
APP_COUNT=$(echo "$CONTAINER_APPS" | grep -c . || echo "0")
REGISTRY_COUNT=$(echo "$REGISTRIES" | grep -c . || echo "0")
WORKSPACE_COUNT=$(echo "$WORKSPACES" | grep -c . || echo "0")

echo "Container App Environments: $ENV_COUNT"
echo "Container Apps: $APP_COUNT"
echo "Container Registries: $REGISTRY_COUNT"
echo "Log Analytics Workspaces: $WORKSPACE_COUNT"

if [[ "$ENV_COUNT" -gt 0 && "$REGISTRY_COUNT" -gt 0 ]]; then
    echo "✅ Infrastructure appears to be properly configured"
else
    echo "⚠️  Infrastructure may be incomplete"
    if [[ "$ENV_COUNT" -eq 0 ]]; then
        echo "   - Missing Container App Environment"
    fi
    if [[ "$REGISTRY_COUNT" -eq 0 ]]; then
        echo "   - Missing Container Registry"
    fi
fi

echo ""
echo "🔍 Diagnosis completed!"
