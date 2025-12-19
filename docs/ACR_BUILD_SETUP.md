# Azure Container Registry Build Setup

## Overview

The Docker image for Pixelated Empathy is built remotely via GitLab CI/CD and pushed to Azure Container Registry (ACR).

## GitLab CI/CD Configuration

The `.gitlab-ci.yml` file includes a `build:acr` job that:
1. Builds the Docker image from the `Dockerfile`
2. Tags it with the commit SHA and `latest`
3. Pushes to Azure Container Registry

## Required GitLab CI/CD Variables

Configure these variables in GitLab: **Settings > CI/CD > Variables**

| Variable | Description | Example | Protected | Masked |
|----------|-------------|---------|-----------|--------|
| `ACR_NAME` | Azure Container Registry name | `pixelatedregistry` | ✅ | ❌ |
| `ACR_USERNAME` | ACR admin username | `pixelatedregistry` | ✅ | ❌ |
| `ACR_PASSWORD` | ACR admin password | `[password]` | ✅ | ✅ |

## Getting ACR Credentials

To get the ACR credentials:

```bash
# Login to Azure
az login

# Get ACR login server
az acr show --name pixelatedregistry --query loginServer --output tsv

# Get ACR admin credentials (if admin is enabled)
az acr credential show --name pixelatedregistry --query username --output tsv
az acr credential show --name pixelatedregistry --query passwords[0].value --output tsv
```

**Note**: If ACR admin is disabled, you'll need to use a service principal or managed identity instead.

## Build Process

1. **Trigger**: The `build:acr` job runs automatically on pushes to `master`/`main` branch
2. **Build**: Docker image is built using the `Dockerfile` in the repository root
3. **Tag**: Image is tagged as:
   - `${ACR_NAME}.azurecr.io/pixelatedempathy:${CI_COMMIT_SHORT_SHA}`
   - `${ACR_NAME}.azurecr.io/pixelatedempathy:latest`
4. **Push**: Both tags are pushed to ACR

## Manual Build (Alternative)

If you need to build locally, use the provided script:

```bash
./scripts/build-and-push-azure.sh --latest
```

## Updating Kubernetes Deployment

After the image is built and pushed, update the Kubernetes deployment:

```bash
export KUBECONFIG=./terraform/kubeconfig-staging.config

# Update the deployment to use the new image
kubectl set image deployment/pixelated \
  pixelated=pixelatedregistry.azurecr.io/pixelatedempathy:latest \
  -n pixelated

# Or use a specific commit SHA
kubectl set image deployment/pixelated \
  pixelated=pixelatedregistry.azurecr.io/pixelatedempathy:57670b21 \
  -n pixelated

# Check rollout status
kubectl rollout status deployment/pixelated -n pixelated
```

## Troubleshooting

### Build Job Fails with "ACR variables not set"
- Ensure all three variables (`ACR_NAME`, `ACR_USERNAME`, `ACR_PASSWORD`) are set in GitLab CI/CD variables
- Check that variables are not expired or deleted

### Build Job Fails with "Authentication failed"
- Verify ACR credentials are correct
- Check if ACR admin is enabled: `az acr show --name pixelatedregistry --query adminUserEnabled`
- If admin is disabled, use a service principal instead

### Image Push Fails
- Verify the ACR name is correct
- Check network connectivity from GitLab runners
- Ensure the service account has `AcrPush` role

## Related Files

- `.gitlab-ci.yml` - CI/CD pipeline configuration
- `scripts/build-and-push-azure.sh` - Local build script
- `Dockerfile` - Docker image definition
- `k8s/azure/pixelated-deployment.yaml` - Kubernetes deployment manifest
