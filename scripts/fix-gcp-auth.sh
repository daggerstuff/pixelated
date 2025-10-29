#!/bin/bash
set -e

# Fix GCP Authentication for GitHub Actions
# This script verifies and fixes the Workload Identity configuration

PROJECT_ID="pixelated-463209-e5"
PROJECT_NUMBER="751556915102"
SERVICE_ACCOUNT="github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com"
WORKLOAD_IDENTITY_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"

echo "🔧 Fixing GCP Authentication Configuration"
echo "Project ID: ${PROJECT_ID}"
echo "Project Number: ${PROJECT_NUMBER}"
echo "Service Account: ${SERVICE_ACCOUNT}"
echo "Workload Identity Provider: ${WORKLOAD_IDENTITY_PROVIDER}"

echo ""
echo "✅ Current GitHub Secrets should be set to:"
echo ""
echo "Repository Secrets (GitHub Settings → Secrets and variables → Actions):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "GCP_PROJECT_ID: ${PROJECT_ID}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: ${WORKLOAD_IDENTITY_PROVIDER}"
echo "GCP_SERVICE_ACCOUNT_EMAIL: ${SERVICE_ACCOUNT}"
echo ""
echo "GKE Configuration (update these based on your cluster):"
echo "GKE_CLUSTER_NAME: your-cluster-name"
echo "GKE_ZONE: your-cluster-zone"
echo "GKE_NAMESPACE: production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔍 Verifying current setup..."

# Check if workload identity pool exists
echo "Checking workload identity pool..."
if gcloud iam workload-identity-pools describe github-pool \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format="value(name)" > /dev/null 2>&1; then
  echo "✅ Workload identity pool exists"
else
  echo "❌ Workload identity pool not found"
  exit 1
fi

# Check if provider exists
echo "Checking workload identity provider..."
if gcloud iam workload-identity-pools providers describe github-provider \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)" > /dev/null 2>&1; then
  echo "✅ Workload identity provider exists"
else
  echo "❌ Workload identity provider not found"
  exit 1
fi

# Check if service account exists
echo "Checking service account..."
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" > /dev/null 2>&1; then
  echo "✅ Service account exists"
else
  echo "❌ Service account not found"
  exit 1
fi

# Check IAM bindings
echo "Checking IAM bindings..."
BINDINGS=$(gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --format="value(bindings[].members)" 2>/dev/null || echo "")

if echo "${BINDINGS}" | grep -q "workloadIdentityPools/github-pool"; then
  echo "✅ Workload identity binding exists"
else
  echo "❌ Workload identity binding missing"
  echo "🔧 Adding workload identity binding..."
  
  gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/pixelatedempathy/pixelated" \
    --project="${PROJECT_ID}"
  
  echo "✅ Workload identity binding added"
fi

echo ""
echo "🧪 Testing authentication (dry run)..."

# Test token generation (this won't work in local environment but shows the format)
echo "The GitHub Actions workflow should now use:"
echo "  workload_identity_provider: ${WORKLOAD_IDENTITY_PROVIDER}"
echo "  service_account: ${SERVICE_ACCOUNT}"

echo ""
echo "✅ GCP Authentication configuration verified and fixed!"
echo ""
echo "Next steps:"
echo "1. Update your GitHub repository secrets with the values shown above"
echo "2. Commit the updated workflow file"
echo "3. Test the deployment by pushing to main/master branch"
echo ""
echo "If you still see authentication errors, ensure:"
echo "- Repository secrets are set correctly"
echo "- The repository name matches 'pixelatedempathy/pixelated'"
echo "- The branch protection rules allow Actions to run"