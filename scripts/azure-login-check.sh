#!/bin/bash

# Quick Azure login check and setup for local development
# This script helps test Azure connectivity locally

set -e

echo "🔐 Azure Login Status Check"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed."
    echo "Install it with:"
    echo "  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    exit 1
fi

# Check current login status
if az account show &> /dev/null; then
    echo "✅ Already logged in to Azure"
    az account show --output table
else
    echo "⚠️  Not logged in to Azure"
    echo ""
    echo "Choose login method:"
    echo "1) Interactive login (opens browser)"
    echo "2) Device code login (for remote/headless)"
    echo "3) Service principal login (requires credentials)"
    echo ""
    read -p "Select option (1-3): " choice
    
    case $choice in
        1)
            echo "Opening browser for interactive login..."
            az login
            ;;
        2)
            echo "Starting device code flow..."
            az login --use-device-code
            ;;
        3)
            echo "Service principal login"
            read -p "Enter tenant ID: " tenant_id
            read -p "Enter client ID: " client_id
            read -s -p "Enter client secret: " client_secret
            echo ""
            az login --service-principal --username "$client_id" --password "$client_secret" --tenant "$tenant_id"
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
fi

echo ""
echo "🎯 Current Azure Context:"
az account show --query "{subscriptionId:id, subscriptionName:name, tenantId:tenantId, user:user.name}" --output table

# Check if resource group exists
RG_NAME="pixelated-rg"
echo ""
echo "🔍 Checking resource group: $RG_NAME"
if az group show --name "$RG_NAME" &> /dev/null; then
    echo "✅ Resource group exists"
    az group show --name "$RG_NAME" --query "{name:name, location:location, provisioningState:properties.provisioningState}" --output table
else
    echo "⚠️  Resource group '$RG_NAME' does not exist"
    echo ""
    read -p "Create it now? (y/N): " create_rg
    if [[ $create_rg =~ ^[Yy]$ ]]; then
        echo "Creating resource group..."
        az group create --name "$RG_NAME" --location "eastus"
        echo "✅ Resource group created"
    fi
fi

echo ""
echo "🚀 You're ready to use Azure!"
