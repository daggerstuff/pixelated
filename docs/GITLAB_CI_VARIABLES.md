# GitLab CI/CD Variables - Complete Setup Guide

## How to Set Variables

1. Go to your GitLab project: **Settings > CI/CD > Variables**
2. Click **"Expand"** next to Variables
3. Click **"Add variable"** for each variable below
4. Set the appropriate flags (Protected, Masked, etc.)

---

## 🔴 REQUIRED Variables (Pipeline will fail without these)

### Terraform Variables

| Variable | Value | Protected | Masked | Description |
|----------|-------|-----------|--------|-------------|
| `TF_HTTP_PASSWORD` | `glpat-xxxxxxxxx` | ✅ Yes | ✅ Yes | GitLab Personal Access Token for Terraform state backend. Create at: GitLab → Settings → Access Tokens → Personal Access Tokens (with `api` scope) |
| `AZURE_SUBSCRIPTION_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | ✅ Yes | ❌ No | Azure subscription ID |
| `AZURE_TENANT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | ✅ Yes | ❌ No | Azure tenant ID |

**To get Azure IDs:**
```bash
az account show --query "{subscriptionId:id, tenantId:tenantId}" -o table
```

### Azure Container Registry (ACR) Variables

| Variable | Value | Protected | Masked | Description |
|----------|-------|-----------|--------|-------------|
| `ACR_NAME` | `pixelatedregistry` | ✅ Yes | ❌ No | Azure Container Registry name (without .azurecr.io) |
| `ACR_USERNAME` | `pixelatedregistry` | ✅ Yes | ❌ No | ACR admin username |
| `ACR_PASSWORD` | `[password]` | ✅ Yes | ✅ Yes | ACR admin password |

**To get ACR credentials:**
```bash
# Check if admin is enabled
az acr show --name pixelatedregistry --query adminUserEnabled

# Get username
az acr credential show --name pixelatedregistry --query username --output tsv

# Get password
az acr credential show --name pixelatedregistry --query passwords[0].value --output tsv
```

**Note:** If ACR admin is disabled, you'll need to use a service principal instead.

---

## 🟡 OPTIONAL Variables (Have defaults or only needed for specific jobs)

### Terraform Configuration

| Variable | Value | Protected | Masked | Description |
|----------|-------|-----------|--------|-------------|
| `TERRAFORM_VERSION` | `1.9.0` | ❌ No | ❌ No | Terraform version (default: 1.9.0) |
| `TF_ENVIRONMENT` | `staging` | ❌ No | ❌ No | Terraform environment (default: staging) |

### GitLab Container Registry (Auto-provided, but listed for reference)

| Variable | Value | Protected | Masked | Description |
|----------|-------|-----------|--------|-------------|
| `CI_REGISTRY_USER` | Auto | N/A | N/A | Auto-provided by GitLab |
| `CI_REGISTRY_PASSWORD` | Auto | N/A | N/A | Auto-provided by GitLab |
| `CI_REGISTRY` | Auto | N/A | N/A | Auto-provided by GitLab |
| `CI_REGISTRY_IMAGE` | Auto | N/A | N/A | Auto-provided by GitLab |

**Note:** These are automatically provided by GitLab. You don't need to set them manually, but if the `build` job fails, you may need to enable the Container Registry in your project settings.

---

## 🟢 DISABLED Variables (Not currently used, but documented for future)

These are referenced in commented-out jobs (GKE deployment):

| Variable | Value | Protected | Masked | Description |
|----------|-------|-----------|--------|-------------|
| `GCP_PROJECT_ID` | `your-project-id` | ✅ Yes | ❌ No | Google Cloud Project ID (for GKE) |
| `GKE_CLUSTER_NAME` | `your-cluster-name` | ✅ Yes | ❌ No | GKE cluster name |
| `GKE_ZONE` | `us-central1-a` | ✅ Yes | ❌ No | GKE cluster zone |
| `GCP_SERVICE_ACCOUNT_KEY` | `{...}` | ✅ Yes | ✅ Yes | GCP service account JSON key (for GKE) |

**Note:** These are only needed if you re-enable the GKE deployment jobs.

---

## Quick Setup Checklist

### Minimum Required (for current pipeline to work):

- [ ] `TF_HTTP_PASSWORD` - GitLab token for Terraform state
- [ ] `AZURE_SUBSCRIPTION_ID` - Azure subscription ID
- [ ] `AZURE_TENANT_ID` - Azure tenant ID
- [ ] `ACR_NAME` - ACR registry name
- [ ] `ACR_USERNAME` - ACR username
- [ ] `ACR_PASSWORD` - ACR password

### Optional (recommended):

- [ ] `TERRAFORM_VERSION` - If you want a specific Terraform version
- [ ] `TF_ENVIRONMENT` - If you want to specify environment

---

## How to Create GitLab Personal Access Token (for TF_HTTP_PASSWORD)

1. Go to GitLab → **Settings → Access Tokens** (or https://gitlab.com/-/user_settings/personal_access_tokens)
2. Click **"Add new token"**
3. Name: `terraform-state-backend`
4. Expiration: Set as needed (or leave blank for no expiration)
5. Scopes: Check **`api`** (required for Terraform state backend)
6. Click **"Create personal access token"**
7. **Copy the token immediately** (you won't see it again)
8. Use this token as the value for `TF_HTTP_PASSWORD`

---

## Verification

After setting variables, you can verify by:

1. **Check pipeline runs**: Go to **CI/CD → Pipelines** and trigger a new pipeline
2. **Check job logs**: Look for any "variable not set" errors
3. **Test specific jobs**: The `terraform:plan` job will fail if `TF_HTTP_PASSWORD` is missing
4. **Test ACR build**: The `build:acr` job will fail if ACR variables are missing

---

## Troubleshooting

### "TF_HTTP_PASSWORD not set" error
- Ensure the variable is set in **Settings > CI/CD > Variables**
- Check that it's marked as **Protected** if your branch is protected
- Verify the token has `api` scope

### "ACR variables not set" error
- Ensure all three ACR variables are set: `ACR_NAME`, `ACR_USERNAME`, `ACR_PASSWORD`
- Verify ACR admin is enabled: `az acr show --name pixelatedregistry --query adminUserEnabled`
- If admin is disabled, you'll need to use a service principal instead

### "CI_REGISTRY variables not set" error
- This usually means Container Registry is disabled for your project
- Enable it at: **Settings > General > Visibility, project features, permissions > Container Registry**

---

## Security Best Practices

1. **Always mark sensitive variables as "Masked"** - This prevents them from appearing in logs
2. **Mark production variables as "Protected"** - This limits them to protected branches only
3. **Use separate tokens for different purposes** - Don't reuse the same token everywhere
4. **Rotate tokens regularly** - Especially if they're exposed or compromised
5. **Use environment-specific variables** - Use different values for staging vs production if needed

---

## Related Documentation

- [ACR Build Setup](./ACR_BUILD_SETUP.md) - Detailed ACR build configuration
- [Update Deployment](./UPDATE_DEPLOYMENT.md) - How to update Kubernetes after build
- [Terraform GitLab Integration](../guides/technical-guides/deployment/terraform-gitlab-integration.md) - Terraform state backend setup
