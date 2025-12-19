#!/usr/bin/env bash
# Script to help get values for GitLab CI/CD variables

set -euo pipefail

echo "=========================================="
echo "GitLab CI/CD Variables Helper"
echo "=========================================="
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  echo "❌ Azure CLI not found. Install it first:"
  echo "   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
  echo "⚠️  Not logged into Azure. Logging in..."
  az login
fi

echo "📋 Azure Subscription & Tenant Info:"
echo "-----------------------------------"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo ""

echo "📋 Azure Container Registry (ACR) Info:"
echo "-----------------------------------"
ACR_NAME="pixelatedregistry"

# Check if ACR exists
if ! az acr show --name "$ACR_NAME" &> /dev/null; then
  echo "❌ ACR '$ACR_NAME' not found!"
  exit 1
fi

# Check if admin is enabled
ADMIN_ENABLED=$(az acr show --name "$ACR_NAME" --query adminUserEnabled -o tsv)
if [ "$ADMIN_ENABLED" != "true" ]; then
  echo "⚠️  ACR admin is DISABLED. You'll need to use a service principal instead."
  echo "   To enable admin: az acr update --name $ACR_NAME --admin-enabled true"
  exit 1
fi

ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

echo "ACR_NAME: $ACR_NAME"
echo "ACR_USERNAME: $ACR_USERNAME"
echo "ACR_PASSWORD: [HIDDEN - use command below to get]"
echo ""
echo "To get ACR password, run:"
echo "  az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv"
echo ""

echo "=========================================="
echo "GitLab Personal Access Token"
echo "=========================================="
echo "To create TF_HTTP_PASSWORD:"
echo "1. Go to: https://gitlab.com/-/user_settings/personal_access_tokens"
echo "2. Create token with 'api' scope"
echo "3. Copy the token and use it as TF_HTTP_PASSWORD"
echo ""

echo "=========================================="
echo "Summary - Set these in GitLab:"
echo "=========================================="
echo ""
echo "Variable              | Value"
echo "---------------------|----------------------------------------"
echo "TF_HTTP_PASSWORD     | [Create GitLab token with 'api' scope]"
echo "AZURE_SUBSCRIPTION_ID| $SUBSCRIPTION_ID"
echo "AZURE_TENANT_ID      | $TENANT_ID"
echo "ACR_NAME             | $ACR_NAME"
echo "ACR_USERNAME         | $ACR_USERNAME"
echo "ACR_PASSWORD         | [Run: az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv]"
echo ""
echo "All variables should be marked as 'Protected'"
echo "TF_HTTP_PASSWORD and ACR_PASSWORD should be marked as 'Masked'"
