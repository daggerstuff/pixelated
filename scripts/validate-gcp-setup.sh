#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Google Cloud Authentication Validator"
echo "======================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo -e "${RED}❌ Not authenticated with gcloud. Run: gcloud auth login${NC}"
    exit 1
fi

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$CURRENT_PROJECT" ]; then
    echo -e "${YELLOW}⚠️  No project set. Please set a project:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✅ Current project: $CURRENT_PROJECT${NC}"

# Check required APIs
echo ""
echo "📋 Checking required APIs..."
APIS=(
    "iam.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "sts.googleapis.com"
    "container.googleapis.com"
)

for api in "${APIS[@]}"; do
    if gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
        echo -e "${GREEN}✅ $api${NC}"
    else
        echo -e "${RED}❌ $api (not enabled)${NC}"
    fi
done

# Check workload identity pool
echo ""
echo "🔍 Checking workload identity pool..."
POOL_EXISTS=$(gcloud iam workload-identity-pools list --project="$CURRENT_PROJECT" --location="global" --filter="name:github-pool" --format="value(name)" || echo "")
if [ -n "$POOL_EXISTS" ]; then
    echo -e "${GREEN}✅ Workload identity pool 'github-pool' exists${NC}"
    
    # Check provider
    PROVIDER_EXISTS=$(gcloud iam workload-identity-pools providers list --project="$CURRENT_PROJECT" --location="global" --workload-identity-pool="github-pool" --filter="name:github-provider" --format="value(name)" || echo "")
    if [ -n "$PROVIDER_EXISTS" ]; then
        echo -e "${GREEN}✅ Provider 'github-provider' exists${NC}"
        
        # Get the full provider name
        PROVIDER_FULL_NAME=$(gcloud iam workload-identity-pools providers describe github-provider --project="$CURRENT_PROJECT" --location="global" --workload-identity-pool="github-pool" --format="value(name)")
        echo -e "${GREEN}📋 Provider full name:${NC}"
        echo "   $PROVIDER_FULL_NAME"
    else
        echo -e "${RED}❌ Provider 'github-provider' does not exist${NC}"
    fi
else
    echo -e "${RED}❌ Workload identity pool 'github-pool' does not exist${NC}"
fi

# Check service account
echo ""
echo "👤 Checking service account..."
SA_EXISTS=$(gcloud iam service-accounts list --project="$CURRENT_PROJECT" --filter="email:github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com" --format="value(email)" || echo "")
if [ -n "$SA_EXISTS" ]; then
    echo -e "${GREEN}✅ Service account 'github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com' exists${NC}"
    
    # Check permissions
    echo "🔐 Checking service account permissions..."
    PERMISSIONS=$(gcloud projects get-iam-policy "$CURRENT_PROJECT" --flatten="bindings[].members" --filter="bindings.members:serviceAccount:github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com" --format="value(bindings.role)" || echo "")
    if [ -n "$PERMISSIONS" ]; then
        echo -e "${GREEN}✅ Service account has the following roles:${NC}"
        echo "$PERMISSIONS" | sed 's/^/   /'
    else
        echo -e "${YELLOW}⚠️  Service account has no project-level roles${NC}"
    fi
    
    # Check workload identity user binding
    SA_POLICY=$(gcloud iam service-accounts get-iam-policy github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com --project="$CURRENT_PROJECT" --format="yaml" || echo "")
    if echo "$SA_POLICY" | grep -q "roles/iam.workloadIdentityUser"; then
        echo -e "${GREEN}✅ Service account has workload identity user binding${NC}"
    else
        echo -e "${YELLOW}⚠️  Service account missing workload identity user binding${NC}"
    fi
else
    echo -e "${RED}❌ Service account 'github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com' does not exist${NC}"
fi

# Generate GitHub secrets configuration
echo ""
echo "📋 GitHub Secrets Configuration"
echo "=============================="
echo "Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):"
echo ""
echo "GCP_PROJECT_ID: $CURRENT_PROJECT"
echo "GCP_SERVICE_ACCOUNT_EMAIL: github-actions@$CURRENT_PROJECT.iam.gserviceaccount.com"
if [ -n "$PROVIDER_FULL_NAME" ]; then
    echo "GCP_WORKLOAD_IDENTITY_PROVIDER: $PROVIDER_FULL_NAME"
else
    echo "GCP_WORKLOAD_IDENTITY_PROVIDER: [Run setup script to create provider]"
fi

# Check GKE cluster
echo ""
echo "☸️  Checking GKE cluster..."
CLUSTERS=$(gcloud container clusters list --project="$CURRENT_PROJECT" --format="value(name,zone)" || echo "")
if [ -n "$CLUSTERS" ]; then
    echo -e "${GREEN}✅ Found GKE clusters:${NC}"
    echo "$CLUSTERS" | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠️  No GKE clusters found${NC}"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Run the setup commands in docs/gcp-authentication-setup.md"
echo "2. Add the required secrets to your GitHub repository"
echo "3. Test the authentication with a new workflow run"