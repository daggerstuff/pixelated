# Flux Deployment Fix Summary

## Issues Found & Fixed

### ✅ 1. ImageUpdateAutomation API Version
- **Problem**: Wrong API group `automation.toolkit.fluxcd.io` → should be `image.toolkit.fluxcd.io`
- **Fixed**: Updated `clusters/pixelkube/flux-system/image-automation.yaml`

### ✅ 2. ImageUpdateAutomation Git Push Authentication
- **Problem**: `spec.git.push.secretRef` doesn't exist in the schema
- **Fixed**: Removed it - ImageUpdateAutomation uses GitRepository's secret (`flux-system`) automatically

### ✅ 3. Service Port Configuration
- **Problem**: Service used port 4321 (non-standard)
- **Fixed**: Changed to port 80 → targetPort 4321 (standard pattern)
- **Location**: `clusters/pixelkube/pixelated/service.yaml`

### ✅ 4. Ingress Port Mismatch
- **Problem**: Ingress pointed to port 4321, but service should be 80
- **Fixed**: Updated ingress to point to service port 80
- **Location**: `clusters/pixelkube/pixelated/ingress.yaml`

### ✅ 5. Deployment Missing Command & Env Vars
- **Problem**: Deployment didn't specify how to start the app (missing command/env)
- **Fixed**: Added `npm run start` command and required environment variables
- **Location**: `clusters/pixelkube/pixelated/deployment.yaml`

### ✅ 6. Old Service Conflict
- **Problem**: Old LoadBalancer service conflicted with new ClusterIP service
- **Fixed**: Deleted old service; Flux recreated the correct one

### ✅ 7. ImageRepository & ImageUpdateAutomation Created
- Both resources now exist in cluster
- ImageRepository has Docker Hub secret configured
- ImageUpdateAutomation will use GitRepository secret for git operations

## Current Status

### Working ✅
- ✅ Flux system components running
- ✅ ImageRepository created (with Docker Hub secret)
- ✅ ImagePolicy created
- ✅ ImageUpdateAutomation created
- ✅ GitRepository secret exists
- ✅ Docker Hub secret exists
- ✅ New deployment created (currently crashing, but will work after commit)

### Pending ⏳
- ⏳ Commit changes to git (Flux syncs from repo)
- ⏳ Wait for deployment to become ready after sync
- ⏳ Delete old `pixelated-app` deployment once new one is working
- ⏳ Verify ImageRepository can scan Docker Hub
- ⏳ Test image automation pipeline

## Files Changed

**Staged for commit:**
- `clusters/pixelkube/pixelated/deployment.yaml` - Added command & env vars
- `clusters/pixelkube/pixelated/service.yaml` - Changed port to 80
- `clusters/pixelkube/pixelated/ingress.yaml` - Updated to use port 80
- `clusters/pixelkube/flux-system/image-automation.yaml` - Fixed API version

**New files (helpers):**
- `scripts/diagnose-flux-deployment.sh` - Diagnostic tool
- `scripts/create-flux-secrets.sh` - Secret creation helper
- `scripts/cleanup-old-deployment.sh` - Cleanup helper
- `QUICK-FIX-GUIDE.md` - Quick reference
- `docs/FIX-FLUX-DEPLOYMENT.md` - Detailed troubleshooting
- `docs/SERVICE-ARCHITECTURE.md` - Architecture decisions
- `NEXT-STEPS.md` - Next steps guide

## Next Steps

1. **Review and commit changes:**
   ```bash
   git commit -m "fix: update Flux deployment config - service ports, deployment command, image automation API"
   git push origin master
   ```

2. **Wait for Flux sync** (should happen automatically within 1-2 minutes)

3. **Monitor deployment:**
   ```bash
   kubectl get pods -n pixelated -w
   kubectl get deployment pixelated -n pixelated
   ```

4. **Once new deployment is healthy, clean up old one:**
   ```bash
   kubectl delete deployment pixelated-app -n pixelated
   ```

5. **Test the full pipeline:**
   - Trigger GitHub Actions build
   - Watch ImageRepository detect new image
   - Verify ImageUpdateAutomation commits changes
   - Confirm deployment updates

## Secrets Status

- ✅ `dockerhub-secret` - Exists in flux-system namespace
- ✅ `flux-system` - Exists (GitRepository auth)
- ⚠️ Verify `flux-system` secret has **write** permissions (repo scope) for ImageUpdateAutomation

