# GitLab CI/CD Inputs Usage Guide

This guide explains how to use the converted Azure Pipelines configuration with GitLab CI/CD inputs.

## Overview

The `.gitlab-ci-azure-converted.yml` file uses GitLab CI/CD inputs (`spec:inputs`) to make the pipeline configurable. This replaces Azure DevOps variable groups with typed, validated inputs.

## Input Parameters

### Required Inputs

These inputs must be provided when triggering the pipeline:

- `docker-registry`: Azure Container Registry name (without `.azurecr.io`)
- `image-repository`: Docker image repository name
- `azure-subscription`: Azure subscription ID or service connection name
- `azure-resource-group`: Azure resource group name
- `aks-cluster-name`: Azure Kubernetes Service cluster name

### Optional Inputs (with defaults)

- `node-version`: Node.js version (default: `"24"`)
- `kube-namespace`: Kubernetes namespace for staging (default: `"pixelated-staging"`)
- `kube-namespace-prod`: Kubernetes namespace for production (default: `"pixelated-production"`)
- `staging-url`: Staging environment URL (default: `"https://staging.pixelatedempathy.tech"`)
- `node-env`: Node.js environment (default: `"production"`, options: `development`, `staging`, `production`)
- `github-actions`: Enable GitHub Actions compatibility (default: `false`)
- `deployment-strategy`: Kubernetes deployment strategy (default: `"rolling"`, options: `rolling`, `canary`, `blue-green`)
- `security-scan-severity`: Trivy scan severity levels (default: `"CRITICAL,HIGH"`)
- `health-check-timeout`: Health check timeout in seconds (default: `300`)
- `deployment-timeout`: Deployment timeout in seconds (default: `600`)

## Usage Methods

### 1. Manual Pipeline Trigger (Web UI)

When triggering a pipeline manually in GitLab:

1. Go to **CI/CD > Pipelines**
2. Click **Run pipeline**
3. Fill in the required inputs in the form
4. Optionally override default values
5. Click **Run pipeline**

### 2. Using `include:inputs`

If you want to include this configuration in another `.gitlab-ci.yml`:

```yaml
include:
  - local: .gitlab-ci-azure-converted.yml
    inputs:
      docker-registry: "myregistry"
      image-repository: "pixelated-empathy"
      azure-subscription: "subscription-id"
      azure-resource-group: "rg-pixelated"
      aks-cluster-name: "aks-cluster"
      node-version: "24"
      kube-namespace: "pixelated-staging"
      staging-url: "https://staging.example.com"
```

### 3. Using `trigger:inputs`

To trigger this pipeline from another pipeline:

```yaml
trigger-deployment:
  stage: deploy
  trigger:
    include:
      - local: .gitlab-ci-azure-converted.yml
    inputs:
      docker-registry: "myregistry"
      image-repository: "pixelated-empathy"
      azure-subscription: "subscription-id"
      azure-resource-group: "rg-pixelated"
      aks-cluster-name: "aks-cluster"
```

### 4. Using GitLab API

```bash
curl --request POST \
  --header "PRIVATE-TOKEN: <your-token>" \
  --form "ref=main" \
  --form "variables[DOCKER_REGISTRY]=myregistry" \
  --form "variables[IMAGE_REPOSITORY]=pixelated-empathy" \
  "https://gitlab.com/api/v4/projects/:id/pipeline"
```

Note: For inputs, you'll need to use the GitLab API with the `inputs` parameter (available in GitLab 15.11+).

## Required CI/CD Variables

In addition to inputs, you need to configure these CI/CD variables in GitLab:

- `AZURE_CLIENT_ID`: Azure service principal client ID
- `AZURE_CLIENT_SECRET`: Azure service principal client secret (masked)
- `AZURE_TENANT_ID`: Azure tenant ID

These should be set at the project or group level in **Settings > CI/CD > Variables**.

## Migration from Azure DevOps

### Variable Group Mapping

| Azure DevOps Variable Group | GitLab CI/CD Input | Notes |
|----------------------------|-------------------|-------|
| `NODE_VERSION` | `node-version` | Has default value |
| `AZURE_CONTAINER_REGISTRY` | `docker-registry` | Required input |
| `IMAGE_REPOSITORY` | `image-repository` | Required input |
| `AZURE_SUBSCRIPTION` | `azure-subscription` | Required input |
| `AZURE_RESOURCE_GROUP` | `azure-resource-group` | Required input |
| `AKS_CLUSTER_NAME` | `aks-cluster-name` | Required input |
| `KUBE_NAMESPACE` | `kube-namespace` | Has default value |
| `KUBE_NAMESPACE_PROD` | `kube-namespace-prod` | Has default value |
| `STAGING_URL` | `staging-url` | Has default value |

### Service Connections

Azure DevOps service connections are replaced with:
- CI/CD variables for authentication (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`)
- Inputs for configuration (subscription, resource group, cluster name)

## Input Validation

The inputs include validation:

- **Type checking**: `string`, `number`, `boolean`, `array`
- **Options**: Restricted values for `node-env` and `deployment-strategy`
- **Defaults**: Sensible defaults for optional parameters
- **Descriptions**: Helpful descriptions for each input

## Example: Full Pipeline Trigger

```yaml
# In your main .gitlab-ci.yml
include:
  - local: .gitlab-ci-azure-converted.yml
    inputs:
      # Required
      docker-registry: "pixelatedregistry"
      image-repository: "pixelated-empathy"
      azure-subscription: "12345678-1234-1234-1234-123456789012"
      azure-resource-group: "rg-pixelated-prod"
      aks-cluster-name: "aks-pixelated-prod"
      
      # Optional overrides
      node-version: "24"
      kube-namespace: "pixelated-staging"
      kube-namespace-prod: "pixelated-production"
      staging-url: "https://staging.pixelatedempathy.tech"
      node-env: "production"
      deployment-strategy: "rolling"
      health-check-timeout: 300
      deployment-timeout: 600
```

## Benefits of Using Inputs

1. **Type Safety**: Inputs are validated at pipeline creation time
2. **Documentation**: Descriptions help users understand each parameter
3. **Validation**: Options and regex patterns prevent invalid values
4. **Reusability**: Same configuration can be used with different inputs
5. **Flexibility**: Easy to override defaults for different environments

## Troubleshooting

### Pipeline fails with "Input required"

If you see errors about required inputs, ensure all required inputs are provided when:
- Triggering manually: Fill in all required fields
- Using `include:inputs`: Provide all required inputs in the include block
- Using `trigger:inputs`: Provide all required inputs in the trigger block

### Input validation errors

- Check that `node-env` is one of: `development`, `staging`, `production`
- Check that `deployment-strategy` is one of: `rolling`, `canary`, `blue-green`
- Ensure numeric inputs (`health-check-timeout`, `deployment-timeout`) are valid numbers

### Default values not working

Default values only apply when:
- Triggering pipelines manually (if not overridden)
- Using `include:inputs` without specifying the input
- The input is truly optional (has a `default` specified)

For scheduled or automatic pipelines, ensure defaults are set for all inputs, or provide them via `include:inputs`.

