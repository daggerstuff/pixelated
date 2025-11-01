#!/bin/bash
# GCR Migration Script for Pixelated Empathy
# This script helps migrate from GitLab Container Registry to Google Container Registry

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_PROJECT_ID="${GCP_PROJECT_ID:-pixelated-463209-e5}"
GCR_REGISTRY="gcr.io/${GCP_PROJECT_ID}"
IMAGE_NAME="pixelated-empathy"
NAMESPACE="pixelated"

echo -e "${GREEN}🚀 Starting GCR Migration for Pixelated Empathy${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated with GCP
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not authenticated with GCP. Run: gcloud auth login${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Step 1: Configure Docker for GCR
echo -e "${YELLOW}🔧 Configuring Docker for GCR...${NC}"
gcloud auth configure-docker --quiet
echo -e "${GREEN}✅ Docker configured for GCR${NC}"

# Step 2: Create GCR service account key if needed
echo -e "${YELLOW}🔑 Setting up GCR authentication...${NC}"
if [ -z "${GCP_SERVICE_ACCOUNT_KEY:-}" ]; then
    echo -e "${YELLOW}⚠️ GCP_SERVICE_ACCOUNT_KEY not set. Creating service account key...${NC}"
    
    # Create service account if it doesn't exist
    SERVICE_ACCOUNT_NAME="gcr-access"
    SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
    
    if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &>/dev/null; then
        echo -e "${YELLOW}Creating service account: ${SERVICE_ACCOUNT_NAME}${NC}"
        gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
            --display-name="GCR Access Service Account" \
            --description="Service account for accessing Google Container Registry"
    fi
    
    # Grant necessary permissions
    echo -e "${YELLOW}Granting permissions to service account...${NC}"
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/storage.admin"
    
    # Create key
    echo -e "${YELLOW}Creating service account key...${NC}"
    gcloud iam service-accounts keys create /tmp/gcr-key.json \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    
    export GCP_SERVICE_ACCOUNT_KEY=$(base64 -w 0 /tmp/gcr-key.json)
    echo -e "${GREEN}✅ Service account key created${NC}"
fi

# Step 3: Build and push image to GCR
echo -e "${YELLOW}🏗️ Building and pushing image to GCR...${NC}"
docker build -t "${GCR_REGISTRY}/${IMAGE_NAME}:latest" .
docker push "${GCR_REGISTRY}/${IMAGE_NAME}:latest"
echo -e "${GREEN}✅ Image pushed to GCR${NC}"

# Step 4: Create GCR secret in Kubernetes
echo -e "${YELLOW}🔐 Creating GCR secret in Kubernetes...${NC}"
kubectl create secret docker-registry gcr-secret \
    --docker-server=gcr.io \
    --docker-username=_json_key \
    --docker-password="$(echo "$GCP_SERVICE_ACCOUNT_KEY" | base64 -d)" \
    --docker-email=any@valid.email \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✅ GCR secret created${NC}"

# Step 5: Update deployment to use GCR image
echo -e "${YELLOW}🔄 Updating deployment to use GCR image...${NC}"
kubectl set image deployment/pixelated \
    pixelated="${GCR_REGISTRY}/${IMAGE_NAME}:latest" \
    --namespace="$NAMESPACE"
echo -e "${GREEN}✅ Deployment updated${NC}"

# Step 6: Verify deployment
echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
kubectl rollout status deployment/pixelated --namespace="$NAMESPACE" --timeout=300s

# Check if pods are running
READY_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=pixelated -o json | \
    jq '[.items[] | select(.status.phase == "Running" and (.status.containerStatuses[]?.ready // false))] | length')
TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=pixelated -o json | jq '.items | length')

echo -e "${GREEN}📊 Deployment status: ${READY_PODS}/${TOTAL_PODS} pods ready${NC}"

if [ "$READY_PODS" -gt 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo -e "${GREEN}🌐 Application is now running from GCR${NC}"
else
    echo -e "${RED}❌ Migration failed - no healthy pods${NC}"
    exit 1
fi

# Step 7: Cleanup old GitLab registry images (optional)
echo -e "${YELLOW}🧹 Cleaning up old GitLab registry images...${NC}"
echo -e "${YELLOW}⚠️ This step requires manual confirmation${NC}"
read -p "Do you want to remove old GitLab registry images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Removing old GitLab images...${NC}"
    # This would require GitLab API calls or manual cleanup
    echo -e "${YELLOW}Please manually clean up old GitLab registry images${NC}"
fi

echo -e "${GREEN}🎉 GCR Migration completed successfully!${NC}"
echo -e "${GREEN}📋 Summary:${NC}"
echo -e "  - Image: ${GCR_REGISTRY}/${IMAGE_NAME}:latest"
echo -e "  - Namespace: ${NAMESPACE}"
echo -e "  - Secret: gcr-secret"
echo -e "  - Deployment: Updated to use GCR image"

# Cleanup
rm -f /tmp/gcr-key.json