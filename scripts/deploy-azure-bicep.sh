#!/bin/bash

# Azure Bicep Infrastructure Deployment Script
set -e

echo "🚀 Starting Azure infrastructure deployment with Bicep..."

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"
DEPLOYMENT_NAME="${AZURE_DEPLOYMENT_NAME:-pixelated-$(date +%Y%m%d-%H%M%S)}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"
APP_NAME="${AZURE_APP_NAME:-pixelated}"
ENVIRONMENT="${AZURE_ENVIRONMENT:-prod}"
CUSTOM_DOMAIN="${AZURE_CUSTOM_DOMAIN:-}"
GITHUB_REPO_URL="${GITHUB_REPOSITORY_URL:-}"

# Azure authentication variables
AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-}"
AZURE_FEDERATED_TOKEN="${AZURE_FEDERATED_TOKEN:-}"

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    set -a
    source .env
    set +a
fi

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Deployment Name: $DEPLOYMENT_NAME"
echo "  App Name: $APP_NAME"
echo "  Environment: $ENVIRONMENT"
echo "  Custom Domain: $CUSTOM_DOMAIN"
echo "  GitHub Repo: $GITHUB_REPO_URL"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    echo "   Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Clear Azure CLI cache to prevent response consumption errors
echo "🧹 Clearing Azure CLI cache..."
az cache purge 2>/dev/null || true
az account clear 2>/dev/null || true
az login --service-principal -u "$AZURE_CLIENT_ID" --tenant "$AZURE_TENANT_ID" --federated-token "$AZURE_FEDERATED_TOKEN" 2>/dev/null || true

# Set subscription if provided
if [ ! -z "$SUBSCRIPTION_ID" ]; then
    echo "🔧 Setting Azure subscription..."
    az account set --subscription "$SUBSCRIPTION_ID"
fi

# Create resource group if it doesn't exist
echo "🏗️ Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output table

# Validate Bicep template
echo "✅ Validating Bicep template..."
az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "deploy/azure/main.bicep" \
    --parameters \
        appName="$APP_NAME" \
        environment="$ENVIRONMENT" \
        location="$LOCATION" \
        customDomain="$CUSTOM_DOMAIN" \
        githubRepoUrl="$GITHUB_REPO_URL" \
    --output table

if [ $? -ne 0 ]; then
    echo "❌ Bicep template validation failed"
    exit 1
fi

echo "✅ Bicep template validation passed"

