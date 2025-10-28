# GCR Migration Guide - Pixelated Empathy

## Overview
This guide documents the complete migration from GitLab Container Registry to Google Container Registry (GCR) for the Pixelated Empathy application.

## Current State
- **Previous Registry**: `registry.gitlab.com/pixeldeck/pixelated`
- **New Registry**: `gcr.io/pixelated-463209-e5/pixelated-empathy`
- **Migration Status**: ✅ Complete

## Changes Made

### 1. Kubernetes Deployment Updates
- **File**: `k8s/deployment.yaml`
- **Changes**:
  - Updated image from GitLab registry to GCR
  - Changed image pull secret from `regcred` to `gcr-secret`
  - Updated image reference to use `latest` tag from GCR

### 2. CI/CD Pipeline Updates
- **File**: `.gitlab-ci.yml`
- **Changes**:
  - Updated container registry variables to use GCR
  - Modified Docker authentication to use GCR service account
  - Updated all registry references from GitLab to GCR

### 3. New Configuration Files
- **File**: `k8s/gcr-secret.yaml`
  - Template for GCR authentication secret
- **File**: `scripts/migrate-to-gcr.sh`
  - Automated migration script

## Prerequisites

### Required Tools
- Google Cloud SDK (`gcloud`)
- Docker
- kubectl
- Base64 encoding tools

### Required Permissions
- GCR access permissions
- Kubernetes cluster access
- Service account with appropriate roles

## Setup Instructions

### 1. Configure GCP Authentication
```bash
# Authenticate with GCP
gcloud auth login

# Set project
gcloud config set project pixelated-463209-e5

# Configure Docker for GCR
gcloud auth configure-docker
```

### 2. Create Service Account (if needed)
```bash
# Create service account
gcloud iam service-accounts create gcr-access \
    --display-name="GCR Access Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding pixelated-463209-e5 \
    --member="serviceAccount:gcr-access@pixelated-463209-e5.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Create key
gcloud iam service-accounts keys create gcr-key.json \
    --iam-account=gcr-access@pixelated-463209-e5.iam.gserviceaccount.com
```

### 3. Set Environment Variables
```bash
export GCP_PROJECT_ID="pixelated-463209-e5"
export GCP_SERVICE_ACCOUNT_KEY=$(base64 -w 0 gcr-key.json)
```

### 4. Run Migration Script
```bash
chmod +x scripts/migrate-to-gcr.sh
./scripts/migrate-to-gcr.sh
```

## Manual Migration Steps

### Step 1: Build and Push Image to GCR
```bash
# Build image
docker build -t gcr.io/pixelated-463209-e5/pixelated-empathy:latest .

# Push to GCR
docker push gcr.io/pixelated-463209-e5/pixelated-empathy:latest
```

### Step 2: Create GCR Secret in Kubernetes
```bash
# Create secret
kubectl create secret docker-registry gcr-secret \
    --docker-server=gcr.io \
    --docker-username=_json_key \
    --docker-password="$(cat gcr-key.json)" \
    --docker-email=any@valid.email \
    --namespace=pixelated
```

### Step 3: Update Deployment
```bash
# Update deployment image
kubectl set image deployment/pixelated \
    pixelated=gcr.io/pixelated-463209-e5/pixelated-empathy:latest \
    --namespace=pixelated

# Update image pull secret
kubectl patch deployment pixelated \
    --namespace=pixelated \
    --patch='{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"gcr-secret"}]}}}}'
```

### Step 4: Verify Deployment
```bash
# Check rollout status
kubectl rollout status deployment/pixelated --namespace=pixelated

# Check pods
kubectl get pods -n pixelated -l app=pixelated
```

## Environment Variables for CI/CD

### Required Variables in GitLab CI
- `GCP_PROJECT_ID`: "pixelated-463209-e5"
- `GCP_SERVICE_ACCOUNT_KEY`: Base64-encoded service account key
- `GCP_SERVICE_ACCOUNT_KEY_B64`: Alternative base64-encoded key

