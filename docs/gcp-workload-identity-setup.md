<<<<<<< HEAD
# Google Cloud Workload Identity Federation Setup Guide
# ====================================================

## Overview

This guide explains how to set up Google Cloud Workload Identity Federation for GitHub Actions to authenticate to Google Cloud Platform (GCP) without using service account keys. This provides a more secure and manageable authentication mechanism.

## What is Workload Identity Federation?

Workload Identity Federation allows you to use external identity providers (like GitHub Actions) to authenticate to Google Cloud without needing to manage service account keys. Instead of using JSON key files, GitHub Actions can use OpenID Connect (OIDC) tokens to authenticate.

## Prerequisites

- Google Cloud Project with billing enabled
- Google Cloud SDK (gcloud CLI) installed
- Terraform >= 1.0 installed
- GitHub repository with Actions enabled
- Appropriate IAM permissions in your GCP project

## Architecture

```
GitHub Actions → OIDC Token → Workload Identity Provider → Service Account → GCP Resources
```

## Setup Steps

### 1. Enable Required APIs

The following Google Cloud APIs need to be enabled:
- `iam.googleapis.com`
- `iamcredentials.googleapis.com`
- `sts.googleapis.com`
- `container.googleapis.com`
- `compute.googleapis.com`
- `monitoring.googleapis.com`
- `logging.googleapis.com`

### 2. Deploy Infrastructure with Terraform

#### Option A: Automated Deployment Script

Use the provided deployment script:

```bash
cd terraform
chmod +x deploy-gcp-workload-identity.sh
./deploy-gcp-workload-identity.sh
```

#### Option B: Manual Terraform Deployment

```bash
cd terraform
terraform init
terraform plan -var-file=gcp-config.tfvars
terraform apply -var-file=gcp-config.tfvars
```

### 3. Configure GitHub Repository Secrets

After successful deployment, add these secrets to your GitHub repository:

| Secret Name | Value | Description |
|-------------|--------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_ID/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `github-actions-sa@PROJECT_ID.iam.gserviceaccount.com` | Service account email |
| `GCP_PROJECT_ID` | `your-project-id` | Google Cloud Project ID |

### 4. Update GitHub Actions Workflows

Use the correct authentication configuration in your workflows:
=======
# GCP Workload Identity Setup for GitHub Actions

## Overview

This document describes the correct configuration for using Google Cloud Workload Identity Federation with GitHub Actions to authenticate to GCP services without using long-lived service account keys.

## Why Use Workload Identity?

Workload Identity Federation allows GitHub Actions to impersonate a GCP service account using short-lived OIDC tokens issued by GitHub. This is more secure than using static service account keys because:

- No long-lived credentials are stored in GitHub Secrets
- Tokens are short-lived and automatically rotated
- Access is tied to the GitHub workflow context
- Follows the principle of least privilege

## Prerequisites

- A Google Cloud project with the necessary APIs enabled:
  - Cloud Resource Manager API
  - Identity and Access Management (IAM) API
- A GCP service account with the required permissions for your workflows
- GitHub repository with Actions enabled

## Step-by-Step Configuration

### 1. Create a Workload Identity Pool

In the Google Cloud Console, navigate to **IAM & Admin > Workload Identity Federation** and create a new pool:

- **Pool ID**: `github-pool`
- **Description**: `GitHub Actions Workload Identity Pool`

### 2. Create a Workload Identity Provider

Within the pool, create a new provider:

- **Provider ID**: `github-provider`
- **Provider type**: `OpenID Connect (OIDC)`
- **Issuer**: `https://token.actions.githubusercontent.com`
- **Allowed audience**: `https://github.com/pixelatedempathy/pixelated`

### 3. Configure Service Account Binding

