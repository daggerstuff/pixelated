#!/bin/bash

# Deploy Pixelated Infrastructure with Improved Naming
# This script deploys the Azure infrastructure with cleaner, more readable resource names

set -e

echo "🚀 Starting deployment of Pixelated infrastructure with improved naming..."

# Configuration
RESOURCE_GROUP="pixelated-rg"
LOCATION="eastus"
ENVIRONMENT="production"
RESOURCE_PREFIX="pixelated"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Azure CLI is logged in
print_status "Checking Azure CLI authentication..."
if ! az account show > /dev/null 2>&1; then
    print_error "Azure CLI is not logged in. Please run 'az login' first."
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
print_success "Authenticated to Azure subscription: $SUBSCRIPTION_ID"

# Check if resource group exists
print_status "Checking if resource group '$RESOURCE_GROUP' exists..."
if az group show --name "$RESOURCE_GROUP" > /dev/null 2>&1; then
    print_success "Resource group '$RESOURCE_GROUP' exists"
else
    print_status "Creating resource group '$RESOURCE_GROUP'..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    print_success "Resource group created"
fi

# Validate the Bicep template
print_status "Validating Bicep template..."
az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "infra/main.bicep" \
    --parameters environmentName="$ENVIRONMENT" location="$LOCATION" resourcePrefix="$RESOURCE_PREFIX" \
    > /dev/null

print_success "Template validation passed"

# Show what resources will be created
print_status "Resources that will be created with improved naming:"
echo "┌─────────────────────────────────┬──────────────────────────────────────────┐"
echo "│ Resource Type                   │ New Resource Name                        │"
echo "├─────────────────────────────────┼──────────────────────────────────────────┤"
echo "│ Log Analytics Workspace        │ pixelated-production-logs                │"
echo "│ Application Insights           │ pixelated-production-insights            │"
echo "│ Key Vault                      │ pixelateprod[unique] (≤24 chars)         │"
echo "│ Container Registry             │ pixeltech                                │"
echo "│ Container Apps Environment     │ pixelated-production-apps-env            │"
echo "│ Managed Identity               │ pixelated-production-identity            │"
echo "└─────────────────────────────────┴──────────────────────────────────────────┘"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# Deploy the infrastructure
print_status "Deploying infrastructure..."
DEPLOYMENT_NAME="main-improved-naming-$(date +%Y%m%d-%H%M%S)"

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "infra/main.bicep" \
    --parameters environmentName="$ENVIRONMENT" location="$LOCATION" resourcePrefix="$RESOURCE_PREFIX" \
    --name "$DEPLOYMENT_NAME" \
    --verbose

if [ $? -eq 0 ]; then
    print_success "Infrastructure deployment completed successfully!"
    
    # Show the deployment outputs
    print_status "Deployment outputs:"
    az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query "properties.outputs" \
        --output table
    
    # List the created resources
    print_status "Created resources:"
    az resource list \
        --resource-group "$RESOURCE_GROUP" \
        --query "[].{Name:name, Type:type, Location:location}" \
        --output table
    
    print_success "🎉 Deployment completed! Your resources now have much cleaner names."
    print_status "Container Registry name (needed for GitHub workflow):"
    az acr list --resource-group "$RESOURCE_GROUP" --query "[0].{Name:name, LoginServer:loginServer}" -o table
    
else
    print_error "Deployment failed. Please check the error messages above."
    exit 1
fi
