#!/usr/bin/env bash

# Usage: ./deploy-infrastructure.sh <resourceGroup> <location> <environment>
set -euo pipefail

RESOURCE_GROUP="${1:-}"
LOCATION="${2:-}"
ENVIRONMENT="${3:-}"

if [[ -z "$RESOURCE_GROUP" || -z "$LOCATION" || -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <resourceGroup> <location> <environment>"
  exit 1
fi

echo "=== Azure Bicep Deployment ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo "============================="

# Create resource group if it doesn't exist
az group show --name "$RESOURCE_GROUP" &>/dev/null || \
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# Deploy Bicep template
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters "@infra/main.parameters.json" \
  --parameters environment="$ENVIRONMENT" location="$LOCATION"

echo "✅ Bicep deployment completed successfully."