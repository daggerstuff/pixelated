# Azure DevOps Variable Groups and Secrets Configuration

## Current Deployment Info (Updated: 2025-11-25)

| Resource | Value |
|----------|-------|
| **AKS Cluster** | `pixelated-aks-cluster` |
| **Resource Group** | `pixelated-azure-resources` |
| **Region** | East US |
| **ACR** | `pixelatedregistry.azurecr.io` |
| **External IP** | `20.242.241.80` (NGINX Ingress) |
| **Staging URL** | `https://staging.pixelatedempathy.com` |
| **Production URL** | `https://pixelatedempathy.com` |
| **Current Image** | `pixelatedregistry.azurecr.io/pixelatedempathy:launch-2025-11-25` |

### DNS Configuration

Point these A records to `20.242.241.80`:
- `staging.pixelatedempathy.com`
- `pixelatedempathy.com`

## Overview

This document outlines all variables and secrets that must be configured in Azure DevOps **Variable Groups** (accessible via Pipelines → Library → Variable Groups) or **Pipeline Variables** (Pipelines → Edit Pipeline → Variables).

**⚠️ CRITICAL: These should be configured in the Azure DevOps web interface, NOT hardcoded in the pipeline YAML file.**

## How to Configure Variables in Azure DevOps

### Option 1: Variable Groups (Recommended for reusable variables)

1. Navigate to **Pipelines** → **Library**
2. Click **+ Variable group**
3. Name it (e.g., `pixelated-pipeline-variables`)
4. Add variables with these settings:
   - **Value**: Enter the variable value
   - **Keep this value secret**: ✅ Check this for secrets
   - **Allow access to all pipelines**: ✅ Check this or scope to specific pipelines
5. Save the variable group
6. Reference in pipeline YAML:
   ```yaml
   variables:
   - group: pixelated-pipeline-variables
   ```

### Option 2: Pipeline Variables (For pipeline-specific variables)

1. Navigate to **Pipelines** → Your Pipeline → **Edit**
2. Click **Variables** button (top right)
3. Click **+ New variable**
4. Enter variable name and value
5. Check **Keep this value secret** for sensitive data
6. Save

## Required Variables for Schedule Posts Pipeline

### Build Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `NODE_VERSION` | `24.8.0` | ❌ No | Node.js version to use |
| `PNPM_VERSION` | `10.27.0` | ❌ No | pnpm version to use |
| `PYTHON_VERSION` | `3.11` | ❌ No | Python version (if needed) |
| `NODE_ENV` | `production` | ❌ No | Node environment |
| `GITHUB_ACTIONS` | `false` | ❌ No | Set to false for Azure Pipelines |

### Git/Repository Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `SYSTEM_ACCESSTOKEN` | `$(System.AccessToken)` | ✅ Yes | Azure DevOps access token (automatically provided) |

**Note**: `SYSTEM_ACCESSTOKEN` is automatically available in Azure Pipelines when `persistCredentials: true` is set in checkout. You don't need to manually configure this, but the pipeline needs permission to access it.

### Azure Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `AZURE_SUBSCRIPTION` | `azure-startups-connection` | ❌ No | Azure subscription service connection name |
| `AZURE_RESOURCE_GROUP` | `pixelated-azure-resources` | ❌ No | Azure resource group name |
| `AZURE_LOCATION` | `eastus` | ❌ No | Azure region |
| `AZURE_CONTAINER_REGISTRY` | `pixelatedregistry` | ❌ No | Azure Container Registry name |

### Kubernetes Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `AKS_CLUSTER_NAME` | `pixelated-aks-cluster` | ❌ No | Azure Kubernetes Service cluster name |
| `KUBE_NAMESPACE` | `pixelated-staging` | ❌ No | Kubernetes namespace for staging |
| `KUBE_NAMESPACE_PROD` | `pixelated-production` | ❌ No | Kubernetes namespace for production |

### Application Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `IMAGE_REPOSITORY` | `pixelatedempathy` | ❌ No | Docker image repository name |
| `STAGING_URL` | `https://staging.pixelatedempathy.com` | ❌ No | Staging environment URL |
| `PRODUCTION_URL` | `https://pixelatedempathy.com` | ❌ No | Production environment URL |
| `EXTERNAL_IP` | `20.242.241.80` | ❌ No | NGINX Ingress Controller external IP |

### Sentry Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `SENTRY_DSN` | `https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032` | ❌ No | Sentry DSN for error tracking |
| `SENTRY_ORG` | `pixelated-empathy-dq` | ❌ No | Sentry organization slug |
| `SENTRY_PROJECT` | `pixel-astro` | ❌ No | Sentry project slug (environments separated via `-e staging`/`-e production` flags) |
| `SENTRY_AUTH_TOKEN` | `sntrys_eyJ...` | ✅ Yes | Sentry authentication token for releases |

