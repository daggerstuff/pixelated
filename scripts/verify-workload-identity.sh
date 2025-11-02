#!/bin/bash
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Google Cloud Workload Identity Federation Verification Script"
echo "================================================================"
echo ""

# Check if PROJECT_ID is set
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  GCP_PROJECT_ID not set. Using default or checking from gcloud config...${NC}"
    GCP_PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo -e "${RED}❌ Error: GCP_PROJECT_ID must be set${NC}"
        echo "Usage: export GCP_PROJECT_ID=your-project-id && ./verify-workload-identity.sh"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Using Project ID: ${GCP_PROJECT_ID}"
PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)" 2>/dev/null || echo "")
if [ -z "$PROJECT_NUMBER" ]; then
    echo -e "${RED}❌ Error: Could not get project number. Check if project exists and you have access.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Project Number: ${PROJECT_NUMBER}"
echo ""

# Step 1: Check if required APIs are enabled
echo "📡 Step 1: Checking required APIs..."
APIS=("iam.googleapis.com" "iamcredentials.googleapis.com" "sts.googleapis.com")
MISSING_APIS=()

for API in "${APIS[@]}"; do
    if gcloud services list --enabled --project=${GCP_PROJECT_ID} --filter="name:${API}" --format="value(name)" 2>/dev/null | grep -q "${API}"; then
        echo -e "${GREEN}✓${NC} API ${API} is enabled"
    else
        echo -e "${RED}❌${NC} API ${API} is NOT enabled"
        MISSING_APIS+=("${API}")
    fi
done

