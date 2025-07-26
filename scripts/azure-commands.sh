# Docker Azure Container Registry Commands

# Quick reference for common ACR operations

## Authentication
az login
az acr login --name pixelatedcr

## Build and Push (Automated)
./scripts/docker-push-azure.sh

## Pull and Run (Automated)
./scripts/docker-pull-azure.sh --run

## Manual Operations

# Build image
docker build -f Dockerfile.azure -t pixelatedcr.azurecr.io/pixelated-app:latest .

# Push image
docker push pixelatedcr.azurecr.io/pixelated-app:latest

# Pull image
docker pull pixelatedcr.azurecr.io/pixelated-app:latest

# Run container
docker run -d --name pixelated-app -p 3000:3000 pixelatedcr.azurecr.io/pixelated-app:latest

# List registry repositories
az acr repository list --name pixelatedcr

# List image tags
az acr repository show-tags --name pixelatedcr --repository pixelated-app

# Delete old images (cleanup)
az acr repository delete --name pixelatedcr --repository pixelated-app --tag <old-tag>

## Container Management

# View running containers
docker ps

# View container logs
docker logs pixelated-app

# Stop container
docker stop pixelated-app

# Remove container
docker rm pixelated-app

# Clean up unused images
docker image prune -f

## Health Checks

# Test local application
curl http://localhost:3000/api/health

# Test deployed application
curl https://pixelated-app.azurewebsites.net/api/health

## Troubleshooting

# Check Azure login status
az account show

# Check ACR permissions
az acr check-health --name pixelatedcr

# View Azure App Service logs
az webapp log tail --name pixelated-app --resource-group pixelated-rg

# Check container registry webhook
az acr webhook list --registry pixelatedcr
