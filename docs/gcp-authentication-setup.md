# Google Cloud Authentication Setup Guide

This guide provides step-by-step instructions to fix the Google Cloud authentication issue in GitHub Actions.

## Error Analysis

The error `invalid_target` indicates that the workload identity provider configuration is incorrect. This typically happens when:

1. The workload identity pool doesn't exist
2. The provider within the pool doesn't exist
3. The audience parameter is malformed
4. The service account doesn't have the correct permissions

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

### Repository Secrets (Settings → Secrets and variables → Actions)

| Secret Name | Description | Example Format |
|-------------|-------------|----------------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID | `pixelated-empathy-123456` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full resource name of the workload identity provider | `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account email for authentication | `github-actions@pixelated-empathy-123456.iam.gserviceaccount.com` |
| `GKE_CLUSTER_NAME` | Name of your GKE cluster | `pixelated-cluster` |
| `GKE_ZONE` | Zone where your GKE cluster is located | `us-central1-a` |
| `GKE_NAMESPACE` | Kubernetes namespace for deployment | `production` |

## Google Cloud Setup Steps

### 1. Enable Required APIs

```bash
gcloud services enable \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com \
  container.googleapis.com
```

### 2. Create Workload Identity Pool

```bash
# Create the workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Get the pool ID
gcloud iam workload-identity-pools describe github-pool \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format="value(name)"
```

### 3. Create Workload Identity Provider

```bash
# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 4. Create Service Account

```bash
# Create the service account
gcloud iam service-accounts create github-actions \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.clusterViewer"

# Grant GKE permissions
gcloud container clusters get-credentials ${GKE_CLUSTER_NAME} --zone=${GKE_ZONE}
kubectl create clusterrolebinding github-actions-admin \
  --clusterrole=cluster-admin \
  --user=github-actions@${PROJECT_ID}.iam.gserviceaccount.com
```

### 5. Grant Workload Identity Access

```bash
# Allow the GitHub Actions workflow to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool"
```

### 6. Update GitHub Secrets

After completing the above steps, update your GitHub secrets with the correct values:

1. **GCP_PROJECT_ID**: Your actual project ID
2. **GCP_WORKLOAD_IDENTITY_PROVIDER**: The full resource name from step 3
3. **GCP_SERVICE_ACCOUNT_EMAIL**: `github-actions@${PROJECT_ID}.iam.gserviceaccount.com`

## Verification Script

You can verify the setup with this script:

```bash
#!/bin/bash
set -e

PROJECT_ID="your-project-id"
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

echo "Project ID: ${PROJECT_ID}"
echo "Project Number: ${PROJECT_NUMBER}"

# Check workload identity pool
echo "Checking workload identity pool..."
gcloud iam workload-identity-pools describe github-pool \
  --project="${PROJECT_ID}" \
  --location="global"

# Check provider
echo "Checking workload identity provider..."
gcloud iam workload-identity-pools providers describe github-provider \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool"

# Check service account
echo "Checking service account..."
gcloud iam service-accounts describe github-actions@${PROJECT_ID}.iam.gserviceaccount.com

echo "✅ Setup verification complete!"
```

## Troubleshooting

### Common Issues and Solutions

1. **Error: `invalid_target`**
   - Ensure the workload identity provider exists
   - Verify the format matches: `projects/{project-id}/locations/global/workloadIdentityPools/{pool-id}/providers/{provider-id}`

2. **Error: `permission denied`**
   - Check if the service account has the necessary roles
   - Verify the workload identity user binding is correct

3. **Error: `project not found`**
   - Ensure the project ID is correct
   - Verify the project exists and you have access

### Debug Commands

```bash
# List workload identity pools
gcloud iam workload-identity-pools list --project="${PROJECT_ID}" --location="global"

# List providers in a pool
gcloud iam workload-identity-pools providers list --project="${PROJECT_ID}" --location="global" --workload-identity-pool="github-pool"

# Check service account permissions
gcloud iam service-accounts get-iam-policy github-actions@${PROJECT_ID}.iam.gserviceaccount.com
```

## Testing the Fix

After updating the secrets, test the authentication by:

1. Creating a test branch
2. Pushing a small change
3. Monitoring the GitHub Actions workflow
4. Checking the authentication step logs

The authentication should now succeed with the correct configuration.