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
if az deployment group validate \
    --resource-group "${AZURE_RESOURCE_GROUP:-pixelated-rg}" \
    --template-file infra/main.bicep \
    --parameters infra/main.parameters.json; then
    echo "✅ Bicep template validation passed!"
else
    echo "❌ Bicep template validation failed!"
    exit 1
fi

# Optional: What-if analysis
echo "🔮 Running what-if analysis..."
if az deployment group what-if \
    --resource-group "${AZURE_RESOURCE_GROUP:-pixelated-rg}" \
    --template-file infra/main.bicep \
    --parameters infra/main.parameters.json; then
    echo "✅ What-if analysis completed!"
else
    echo "❌ What-if analysis failed!"
    exit 1
fi

echo "✅ Validation complete!"