# Deploy infrastructure with retry logic
echo "🚀 Deploying infrastructure..."
MAX_RETRIES=3
RETRY_COUNT=0
DEPLOYMENT_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$DEPLOYMENT_SUCCESS" = false ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "🔄 Deployment attempt $RETRY_COUNT of $MAX_RETRIES..."
    
    # Clear any cached responses
    az cache purge 2>/dev/null || true
    
    DEPLOYMENT_OUTPUT=$(az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME-attempt-$RETRY_COUNT" \
        --template-file "deploy/azure/main.bicep" \
        --parameters \
            appName="$APP_NAME" \
            environment="$ENVIRONMENT" \
            location="$LOCATION" \
            customDomain="$CUSTOM_DOMAIN" \
            githubRepoUrl="$GITHUB_REPO_URL" \
            enableAzureOpenAI=true \
            enableStorage=true \
            enableMonitoring=true \
        --output json 2>&1)
    
    if [ $? -eq 0 ] && [[ ! "$DEPLOYMENT_OUTPUT" =~ "ERROR:" ]]; then
        DEPLOYMENT_SUCCESS=true
        echo "✅ Deployment successful on attempt $RETRY_COUNT"
    else
        echo "⚠️ Deployment attempt $RETRY_COUNT failed"
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Waiting 30 seconds before retry..."
            sleep 30
        fi
    fi
done

if [ "$DEPLOYMENT_SUCCESS" = false ]; then
    echo "❌ All deployment attempts failed"
    echo "Last error: $DEPLOYMENT_OUTPUT"
    exit 1
fi

echo "✅ Infrastructure deployment completed"

# Extract outputs
echo "📊 Extracting deployment outputs..."
APP_SERVICE_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.appServiceUrl.value')
STATIC_WEB_APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.staticWebAppUrl.value')
CONTAINER_REGISTRY=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerRegistryLoginServer.value')
STORAGE_ACCOUNT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.storageAccountName.value')
KEY_VAULT_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.keyVaultName.value')
APP_INSIGHTS_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.applicationInsightsName.value')
AZURE_OPENAI_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.azureOpenAIEndpoint.value')

# Store secrets in Key Vault if configured
if [ ! -z "$KEY_VAULT_NAME" ] && [ "$KEY_VAULT_NAME" != "null" ]; then
    echo "🔐 Storing secrets in Key Vault..."
    
    # Store Azure OpenAI secrets
    if [ ! -z "$AZURE_OPENAI_API_KEY" ]; then
        az keyvault secret set \
            --vault-name "$KEY_VAULT_NAME" \
            --name "azure-openai-api-key" \
            --value "$AZURE_OPENAI_API_KEY" \
            --output none
    fi
    
    # Store Supabase secrets
    if [ ! -z "$SUPABASE_URL" ]; then
        az keyvault secret set \
            --vault-name "$KEY_VAULT_NAME" \
            --name "supabase-url" \
            --value "$SUPABASE_URL" \
            --output none
    fi
    
    if [ ! -z "$SUPABASE_ANON_KEY" ]; then
        az keyvault secret set \
            --vault-name "$KEY_VAULT_NAME" \
            --name "supabase-anon-key" \
            --value "$SUPABASE_ANON_KEY" \
            --output none
    fi
    
    # Store Azure AD secrets
    if [ ! -z "$AZURE_AD_CLIENT_SECRET" ]; then
        az keyvault secret set \
            --vault-name "$KEY_VAULT_NAME" \
            --name "azure-ad-client-secret" \
            --value "$AZURE_AD_CLIENT_SECRET" \
            --output none
    fi
    
    echo "✅ Secrets stored in Key Vault"
fi

# Display deployment summary
echo ""
echo "✅ Azure infrastructure deployment completed!"
echo ""
echo "🌐 Deployment Summary:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Deployment Name: $DEPLOYMENT_NAME"
echo "  App Service URL: $APP_SERVICE_URL"
if [ "$STATIC_WEB_APP_URL" != "null" ] && [ ! -z "$STATIC_WEB_APP_URL" ]; then
    echo "  Static Web App URL: $STATIC_WEB_APP_URL"
fi
echo "  Container Registry: $CONTAINER_REGISTRY"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Key Vault: $KEY_VAULT_NAME"
echo "  Application Insights: $APP_INSIGHTS_NAME"
echo "  Azure OpenAI Endpoint: $AZURE_OPENAI_ENDPOINT"
echo ""
echo "📋 Next Steps:"
echo "  1. Configure application settings in App Service"
echo "  2. Deploy application code to App Service or Static Web App"
echo "  3. Configure custom domain DNS if using custom domain"
echo "  4. Set up monitoring alerts and dashboards"
echo "  5. Configure CI/CD pipeline for automatic deployments"
echo ""
echo "🔗 Useful Commands:"
echo "  View deployment: az deployment group show -g $RESOURCE_GROUP -n $DEPLOYMENT_NAME"
echo "  View resources: az resource list -g $RESOURCE_GROUP --output table"
echo "  View Key Vault secrets: az keyvault secret list --vault-name $KEY_VAULT_NAME"
echo ""
echo "🎉 Infrastructure deployment completed successfully!"

# Save deployment outputs to file
cat > "azure-deployment-outputs.json" << EOF
{
  "resourceGroup": "$RESOURCE_GROUP",
  "deploymentName": "$DEPLOYMENT_NAME",
  "appServiceUrl": "$APP_SERVICE_URL",
  "staticWebAppUrl": "$STATIC_WEB_APP_URL",
  "containerRegistry": "$CONTAINER_REGISTRY",
  "storageAccount": "$STORAGE_ACCOUNT",
  "keyVault": "$KEY_VAULT_NAME",
  "applicationInsights": "$APP_INSIGHTS_NAME",
  "azureOpenAIEndpoint": "$AZURE_OPENAI_ENDPOINT"
}
EOF

echo "💾 Deployment outputs saved to azure-deployment-outputs.json"