if [ ${#MISSING_APIS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Missing APIs detected. Enable them with:${NC}"
    echo "gcloud services enable ${MISSING_APIS[*]} --project=${GCP_PROJECT_ID}"
    echo ""
fi

# Step 2: Check Workload Identity Pool
echo ""
echo "🏊 Step 2: Checking Workload Identity Pool..."
POOL_NAME="github-pool"
if gcloud iam workload-identity-pools describe ${POOL_NAME} \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --format="value(name)" > /dev/null 2>&1; then
    POOL_RESOURCE=$(gcloud iam workload-identity-pools describe ${POOL_NAME} \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --format="value(name)")
    echo -e "${GREEN}✓${NC} Pool '${POOL_NAME}' exists"
    echo -e "${GREEN}✓${NC} Pool resource: ${POOL_RESOURCE}"

    # Check pool state
    STATE=$(gcloud iam workload-identity-pools describe ${POOL_NAME} \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --format="value(state)" 2>/dev/null || echo "UNKNOWN")

    if [ "$STATE" = "ACTIVE" ]; then
        echo -e "${GREEN}✓${NC} Pool state: ACTIVE"
    else
        echo -e "${RED}❌${NC} Pool state: ${STATE} (should be ACTIVE)"
    fi
else
    echo -e "${RED}❌${NC} Pool '${POOL_NAME}' does NOT exist"
    echo ""
    echo -e "${YELLOW}⚠️  Create it with:${NC}"
    echo "gcloud iam workload-identity-pools create ${POOL_NAME} \\"
    echo "  --project=\"${GCP_PROJECT_ID}\" \\"
    echo "  --location=\"global\" \\"
    echo "  --display-name=\"GitHub Actions Pool\""
    exit 1
fi

# Step 3: Check Workload Identity Provider
echo ""
echo "🔗 Step 3: Checking Workload Identity Provider..."
PROVIDER_NAME="github-provider"
if gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" \
    --format="value(name)" > /dev/null 2>&1; then
    PROVIDER_RESOURCE=$(gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" \
        --format="value(name)")
    echo -e "${GREEN}✓${NC} Provider '${PROVIDER_NAME}' exists"
    echo -e "${GREEN}✓${NC} Provider resource: ${PROVIDER_RESOURCE}"

    # Check issuer URI
    ISSUER=$(gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" \
        --format="value(oidc.issuerUri)" 2>/dev/null || echo "")

    if [ "$ISSUER" = "https://token.actions.githubusercontent.com" ]; then
        echo -e "${GREEN}✓${NC} Issuer URI is correct: ${ISSUER}"
    else
        echo -e "${YELLOW}⚠️  Issuer URI: ${ISSUER}"
        echo -e "${YELLOW}   Expected: https://token.actions.githubusercontent.com${NC}"
    fi

    # Check state
    STATE=$(gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" \
        --format="value(state)" 2>/dev/null || echo "UNKNOWN")

    if [ "$STATE" = "ACTIVE" ] || [ -z "$STATE" ]; then
        echo -e "${GREEN}✓${NC} Provider state: ${STATE:-ACTIVE}"
    else
        echo -e "${RED}❌${NC} Provider state: ${STATE} (should be ACTIVE or empty)"
    fi
else
    echo -e "${RED}❌${NC} Provider '${PROVIDER_NAME}' does NOT exist"
    echo ""
    echo -e "${YELLOW}⚠️  Create it with:${NC}"
    echo "gcloud iam workload-identity-pools providers create-oidc ${PROVIDER_NAME} \\"
    echo "  --project=\"${GCP_PROJECT_ID}\" \\"
    echo "  --location=\"global\" \\"
    echo "  --workload-identity-pool=\"${POOL_NAME}\" \\"
    echo "  --display-name=\"GitHub Provider\" \\"
    echo "  --attribute-mapping=\"google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository\" \\"
    echo "  --issuer-uri=\"https://token.actions.githubusercontent.com\""
    exit 1
fi

# Step 4: Check Service Account
echo ""
echo "👤 Step 4: Checking Service Account..."
SERVICE_ACCOUNT_EMAIL="${1:-action@pixelatedempathy.com}"
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} \
    --project="${GCP_PROJECT_ID}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Service account '${SERVICE_ACCOUNT_EMAIL}' exists"
else
    echo -e "${RED}❌${NC} Service account '${SERVICE_ACCOUNT_EMAIL}' does NOT exist"
    echo ""
    echo -e "${YELLOW}⚠️  Service account not found. Please verify the email address.${NC}"
    exit 1
fi

# Step 5: Check Workload Identity User Binding
echo ""
echo "🔐 Step 5: Checking Workload Identity User Binding..."
BINDING_CHECK=$(gcloud iam service-accounts get-iam-policy ${SERVICE_ACCOUNT_EMAIL} \
    --project="${GCP_PROJECT_ID}" \
    --format="json" 2>/dev/null | jq -r ".bindings[]? | select(.role==\"roles/iam.workloadIdentityUser\") | .members[]?" || echo "")

if echo "$BINDING_CHECK" | grep -q "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}"; then
    echo -e "${GREEN}✓${NC} Workload Identity User binding exists"
    echo "   Bindings found:"
    echo "$BINDING_CHECK" | grep "principalSet" | sed 's/^/   - /'
else
    echo -e "${RED}❌${NC} Workload Identity User binding is MISSING or INCORRECT"
    echo ""
    echo -e "${YELLOW}⚠️  Add the binding with:${NC}"
    echo "gcloud iam service-accounts add-iam-policy-binding ${SERVICE_ACCOUNT_EMAIL} \\"
    echo "  --project=\"${GCP_PROJECT_ID}\" \\"
    echo "  --role=\"roles/iam.workloadIdentityUser\" \\"
    echo "  --member=\"principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository_owner/pixelatedempathy\""
    exit 1
fi

# Step 6: Verify expected GitHub secret values
echo ""
echo "📋 Step 6: Expected GitHub Secrets Configuration"
echo "-------------------------------------------------"
echo ""
echo "Set these secrets in your GitHub repository (Settings → Secrets and variables → Actions):"
echo ""
echo -e "${GREEN}GCP_PROJECT_ID${NC}: ${GCP_PROJECT_ID}"
echo -e "${GREEN}GCP_WORKLOAD_IDENTITY_PROVIDER${NC}: ${PROVIDER_RESOURCE}"
echo -e "${GREEN}GCP_SERVICE_ACCOUNT_EMAIL${NC}: ${SERVICE_ACCOUNT_EMAIL}"
echo ""

# Final summary
echo "================================================================"
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "If all checks passed but you still see errors, verify:"
echo "1. GitHub secrets are set correctly (no extra spaces or quotes)"
echo "2. Repository name matches the binding (pixelatedempathy/pixelated)"
echo "3. GitHub Actions has 'id-token: write' permission in workflow"
echo ""