Bind the Workload Identity Provider to a GCP service account:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  action@pixelatedempathy.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/751556915102/locations/global/workloadIdentityPools/github-pool/attribute.repository_owner/pixelatedempathy"
```

### 4. Set GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add the following secrets:

- **GCP_WORKLOAD_IDENTITY_PROVIDER**: `projects/751556915102/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- **GCP_SERVICE_ACCOUNT_EMAIL**: `action@pixelatedempathy.com`

> **Important**: Do NOT use `GCP_SERVICE_ACCOUNT_KEY` with Workload Identity. This legacy method is incompatible and should be removed from `.env` files.

### 5. Configure GitHub Actions Workflow

In your workflow YAML file (e.g., `.github/workflows/gke-monitoring.yml`), use the `google-github-actions/auth@v2` action:
>>>>>>> 335655f248127a872a947ec01aaa8011e6948ad0

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
<<<<<<< HEAD
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER || 'projects/751556915102/locations/global/workloadIdentityPools/github-pool/providers/github-provider' }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL || 'github-actions-sa@pixelated-463209-e5.iam.gserviceaccount.com' }}
    create_credentials_file: true
    export_environment_variables: true
```

## Configuration Details

### Workload Identity Pool

- **Pool ID**: `github-pool`
- **Display Name**: "GitHub Actions Workload Identity Pool"
- **Description**: Pool for GitHub Actions authentication

### Workload Identity Provider

- **Provider ID**: `github-provider`
- **Issuer URI**: `https://token.actions.githubusercontent.com`
- **Attribute Mapping**:
  - `google.subject` → `assertion.sub`
  - `attribute.actor` → `assertion.actor`
  - `attribute.repository` → `assertion.repository`
  - `attribute.ref` → `assertion.ref`

### Service Account

- **Account ID**: `github-actions-sa`
- **Display Name**: "GitHub Actions Service Account"
- **Email**: `github-actions-sa@PROJECT_ID.iam.gserviceaccount.com`

### IAM Roles

The service account is granted the following roles:

#### Built-in Roles
- `roles/container.developer` - GKE cluster development access
- `roles/container.viewer` - GKE cluster viewing access
- `roles/compute.viewer` - Compute resource viewing
- `roles/monitoring.viewer` - Monitoring data access
- `roles/logging.viewer` - Logging data access
- `roles/iam.serviceAccountTokenCreator` - Token creation for service account impersonation

#### Custom Role: GKE Monitoring Role
A custom role with minimal permissions for monitoring:
- `container.clusters.get` - Get cluster information
- `container.clusters.list` - List clusters
- `container.operations.get` - Get operations
- `container.operations.list` - List operations
- `container.pods.get` - Get pod information
- `container.pods.list` - List pods
- `container.deployments.get` - Get deployment information
- `container.deployments.list` - List deployments
- `container.services.get` - Get service information
- `container.services.list` - List services
- `container.namespaces.get` - Get namespace information
- `container.namespaces.list` - List namespaces
- `monitoring.metricDescriptors.get` - Get metric descriptors
- `monitoring.metricDescriptors.list` - List metric descriptors
- `monitoring.timeSeries.list` - List time series data
- `logging.logEntries.list` - List log entries
- `logging.logs.list` - List logs
- `resourcemanager.projects.get` - Get project information
=======
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}
    universe: googleapis.com
    cleanup_credentials: true
    access_token_lifetime: 3600s
    access_token_scopes: https://www.googleapis.com/auth/cloud-platform
    id_token_include_email: false
