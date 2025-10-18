# GitHub Actions Setup Guide for GKE Deployment

This guide explains how to set up the required secrets for the converted GitHub Actions workflows.

## GCP Service Account Key Setup

You already have the service account key! The JSON you provided contains the complete service account credentials. Here's how to set it up:

### Step 1: Add GCP Service Account Key to GitHub Secrets

1. Go to your GitHub repository settings
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Add these secrets:

#### Required GCP Secrets:
```bash
# Copy the entire JSON from your service account key
GCP_SERVICE_ACCOUNT_KEY={"key_algorithm":"KEY_ALG_RSA_2048",...}
GCP_PROJECT_ID=pixelated-463209-e5
GKE_CLUSTER_NAME=pixelcluster
GKE_ZONE=us-east1
GKE_NAMESPACE=pixelated
GKE_DEPLOYMENT_NAME=pixelated
GKE_SERVICE_NAME=pixelated-service
```

#### Optional GCP Configuration:
```bash
# You can customize these or use defaults
GKE_REPLICAS=3
GKE_MAX_SURGE=1
GKE_MAX_UNAVAILABLE=0
CANARY_PERCENTAGE=25
AUTO_ROLLBACK=true
HEALTH_CHECK_TIMEOUT=300
KEEP_IMAGES=3
CLEANUP_OLDER_THAN=12h
```

### Step 2: GKE Environment URL
```bash
# Add your application URL
GKE_ENVIRONMENT_URL=http://35.243.226.27
```

### Step 3: Sentry Integration (Optional)
```bash
# If you use Sentry for error tracking
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project
SENTRY_DSN=your_sentry_dsn
PUBLIC_SENTRY_DSN=your_public_sentry_dsn
```

### Step 4: Slack Notifications (Optional)
```bash
# For deployment notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

## Service Account Permissions

Your service account needs these IAM roles:
- **Kubernetes Engine Admin** (`roles/container.admin`)
- **Container Registry Admin** (`roles/containerregistry.admin`)
- **Service Account User** (`roles/iam.serviceAccountUser`)

## Quick Setup Commands

```bash
# Set up secrets using GitHub CLI (if installed)
gh secret set GCP_SERVICE_ACCOUNT_KEY < your-service-account-key.json
gh secret set GCP_PROJECT_ID -b"pixelated-463209-e5"
gh secret set GKE_CLUSTER_NAME -b"pixelcluster"
gh secret set GKE_ZONE -b"us-east1"
gh secret set GKE_NAMESPACE -b"pixelated"
gh secret set GKE_ENVIRONMENT_URL -b"http://35.243.226.27"
```

## Verification Steps

After setting up secrets, verify your setup:

### 1. Test GCP Authentication
```bash
# Run a manual workflow to test GCP connection
gh workflow run gke-monitoring.yml -f check_type=basic -f environment=production
```

### 2. Test Deployment
```bash
# Test staging deployment
gh workflow run gke-deploy.yml -f deployment_strategy=rolling -f environment=staging
```

### 3. Test Monitoring
```bash
# Run comprehensive monitoring check
gh workflow run gke-monitoring.yml -f check_type=comprehensive -f environment=production
```

## Troubleshooting

### Common Issues:

1. **"Permission denied" errors**
   - Verify service account has required IAM roles
   - Check if GKE cluster exists and is accessible
   - Ensure correct project ID and zone

2. **"Cluster not found" errors**
   - Verify `GKE_CLUSTER_NAME` and `GKE_ZONE` are correct
   - Check if cluster is running in GCP console

3. **"Namespace not found" errors**
   - The workflows will create namespaces automatically
   - Verify `GKE_NAMESPACE` secret is set

4. **Container registry issues**
   - Ensure GitHub Container Registry is enabled
   - Verify `GITHUB_TOKEN` has proper permissions

## Security Best Practices

1. **Never commit service account keys** to your repository
2. **Use GitHub Secrets** for all sensitive information
3. **Rotate service account keys** regularly
4. **Use least privilege** IAM roles
5. **Enable audit logging** in your GKE cluster

## Next Steps

1. **Set up all required secrets** using the guide above
2. **Test the workflows** with staging environment first
3. **Monitor initial deployments** closely
4. **Configure Slack notifications** for team awareness
5. **Set up monitoring dashboards** for ongoing visibility

## Support

If you encounter issues:
1. Check the workflow logs in GitHub Actions
2. Verify all secrets are correctly configured
3. Review the troubleshooting section above
4. Create an issue in the repository with error details