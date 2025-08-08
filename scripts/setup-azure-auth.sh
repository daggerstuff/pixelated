#!/bin/bash

# Setup Azure authentication for GitHub Actions
# This script helps create a service principal and configure OIDC authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Azure Authentication Setup for GitHub Actions${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please login first.${NC}"
    echo "Run: az login"
    exit 1
fi

# Get current subscription
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
TENANT_ID=$(az account show --query tenantId --output tsv)
SUBSCRIPTION_NAME=$(az account show --query name --output tsv)

echo -e "${GREEN}✅ Current Azure Context:${NC}"
echo "Subscription: $SUBSCRIPTION_NAME"
echo "Subscription ID: $SUBSCRIPTION_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

# Get GitHub repository information
read -p "Enter your GitHub repository (format: owner/repo): " GITHUB_REPO
if [[ ! $GITHUB_REPO =~ ^[^/]+/[^/]+$ ]]; then
    echo -e "${RED}❌ Invalid repository format. Use: owner/repo${NC}"
    exit 1
fi

REPO_OWNER=$(echo $GITHUB_REPO | cut -d'/' -f1)
REPO_NAME=$(echo $GITHUB_REPO | cut -d'/' -f2)

# Create service principal name
SP_NAME="sp-pixelated-github-$REPO_NAME"

echo -e "${BLUE}🔧 Creating Service Principal: $SP_NAME${NC}"

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac \
    --name "$SP_NAME" \
    --role contributor \
    --scopes "/subscriptions/$SUBSCRIPTION_ID" \
    --json-auth)

# Extract values
CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.clientId')
CLIENT_SECRET=$(echo $SP_OUTPUT | jq -r '.clientSecret')

echo -e "${GREEN}✅ Service Principal created successfully!${NC}"
echo ""

# Create federated credential for OIDC
echo -e "${BLUE}🔧 Setting up OIDC federated credentials...${NC}"

# Create federated credential for main branch
az ad app federated-credential create \
    --id $CLIENT_ID \
    --parameters '{
        "name": "pixelated-github-main",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:'$GITHUB_REPO':ref:refs/heads/master",
        "description": "GitHub Actions - Main Branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'

# Create federated credential for develop branch
az ad app federated-credential create \
    --id $CLIENT_ID \
    --parameters '{
        "name": "pixelated-github-develop",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:'$GITHUB_REPO':ref:refs/heads/develop",
        "description": "GitHub Actions - Develop Branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'

# Create federated credential for pull requests
az ad app federated-credential create \
    --id $CLIENT_ID \
    --parameters '{
        "name": "pixelated-github-pr",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:'$GITHUB_REPO':pull_request",
        "description": "GitHub Actions - Pull Requests",
        "audiences": ["api://AzureADTokenExchange"]
    }'

echo -e "${GREEN}✅ OIDC federated credentials created!${NC}"
echo ""

echo -e "${YELLOW}📋 GitHub Repository Secrets to Configure:${NC}"
echo ""
echo "Go to: https://github.com/$GITHUB_REPO/settings/secrets/actions"
echo ""
echo "Add these secrets:"
echo -e "${BLUE}AZURE_CLIENT_ID${NC}: $CLIENT_ID"
echo -e "${BLUE}AZURE_TENANT_ID${NC}: $TENANT_ID"
echo -e "${BLUE}AZURE_SUBSCRIPTION_ID${NC}: $SUBSCRIPTION_ID"
echo ""
echo -e "${YELLOW}📋 Optional: For environments that need client secret authentication:${NC}"
echo -e "${BLUE}AZURE_CLIENT_SECRET${NC}: $CLIENT_SECRET"
echo ""

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add the secrets above to your GitHub repository"
echo "2. Ensure your Azure resource group 'pixelated-rg' exists"
echo "3. Test the workflow by pushing to master or develop branch"
echo ""
echo -e "${BLUE}💡 Service Principal Details:${NC}"
echo "Name: $SP_NAME"
echo "Application ID: $CLIENT_ID"
echo "Object ID: $(az ad sp show --id $CLIENT_ID --query id --output tsv)"