### Deployment Configuration Variables

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `DEPLOYMENT_TIMEOUT` | `600` | ❌ No | Deployment timeout in seconds |
| `HEALTH_CHECK_TIMEOUT` | `300` | ❌ No | Health check timeout in seconds |

### OVH AI Training Variables (Optional)

These variables are required for the OVH AI Training stage. Add them if using OVH for model training.

| Variable Name | Value | Secret? | Description |
|--------------|-------|---------|-------------|
| `OVH_AI_TOKEN` | `<your-ovh-token>` | ✅ Yes | OVH AI Platform authentication token |
| `WANDB_API_KEY` | `<your-wandb-key>` | ✅ Yes | Weights & Biases API key for experiment tracking |
| `TRIGGER_AI_TRAINING` | `false` | ❌ No | Set to `true` to trigger AI training stage |

**To trigger AI training:**
```bash
az pipelines run --name "your-pipeline" --parameters TRIGGER_AI_TRAINING=true
```

**OVH Setup:**
1. Create an OVH AI Platform user at [OVH Control Panel](https://us.ovhcloud.com/)
2. Assign roles: `AI Training Operator` and `ObjectStore operator`
3. Generate an application token
4. Add the token to Azure DevOps variable group as `OVH_AI_TOKEN`

**Object Storage Setup:**
- Create containers: `pixel-data` and `pixelated-checkpoints`
- Region: US-EAST-VA

## Pipeline Permissions Setup

For the Schedule Posts pipeline to work, you need to:

1. **Grant repository permissions**:
   - Go to **Project Settings** → **Repositories** → Select your repository
   - Go to **Security** tab
   - Find **Project Collection Build Service** or **[Your Project] Build Service**
   - Grant **Contribute** permission ✅

2. **Enable OAuth token access**:
   - In your pipeline YAML, the checkout step should have:
     ```yaml
     - checkout: self
       persistCredentials: true
     ```
   - This enables access to `$(System.AccessToken)` for git operations

3. **Create a scheduled trigger** (if using schedules):
   - Go to **Pipelines** → Your Pipeline → **Edit**
   - Click **Triggers** tab
   - Enable **Scheduled builds**
   - Add schedule: `0 0 * * *` (daily at midnight UTC)
   - Select branches: `master`, `main`

## Variable Group Example

Create a variable group named `pixelated-pipeline-variables` with:

**Non-secret variables:**
- `NODE_VERSION`: `24.8.0`
- `PNPM_VERSION`: `10.27.0`
- `PYTHON_VERSION`: `3.11`
- `NODE_ENV`: `production`
- `GITHUB_ACTIONS`: `false`
- `AZURE_SUBSCRIPTION`: `azure-startups-connection`
- `AZURE_RESOURCE_GROUP`: `pixelated-azure-resources`
- `AZURE_LOCATION`: `eastus`
- `AZURE_CONTAINER_REGISTRY`: `pixelatedregistry`
- `AKS_CLUSTER_NAME`: `pixelated-aks-cluster`
- `KUBE_NAMESPACE`: `pixelated-staging`
- `KUBE_NAMESPACE_PROD`: `pixelated-production`
- `IMAGE_REPOSITORY`: `pixelatedempathy`
- `STAGING_URL`: `https://staging.pixelatedempathy.com`
- `PRODUCTION_URL`: `https://pixelatedempathy.com`
- `DEPLOYMENT_TIMEOUT`: `600`
- `HEALTH_CHECK_TIMEOUT`: `300`

**Secret variables:**
- `SENTRY_AUTH_TOKEN`: Your Sentry authentication token (for release tracking)

**Note:** System.AccessToken is auto-provided for git operations.

## Testing Variables

After configuring variables:

1. Run a manual pipeline execution
2. Check the logs to verify variables are being read correctly
3. Ensure the schedule-posts script can access git credentials

## Troubleshooting

### "Permission denied" errors
- Verify repository permissions are granted to Build Service
- Check that `persistCredentials: true` is set in checkout step

### Variables not found
- Verify variable group is linked to the pipeline
- Check variable names match exactly (case-sensitive)
- Ensure variable scope includes your pipeline

### Git operations failing
- Verify `SYSTEM_ACCESSTOKEN` is available (automatic with persistCredentials)
- Check git config is set correctly in the pipeline step

## Security Best Practices

1. ✅ **Never commit secrets** to the repository
2. ✅ **Use Variable Groups** for reusable secrets across pipelines
3. ✅ **Mark secrets as secret** in Azure DevOps UI (they won't be visible in logs)
4. ✅ **Use pipeline-specific variables** for environment-specific values
5. ✅ **Rotate secrets regularly** in production
6. ✅ **Limit access** to variable groups using Azure DevOps security groups

