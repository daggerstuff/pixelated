#!/bin/bash

set -e

echo "🔍 Validating Bicep template..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged into Azure CLI"
    exit 1
fi

# Validate the Bicep template
echo "📋 Validating main.bicep..."
az deployment group validate \
    --resource-group "${AZURE_RESOURCE_GROUP:-pixelated-rg}" \
    --template-file infra/main.bicep \
    --parameters environment=staging azureLocation=eastus

echo "✅ Bicep template validation passed!"

# Optional: What-if analysis
echo "🔮 Running what-if analysis..."
az deployment group what-if \
    --resource-group "${AZURE_RESOURCE_GROUP:-pixelated-rg}" \
    --template-file infra/main.bicep \
    --parameters environment=staging azureLocation=eastus

echo "✅ Validation complete!"