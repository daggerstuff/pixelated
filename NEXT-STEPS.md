# Next Steps to Complete Flux Deployment Fix

## ✅ What's Fixed

1. **Service/Ingress Configuration** - Updated to use standard port 80 → container port 4321
2. **ImageUpdateAutomation API Version** - Fixed from `automation.toolkit.fluxcd.io` to `image.toolkit.fluxcd.io`
3. **ImageUpdateAutomation Created** - All three resources (ImageRepository, ImagePolicy, ImageUpdateAutomation) are now in cluster

## 🔧 What's Left

### 1. Create Docker Hub Secret (Required)

The ImageRepository needs Docker Hub authentication to scan for new images:

```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n flux-system
```

**Or use the interactive script:**
```bash
./scripts/create-flux-secrets.sh
```

### 2. Verify GitRepository Secret Has Write Access

ImageUpdateAutomation uses the GitRepository secret for pushing commits. Check:

```bash
kubectl get secret flux-system -n flux-system
```

The secret must have a GitHub Personal Access Token with **`repo`** scope (full repository access) to allow write operations.

If it doesn't have write access, update it:
```bash
kubectl delete secret flux-system -n flux-system
kubectl create secret generic flux-system \
  --from-literal=username=YOUR_GITHUB_USERNAME \
  --from-literal=password=YOUR_GITHUB_PAT_WITH_REPO_SCOPE \
  -n flux-system
```

### 3. Clean Up Old Deployment

The old `pixelated-app` deployment conflicts with the new `pixelated` deployment. You can either:

**Option A: Let Flux handle it** (when Kustomization succeeds, it will create the new one)
**Option B: Manual cleanup** (faster):
```bash
kubectl delete deployment pixelated-app -n pixelated
```

The service will be updated by Flux when the Kustomization applies successfully.

### 4. Fix Kustomization Error

Currently the Kustomization is failing with:
```
Service "pixelated-service" is invalid: spec.ports[1].name: Duplicate value: "http"
```

This suggests there might be a duplicate port definition somewhere, or the old service needs to be deleted. After cleaning up the old deployment, force a reconciliation:

```bash
kubectl annotate kustomization flux-system -n flux-system fluxcd.io/reconcile=true
```

## 🧪 Testing the Pipeline

Once secrets are in place:

1. **Trigger a GitHub Actions build** (manually or push a change)
2. **Watch ImageRepository** for new tags:
   ```bash
   kubectl get imagerepository pixelated-empathy -n flux-system -w
   ```
3. **Watch ImagePolicy** select the new image:
   ```bash
   kubectl get imagepolicy pixelated-empathy -n flux-system -w
   ```
4. **Watch ImageUpdateAutomation** commit changes:
   ```bash
   kubectl get imageupdateautomation pixelated-empathy -n flux-system -w
   ```
5. **Watch deployment update**:
   ```bash
   kubectl get deployment pixelated -n pixelated -w
   ```

## 📋 Quick Status Check

```bash
# Check all Flux resources
kubectl get gitrepository,kustomization,imagerepository,imagepolicy,imageupdateautomation -n flux-system

# Check for errors
kubectl describe kustomization flux-system -n flux-system | grep -A 10 "conditions:"
kubectl describe imagerepository pixelated-empathy -n flux-system
kubectl describe imageupdateautomation pixelated-empathy -n flux-system

# Check secrets exist
kubectl get secrets -n flux-system | grep -E "dockerhub-secret|flux-system"
```

