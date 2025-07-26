#!/bin/bash
# Azure Container Apps Diagnostic Script
# Helps troubleshoot common deployment issues

set -e

RESOURCE_GROUP="$1"

if [ -z "$RESOURCE_GROUP" ]; then
    echo "Usage: $0 <resource-group>"
    exit 1
fi

echo "=== Azure Container Apps Diagnostic Report ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Timestamp: $(date)"
echo "=============================================="

# Check if resource group exists
echo "📋 Checking resource group..."
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "✅ Resource group '$RESOURCE_GROUP' exists"
    
    # Get resource group location
    RG_LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location --output tsv)
    echo "   Location: $RG_LOCATION"
else
    echo "❌ Resource group '$RESOURCE_GROUP' does not exist"
    exit 1
fi

echo ""
echo "🔍 Checking recent deployments..."
DEPLOYMENTS=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,State:properties.provisioningState,Timestamp:properties.timestamp}' --output table)
if [ -n "$DEPLOYMENTS" ]; then
    echo "$DEPLOYMENTS"
else
    echo "No deployments found"
fi

echo ""
echo "📦 Checking Container Apps resources..."

# Check Container App Environment
echo "Container App Environments:"
ENV_LIST=$(az containerapp env list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,Location:location,State:properties.provisioningState}' --output table 2>/dev/null || echo "None found")
echo "$ENV_LIST"

echo ""
echo "Container Apps:"
APP_LIST=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,State:properties.provisioningState,FQDN:properties.configuration.ingress.fqdn,Image:properties.template.containers[0].image}' --output table 2>/dev/null || echo "None found")
echo "$APP_LIST"

echo ""
echo "🔐 Checking Container Registry..."
ACR_LIST=$(az acr list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,LoginServer:loginServer,AdminEnabled:adminUserEnabled,State:provisioningState}' --output table 2>/dev/null || echo "None found")
echo "$ACR_LIST"

echo ""
echo "👤 Checking Managed Identities..."
IDENTITY_LIST=$(az identity list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,PrincipalId:principalId,State:provisioningState}' --output table 2>/dev/null || echo "None found")
echo "$IDENTITY_LIST"

echo ""
echo "🔑 Checking Key Vault..."
KV_LIST=$(az keyvault list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,Location:location,VaultUri:properties.vaultUri}' --output table 2>/dev/null || echo "None found")
echo "$KV_LIST"

echo ""
echo "📊 Checking Application Insights..."
AI_LIST=$(az monitor app-insights component show --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,ApplicationId:appId,InstrumentationKey:instrumentationKey}' --output table 2>/dev/null || echo "None found")
echo "$AI_LIST"

echo ""
echo "📈 Checking Log Analytics..."
LA_LIST=$(az monitor log-analytics workspace list --resource-group "$RESOURCE_GROUP" --query '[].{Name:name,Location:location,CustomerId:customerId}' --output table 2>/dev/null || echo "None found")
echo "$LA_LIST"

# Check recent activity logs for errors
echo ""
echo "🚨 Checking recent activity logs for errors..."
ACTIVITY_LOGS=$(az monitor activity-log list --resource-group "$RESOURCE_GROUP" --start-time "$(date -d '2 hours ago' --iso-8601)" --query '[?level==`Error`].{Time:eventTimestamp,Operation:operationName.localizedValue,Status:status.localizedValue,Message:properties.statusMessage}' --output table 2>/dev/null || echo "No error logs found")
echo "$ACTIVITY_LOGS"

# Check quota and limits
echo ""
echo "📏 Checking subscription limits..."
LOCATION=${RG_LOCATION:-"eastus"}
echo "Checking Container Apps quota in $LOCATION..."

# Get Container Apps usage (if available)
CA_USAGE=$(az containerapp usage show --location "$LOCATION" 2>/dev/null || echo "Usage information not available")
echo "$CA_USAGE"

echo ""
echo "💡 Common troubleshooting tips:"
echo "1. Ensure the Container Registry has admin user enabled or proper RBAC roles assigned"
echo "2. Check that the managed identity has AcrPull role on the Container Registry"
echo "3. Verify that the Container App Environment is properly configured with Log Analytics"
echo "4. Ensure the resource names follow Azure naming conventions and don't exceed length limits"
echo "5. Check Azure service health for any ongoing issues in your region"

echo ""
echo "=== Diagnostic Report Complete ==="
