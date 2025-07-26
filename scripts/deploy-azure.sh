#!/bin/bash

# Azure Static Web Apps Deployment Script for Pixelated Astro App
set -e

echo "🚀 Starting Azure Static Web Apps deployment..."

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"
STATIC_WEB_APP_NAME="${AZURE_STATIC_WEB_APP_NAME:-pixelated-swa}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"
GITHUB_REPO="${GITHUB_REPOSITORY:-your-username/pixel}"
G_TOKEN="${G_TOKEN}"

# Load environment variables from .env file if it exists
if [[ -f ".env" ]]; then
	echo "📄 Loading environment variables from .env file..."
	set -a
	source .env
	set +a
fi

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Static Web App: $STATIC_WEB_APP_NAME"
echo "  Subscription: $SUBSCRIPTION_ID"
echo ""

# Check if Azure CLI is installed
if ! command -v az &>/dev/null; then
	echo "❌ Azure CLI is not installed. Please install it first."
	echo "   Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
	exit 1
fi

# Check if logged in to Azure
if ! az account show &>/dev/null; then
	echo "❌ Not logged in to Azure. Please run 'az login' first."
	exit 1
fi

# Set subscription if provided
if [ ! -z "$SUBSCRIPTION_ID" ]; then
	echo "🔧 Setting Azure subscription..."
	az account set --subscription "$SUBSCRIPTION_ID"
fi

# Create resource group if it doesn't exist
echo "🏗️ Creating resource group if it doesn't exist..."
az group create \
	--name "$RESOURCE_GROUP" \
	--location "$LOCATION" \
	--output table

# Build the application with Azure configuration
echo "📦 Building application for Azure..."
export NODE_ENV=production
export ASTRO_CONFIG_FILE=astro.config.mjs

# Install dependencies
echo "📥 Installing dependencies..."
pnpm install --no-frozen-lockfile

# Build the application
echo "🔨 Building application..."
pnpm build

# Check if dist directory exists
if [ ! -d "dist" ]; then
	echo "❌ dist directory not found. Build may have failed."
	exit 1
fi

echo "📊 Build size:"
du -sh dist/

# Create Static Web App if it doesn't exist
echo "🌐 Creating Azure Static Web App..."
SWA_DETAILS=$(az staticwebapp create \
	--name "$STATIC_WEB_APP_NAME" \
	--resource-group "$RESOURCE_GROUP" \
	--location "$LOCATION" \
	--source "https://github.com/$GITHUB_REPO" \
	--branch "main" \
	--app-location "/" \
	--api-location "api" \
	--output-location "dist" \
	--login-with-github \
	--output json 2>/dev/null || echo "Static Web App may already exist")

# Get the deployment token
echo "🔑 Getting deployment token..."
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
	--name "$STATIC_WEB_APP_NAME" \
	--resource-group "$RESOURCE_GROUP" \
	--query "properties.apiKey" \
	--output tsv)

if [ -z "$DEPLOYMENT_TOKEN" ]; then
	echo "❌ Could not retrieve deployment token"
	exit 1
fi

echo "✅ Deployment token retrieved"

# Configure app settings
echo "⚙️ Configuring application settings..."
az staticwebapp appsettings set \
	--name "$STATIC_WEB_APP_NAME" \
	--resource-group "$RESOURCE_GROUP" \
	--setting-names \
	"AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY" \
	"AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT" \
	"AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION" \
	"AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME" \
	"AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
	"AZURE_AD_CLIENT_ID=$AZURE_AD_CLIENT_ID" \
	"AZURE_AD_CLIENT_SECRET=$AZURE_AD_CLIENT_SECRET" \
	"AZURE_AD_TENANT_ID=$AZURE_AD_TENANT_ID" \
	"SUPABASE_URL=$SUPABASE_URL" \
	"SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
	"SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
	"NODE_ENV=production" \
	--output table

# Get the Static Web App URL
echo "📊 Getting deployment information..."
SWA_URL=$(az staticwebapp show \
	--name "$STATIC_WEB_APP_NAME" \
	--resource-group "$RESOURCE_GROUP" \
	--query "defaultHostname" \
	--output tsv)

# Configure custom domain if specified
if [ ! -z "$CUSTOM_DOMAIN" ]; then
	echo "🌐 Configuring custom domain: $CUSTOM_DOMAIN"
	az staticwebapp hostname set \
		--name "$STATIC_WEB_APP_NAME" \
		--resource-group "$RESOURCE_GROUP" \
		--hostname "$CUSTOM_DOMAIN"
fi

# Display deployment information
echo ""
echo "✅ Azure Static Web Apps deployment completed!"
echo ""
echo "🌐 Deployment Details:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Static Web App: $STATIC_WEB_APP_NAME"
echo "  Default URL: https://$SWA_URL"
if [ ! -z "$CUSTOM_DOMAIN" ]; then
	echo "  Custom Domain: https://$CUSTOM_DOMAIN"
fi
echo ""
echo "🔑 Deployment Token (for GitHub Actions):"
echo "  Add this as AZURE_STATIC_WEB_APPS_API_TOKEN in your GitHub repository secrets:"
echo "  $DEPLOYMENT_TOKEN"
echo ""
echo "📋 Next Steps:"
echo "  1. Add the deployment token to your GitHub repository secrets"
echo "  2. Push changes to trigger automatic deployments"
echo "  3. Configure custom domain DNS if using custom domain"
echo "  4. Set up monitoring and alerts in Azure Portal"
echo ""
echo "🎉 Deployment completed successfully!"

# Optional: Open the deployed site
if command -v open &>/dev/null; then
	echo "🌐 Opening deployed site..."
	open "https://$SWA_URL"
elif command -v xdg-open &>/dev/null; then
	echo "🌐 Opening deployed site..."
	xdg-open "https://$SWA_URL"
fi
