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

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
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

## Troubleshooting

### Common Issues

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