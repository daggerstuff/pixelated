# How to Update Kubernetes Deployment with New Docker Image

## Step 1: Check GitLab Build Status

1. Go to your GitLab project: https://gitlab.com/pixeljump/pixelated
2. Navigate to **CI/CD → Pipelines**
3. Find the latest pipeline (should show your recent commit)
4. Click on it to see job status
5. Look for the `build:acr` job - it should show "passed" (green checkmark) when complete

## Step 2: Get the Image Tag

The image will be tagged with your commit SHA. From the previous commits:
- Latest commit: `fa003b32`
- Image will be: `pixelatedregistry.azurecr.io/pixelatedempathy:fa003b32`
- Or use `latest`: `pixelatedregistry.azurecr.io/pixelatedempathy:latest`

## Step 3: Update Kubernetes Deployment

### Option A: Update to Latest Tag (Recommended)

```bash
# Set kubeconfig
export KUBECONFIG=./terraform/kubeconfig-staging.config

# Update deployment to use latest image
kubectl set image deployment/pixelated \
  pixelated=pixelatedregistry.azurecr.io/pixelatedempathy:latest \
  -n pixelated

# Watch the rollout
kubectl rollout status deployment/pixelated -n pixelated
```

### Option B: Update to Specific Commit SHA

```bash
# Set kubeconfig
export KUBECONFIG=./terraform/kubeconfig-staging.config

# Replace COMMIT_SHA with your actual commit (e.g., fa003b32)
kubectl set image deployment/pixelated \
  pixelated=pixelatedregistry.azurecr.io/pixelatedempathy:fa003b32 \
  -n pixelated

# Watch the rollout
kubectl rollout status deployment/pixelated -n pixelated
```

### Option C: Edit Deployment Manually

```bash
# Set kubeconfig
export KUBECONFIG=./terraform/kubeconfig-staging.config

# Edit the deployment
kubectl edit deployment pixelated -n pixelated

# Find the image line and update it:
# image: pixelatedregistry.azurecr.io/pixelatedempathy:latest
# Save and exit (the deployment will automatically update)
```

## Step 4: Verify the Update

```bash
# Check pod status
kubectl get pods -n pixelated

# Check deployment status
kubectl get deployment pixelated -n pixelated

# View pod logs
kubectl logs -f deployment/pixelated -n pixelated

# Describe deployment to see current image
kubectl describe deployment pixelated -n pixelated | grep Image
```

## Step 5: Test the Application

Once pods are running, test the application:

```bash
# Check if the app is responding
curl -I https://pixelatedempathy.com/

# Or check via kubectl port-forward
kubectl port-forward deployment/pixelated 4322:4322 -n pixelated
# Then visit http://localhost:4322 in your browser
```

## Troubleshooting

### If pods fail to start:

```bash
# Check pod events
kubectl describe pod -l app=pixelated-app -n pixelated

# Check logs
kubectl logs -l app=pixelated-app -n pixelated --tail=50

# Check if image pull is failing
kubectl get events -n pixelated --sort-by='.lastTimestamp' | grep pixelated
```

### If image pull fails:

```bash
# Verify ACR secret exists
kubectl get secret acr-secret -n pixelated

# If missing, recreate it:
az acr credential show --name pixelatedregistry --query username --output tsv
az acr credential show --name pixelatedregistry --query passwords[0].value --output tsv

kubectl create secret docker-registry acr-secret \
  --namespace pixelated \
  --docker-server=pixelatedregistry.azurecr.io \
  --docker-username=<ACR_USERNAME> \
  --docker-password=<ACR_PASSWORD>
```

### Rollback if needed:

```bash
# View rollout history
kubectl rollout history deployment/pixelated -n pixelated

# Rollback to previous version
kubectl rollout undo deployment/pixelated -n pixelated

# Or rollback to specific revision
kubectl rollout undo deployment/pixelated -n pixelated --to-revision=2
```