### Updated Registry Variables
- `CONTAINER_IMAGE`: `gcr.io/${GCP_PROJECT_ID}/pixelated-empathy:${CI_COMMIT_SHA}`
- `CONTAINER_IMAGE_LATEST`: `gcr.io/${GCP_PROJECT_ID}/pixelated-empathy:latest`
- `CONTAINER_IMAGE_CACHE`: `gcr.io/${GCP_PROJECT_ID}/pixelated-empathy:cache`

## Verification Checklist

### ✅ Image Registry
- [ ] Image successfully pushed to GCR
- [ ] Image accessible from Kubernetes cluster
- [ ] No authentication issues

### ✅ Kubernetes Deployment
- [ ] Deployment updated with GCR image
- [ ] GCR secret created and configured
- [ ] Pods running successfully
- [ ] No image pull errors

### ✅ CI/CD Pipeline
- [ ] GitLab CI builds pushing to GCR
- [ ] Security scans working with GCR
- [ ] Deployment scripts updated
- [ ] Cleanup jobs updated

### ✅ Monitoring
- [ ] Application health checks passing
- [ ] Performance metrics normal
- [ ] No increased error rates

## Troubleshooting

### Common Issues

#### Image Pull Errors
```bash
# Check secret
kubectl describe secret gcr-secret -n pixelated

# Check pod events
kubectl describe pod <pod-name> -n pixelated

# Verify image exists
docker pull gcr.io/pixelated-463209-e5/pixelated-empathy:latest
```

#### Authentication Issues
```bash
# Re-authenticate with GCP
gcloud auth login
gcloud auth configure-docker

# Verify service account permissions
gcloud projects get-iam-policy pixelated-463209-e5 \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:gcr-access@pixelated-463209-e5.iam.gserviceaccount.com"
```

#### Build Issues
```bash
# Check CI/CD variables
echo $GCP_PROJECT_ID
echo $GCP_SERVICE_ACCOUNT_KEY | base64 -d | jq .

# Test Docker login
echo "$GCP_SERVICE_ACCOUNT_KEY" | base64 -d | docker login -u _json_key --password-stdin https://gcr.io
```

## Rollback Plan

### Quick Rollback
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/pixelated --namespace=pixelated

# Check status
kubectl rollout status deployment/pixelated --namespace=pixelated
```

### Full Rollback
```bash
# Revert to GitLab registry
kubectl set image deployment/pixelated \
    pixelated=registry.gitlab.com/pixeldeck/pixelated@sha256:1691c565a3f08071ff8a0ad27af889ec4964d23fc035b2f30d2ae8ce9ec8b0e6 \
    --namespace=pixelated

# Update image pull secret
kubectl patch deployment pixelated \
    --namespace=pixelated \
    --patch='{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
```

## Security Considerations

### Service Account Permissions
- Minimum required: `roles/storage.admin` for GCR
- Consider using `roles/storage.objectViewer` for read-only access

### Secret Management
- Store service account keys securely
- Rotate keys regularly
- Use GitLab CI/CD variables for sensitive data

### Network Security
- Ensure GCR is accessible from Kubernetes cluster
- Consider VPC Service Controls for additional security

## Performance Impact

### Registry Performance
- GCR typically provides better performance within GCP
- Reduced latency for image pulls
- Better integration with GCP services

### Cost Considerations
- GCR pricing based on storage and egress
- Compare with GitLab registry costs
- Monitor usage and optimize accordingly

## Next Steps

1. **Monitor**: Watch application performance and error rates
2. **Cleanup**: Remove old GitLab registry images after verification
3. **Optimization**: Implement image caching strategies
4. **Documentation**: Update team documentation and runbooks

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Kubernetes events: `kubectl get events -n pixelated`
- Check application logs: `kubectl logs -n pixelated -l app=pixelated`
- Contact the DevOps team for infrastructure issues