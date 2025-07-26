#!/bin/bash
set -euo pipefail

RESOURCE_GROUP="pixelated-rg"
ACR_NAME="pixelatedcr"

echo "🚀 Emergency Docker build and push..."

# Login to ACR
az acr login --name "$ACR_NAME"
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)

# Build and push image
docker build -t "$ACR_LOGIN_SERVER/pixelated:latest" .
docker push "$ACR_LOGIN_SERVER/pixelated:latest"

echo "✅ Image pushed successfully!"

# Update App Service
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value --output tsv)

az webapp config container set \
  --name "pixelated" \
  --resource-group "$RESOURCE_GROUP" \
  --container-image-name "$ACR_LOGIN_SERVER/pixelated:latest" \
  --container-registry-url "https://$ACR_LOGIN_SERVER" \
  --container-registry-user "$ACR_USERNAME" \
  --container-registry-password "$ACR_PASSWORD"

az webapp config appsettings set \
  --name "pixelated" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NODE_ENV=production \
    PORT=4321 \
    WEBSITES_PORT=4321 \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false

az webapp restart --name "pixelated" --resource-group "$RESOURCE_GROUP"

echo "🎉 Deployment fixed!"