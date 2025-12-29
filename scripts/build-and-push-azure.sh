#!/usr/bin/env bash
set -euo pipefail

# Build and push Docker image to Azure Container Registry
# Usage: ./scripts/build-and-push-azure.sh [--tag TAG] [--latest] [--no-build]

# Configuration
ACR_NAME="pixelatedregistry"
ACR_FQDN="${ACR_NAME}.azurecr.io"
IMAGE_REPOSITORY="pixelatedempathy"
DOCKERFILE="docker/Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
CUSTOM_TAG=""
PUSH_LATEST=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    --latest)
      PUSH_LATEST=true
      shift
      ;;
    --no-build)
      SKIP_BUILD=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--tag TAG] [--latest] [--no-build]"
      echo ""
      echo "Options:"
      echo "  --tag TAG      Use custom tag instead of commit hash"
      echo "  --latest       Also tag and push as 'latest'"
      echo "  --no-build     Skip build step (only tag and push existing image)"
      echo ""
      echo "Examples:"
      echo "  $0                          # Build and push with commit hash tag"
      echo "  $0 --latest                 # Also push as 'latest'"
      echo "  $0 --tag v1.0.0 --latest    # Build and push with custom tag and latest"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Get commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_FULL=$(git rev-parse HEAD)

echo -e "${GREEN}🚀 Building and pushing Docker image to Azure Container Registry${NC}"
echo "=========================================================="
echo "ACR: ${ACR_FQDN}"
echo "Repository: ${IMAGE_REPOSITORY}"
echo "Commit: ${COMMIT_HASH} (${COMMIT_FULL})"
echo ""

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
  exit 1
fi

if ! command -v az &> /dev/null; then
  echo -e "${RED}❌ Azure CLI is not installed or not in PATH${NC}"
  echo "Install it with: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  exit 1
fi

# Check if logged into Azure
if ! az account show &> /dev/null; then
  echo -e "${YELLOW}⚠️  Not logged into Azure. Attempting to login...${NC}"
  az login
fi

# Login to ACR
echo -e "${GREEN}🔐 Logging into Azure Container Registry...${NC}"
az acr login --name "${ACR_NAME}" || {
  echo -e "${RED}❌ Failed to login to ACR${NC}"
  echo "Make sure you have the 'AcrPull' and 'AcrPush' roles assigned"
  exit 1
}

# Build image
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${GREEN}🏗️  Building Docker image...${NC}"
  docker build -f "${DOCKERFILE}" -t "${IMAGE_REPOSITORY}:${COMMIT_HASH}" . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Build completed${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping build (using existing image)${NC}"
fi

# Determine tag to use
if [ -n "$CUSTOM_TAG" ]; then
  TAG="$CUSTOM_TAG"
else
  TAG="$COMMIT_HASH"
fi

# Tag image for ACR
FULL_IMAGE_TAG="${ACR_FQDN}/${IMAGE_REPOSITORY}:${TAG}"
echo -e "${GREEN}🏷️  Tagging image as ${FULL_IMAGE_TAG}${NC}"
docker tag "${IMAGE_REPOSITORY}:${COMMIT_HASH}" "${FULL_IMAGE_TAG}"

# Push image
echo -e "${GREEN}📤 Pushing image to ACR...${NC}"
docker push "${FULL_IMAGE_TAG}" || {
  echo -e "${RED}❌ Failed to push image${NC}"
  exit 1
}
echo -e "${GREEN}✅ Image pushed successfully: ${FULL_IMAGE_TAG}${NC}"

# Push as 'latest' if requested
if [ "$PUSH_LATEST" = true ]; then
  LATEST_TAG="${ACR_FQDN}/${IMAGE_REPOSITORY}:latest"
  echo -e "${GREEN}🏷️  Tagging as latest...${NC}"
  docker tag "${IMAGE_REPOSITORY}:${COMMIT_HASH}" "${LATEST_TAG}"
  echo -e "${GREEN}📤 Pushing latest tag...${NC}"
  docker push "${LATEST_TAG}" || {
    echo -e "${YELLOW}⚠️  Failed to push latest tag (continuing)${NC}"
  }
  echo -e "${GREEN}✅ Latest tag pushed: ${LATEST_TAG}${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}✅ Successfully built and pushed Docker image${NC}"
echo "=========================================================="
echo "Image: ${FULL_IMAGE_TAG}"
if [ "$PUSH_LATEST" = true ]; then
  echo "Latest: ${ACR_FQDN}/${IMAGE_REPOSITORY}:latest"
fi
echo "Commit: ${COMMIT_HASH}"
echo "Full commit: ${COMMIT_FULL}"
echo ""
echo "To pull this image:"
echo "  docker pull ${FULL_IMAGE_TAG}"
echo ""
echo "To use in Kubernetes:"
echo "  kubectl set image deployment/pixelated pixelated=${FULL_IMAGE_TAG}"