```

## Verification

To verify the configuration is working:

1. Trigger the workflow manually
2. Check the logs for the "Authenticate to Google Cloud" step
3. Look for successful token generation and credential creation
4. Confirm subsequent `gcloud` and `kubectl` commands execute without authentication errors
>>>>>>> 335655f248127a872a947ec01aaa8011e6948ad0

## Troubleshooting

### Common Issues

<<<<<<< HEAD
#### 1. Authentication Failed: "invalid_target"

**Error**: `{"error":"invalid_target","error_description":"The target service indicated by the \"audience\" parameters is invalid."}`

**Solution**: 
- Verify the `workload_identity_provider` value matches exactly
- Check that the workload identity pool and provider exist
- Ensure the provider is not disabled

#### 2. Permission Denied

**Error**: `Permission denied on resource`

**Solution**:
- Verify the service account has the necessary IAM roles
- Check that the workload identity user binding is correct
- Ensure the repository name in the binding matches exactly

#### 3. Provider Not Found

**Error**: `Provider not found`

**Solution**:
- Verify the provider resource name format
- Check that the provider exists in the specified project
- Ensure the project ID is correct

### Verification Steps

1. **Check Workload Identity Pool Status**:
   ```bash
   gcloud iam workload-identity-pools describe github-pool \
     --location=global \
     --project=YOUR_PROJECT_ID
   ```

2. **Check Provider Status**:
   ```bash
   gcloud iam workload-identity-pools providers describe github-provider \
     --workload-identity-pool=github-pool \
     --location=global \
     --project=YOUR_PROJECT_ID
   ```

3. **Check Service Account**:
   ```bash
   gcloud iam service-accounts describe \
     github-actions-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
     --project=YOUR_PROJECT_ID
   ```

4. **Test Authentication**:
   ```bash
   # Get the access token
   gcloud auth application-default print-access-token
   ```

## Security Considerations

### Best Practices

1. **Principle of Least Privilege**: Grant only the minimum permissions required
2. **Repository Restrictions**: Use attribute conditions to restrict access to specific repositories
3. **Regular Auditing**: Regularly review and audit IAM permissions
4. **Monitoring**: Enable logging and monitoring for authentication events

### Attribute Conditions

You can add attribute conditions to further restrict access:

```hcl
attribute_condition = "assertion.repository=='pixelatedempathy/pixelated'"
```

### Audit Logging

Enable audit logging to track authentication events:

```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

## Migration from Service Account Keys

If you're currently using service account JSON keys, follow these steps to migrate:

1. Deploy the Workload Identity Federation infrastructure
2. Update GitHub Actions workflows to use the new authentication method
3. Test the new authentication thoroughly
4. Remove old service account keys
5. Update any documentation or runbooks

## Cost Considerations

- Workload Identity Federation itself is free
- Associated IAM operations may incur minimal costs
- Service account usage follows standard GCP pricing

## Support and Resources

### Documentation
- [Google Cloud Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-cloud-providers)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest)

### Community
- Google Cloud Community
- GitHub Community
- Terraform Community

## Conclusion

Workload Identity Federation provides a secure, keyless authentication mechanism for GitHub Actions to access Google Cloud resources. This setup eliminates the need to manage service account keys while maintaining security through fine-grained IAM permissions and attribute-based access control.

Regular monitoring and auditing of the configuration ensures continued security and compliance with your organization's policies.
=======
- **"invalid_target" error**: The `workload_identity_provider` value is incorrect. Verify it matches the full resource name format: `projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL_ID}/providers/{PROVIDER_ID}`
- **"Permission denied" error**: The service account lacks the `roles/iam.workloadIdentityUser` role on the Workload Identity Provider
- **"Service account not found"**: The `service_account` email is incorrect or the service account doesn't exist

### Debugging Steps

1. Verify the Workload Identity Provider exists in the Google Cloud Console
2. Confirm the service account email is correct and exists
3. Check the IAM policy binding on the service account
4. Ensure the GitHub repository owner matches the policy binding

## Best Practices

- Use separate service accounts for different workflows (e.g., one for deployment, one for monitoring)
- Limit service account permissions to the minimum required
- Regularly review and rotate service accounts
- Remove any legacy `GCP_SERVICE_ACCOUNT_KEY` entries from `.env` files
- Use the `cleanup_credentials: true` option to automatically clean up temporary credentials

## References

- [Google Cloud Workload Identity Federation Documentation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [google-github-actions/auth GitHub Repository](https://github.com/google-github-actions/auth)
>>>>>>> 335655f248127a872a947ec01aaa8011e6948ad0
