#!/bin/bash

# Azure App Service Deployment Script for Pixelated Astro App
set -e

echo "🚀 Starting Azure App Service deployment..."

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-pixelated-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"
APP_SERVICE_PLAN="${AZURE_APP_SERVICE_PLAN:-pixelated-plan}"
APP_SERVICE_NAME="${AZURE_APP_SERVICE_NAME:-pixelated-app}"
CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-pixelatedcr}"
IMAGE_NAME="${AZURE_IMAGE_NAME:-pixelated-app}"
IMAGE_TAG="${AZURE_IMAGE_TAG:-latest}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"

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
echo "  App Service Plan: $APP_SERVICE_PLAN"
echo "  App Service: $APP_SERVICE_NAME"
echo "  Container Registry: $CONTAINER_REGISTRY"
echo "  Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

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

# Create Container Registry if it doesn't exist
echo "📦 Creating Azure Container Registry..."
az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_REGISTRY" \
    --sku Basic \
    --admin-enabled true \
    --location "$LOCATION" \
    --output table

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show \
    --name "$CONTAINER_REGISTRY" \
    --resource-group "$RESOURCE_GROUP" \
    --query "loginServer" \
    --output tsv)

echo "🔑 ACR Login Server: $ACR_LOGIN_SERVER"

# Login to ACR
echo "🔐 Logging in to Azure Container Registry..."
az acr login --name "$CONTAINER_REGISTRY"

# Build and push Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.azure -t "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" .

echo "📤 Pushing Docker image to ACR..."
docker push "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"

# Create App Service Plan
echo "📋 Creating App Service Plan..."
az appservice plan create \
    --name "$APP_SERVICE_PLAN" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --is-linux \
    --sku B1 \
    --output table

# Create App Service
echo "🌐 Creating App Service..."
az webapp create \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$APP_SERVICE_PLAN" \
    --name "$APP_SERVICE_NAME" \
    --deployment-container-image-name "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" \
    --output table

# Configure container settings
echo "⚙️ Configuring container settings..."
az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" \
    --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
    --output table

# Get ACR credentials
ACR_USERNAME=$(az acr credential show \
    --name "$CONTAINER_REGISTRY" \
    --resource-group "$RESOURCE_GROUP" \
    --query "username" \
    --output tsv)

ACR_PASSWORD=$(az acr credential show \
    --name "$CONTAINER_REGISTRY" \
    --resource-group "$RESOURCE_GROUP" \
    --query "passwords[0].value" \
    --output tsv)

# Configure ACR credentials for App Service
echo "🔐 Configuring ACR credentials..."
az webapp config container set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-registry-server-user "$ACR_USERNAME" \
    --docker-registry-server-password "$ACR_PASSWORD" \
    --output table

# Configure application settings
echo "⚙️ Configuring application settings..."
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false" \
        "WEBSITES_PORT=3000" \
        "NODE_ENV=production" \
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
    --output table

# Enable continuous deployment
echo "🔄 Enabling continuous deployment..."
az webapp deployment container config \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --enable-cd true \
    --output table

# Get App Service URL
APP_URL=$(az webapp show \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostName" \
    --output tsv)

# Configure custom domain if specified
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo "🌐 Configuring custom domain: $CUSTOM_DOMAIN"
    az webapp config hostname add \
        --webapp-name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --hostname "$CUSTOM_DOMAIN"
fi

echo ""
echo "✅ Azure App Service deployment completed!"
echo ""
echo "🌐 Deployment Details:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  App Service: $APP_SERVICE_NAME"
echo "  Container Registry: $ACR_LOGIN_SERVER"
echo "  Image: $IMAGE_NAME:$IMAGE_TAG"
echo "  App URL: https://$APP_URL"
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo "  Custom Domain: https://$CUSTOM_DOMAIN"
fi
echo ""
echo "📋 Next Steps:"
echo "  1. Configure custom domain DNS if using custom domain"
echo "  2. Set up SSL certificate for custom domain"
echo "  3. Configure monitoring and alerts"
echo "  4. Set up CI/CD pipeline for automatic deployments"
echo ""
echo "🎉 Deployment completed successfully!"

# Optional: Open the deployed site
if command -v open &> /dev/null; then
    echo "🌐 Opening deployed site..."
    open "https://$APP_URL"
elif command -v xdg-open &> /dev/null; then
    echo "🌐 Opening deployed site..."
    xdg-open "https://$APP_URL"
fi
