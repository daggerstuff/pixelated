# Fixing Flux Deployment Issues on Civo

## Problem Summary
Nothing is triggering builds - neither GitHub Actions, Flux image automation, nor manual pushes are updating the cluster.

## Root Cause Analysis

### Issue 1: ImageRepository Missing Authentication
The `ImageRepository` for `docker.io/pixelatedempathy/pixelated-empathy` doesn't have authentication configured. Even if your repo is public, Docker Hub rate limits can block unauthenticated requests.

**Location**: `clusters/pixelkube/flux-system/image-automation.yaml`

### Issue 2: ImageUpdateAutomation Needs GitHub Write Access
The `ImageUpdateAutomation` needs write access to commit back to the repository, but no authentication is configured.

**Location**: `clusters/pixelkube/flux-system/image-automation.yaml` line 33-48

### Issue 3: GitRepository Secret May Be Missing/Expired
The `GitRepository` references `secretRef: flux-system` but this secret might not exist or have expired credentials.

**Location**: `clusters/pixelkube/flux-system/gotk-sync.yaml` line 12-13

### Issue 4: GitHub Actions May Not Be Triggering
The workflow might not be running if:
- Docker Hub credentials are missing in GitHub Secrets
- Workflow is failing silently

**Location**: `.github/workflows/docker-hub-build.yml`

## Fix Steps

### Step 1: Create Docker Hub Secret for ImageRepository

```bash
# Create secret for Docker Hub authentication
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n flux-system
```

Then update `image-automation.yaml` to reference it:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: pixelated-empathy
  namespace: flux-system
spec:
  image: docker.io/pixelatedempathy/pixelated-empathy
  interval: 1m0s
  secretRef:  # ADD THIS
    name: dockerhub-secret  # ADD THIS
```

### Step 2: Create/Update GitHub Token Secret for ImageUpdateAutomation

```bash
# Create GitHub personal access token with 'repo' scope
# Then create the secret with both username and password:
kubectl create secret generic github-token \
  --from-literal=username=YOUR_GITHUB_USERNAME \
  --from-literal=password=YOUR_GITHUB_PAT \
  -n flux-system
```

Update `image-automation.yaml` to use it:

```yaml
apiVersion: automation.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: pixelated-empathy
  namespace: flux-system
spec:
  interval: 1m0s
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: master
    commit:
      author:
        name: fluxcdbot
        email: fluxcdbot@users.noreply.github.com
      messageTemplate: |
        chore(image-automation): update pixelated-empathy to {{range .Updated.Images}}{{.NewTag}}{{end}}
    push:
      branch: master
      # ADD THIS SECTION
      secretRef:
        name: github-token
  update:
    path: ./clusters/pixelkube/pixelated
    strategy: Setters
```

### Step 3: Verify GitRepository Secret

```bash
# Check if secret exists
kubectl get secret flux-system -n flux-system

# If missing, create it:
kubectl create secret generic flux-system \
  --from-literal=username=YOUR_GITHUB_USERNAME \
  --from-literal=password=YOUR_GITHUB_PAT \
  -n flux-system
```

### Step 4: Check GitHub Actions Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions and verify:
- `DOCKERHUB_USERNAME` exists
- `DOCKERHUB_TOKEN` exists (or `DOCKER_USER` and `DOCKER_PAT`)

### Step 5: Manual Trigger Test

After fixing secrets, manually trigger:

1. **GitHub Actions**: Go to Actions tab → "Build and Push to Docker Hub" → Run workflow
2. **Check ImageRepository status**: `kubectl describe imagerepository pixelated-empathy -n flux-system`
3. **Check ImagePolicy status**: `kubectl describe imagepolicy pixelated-empathy -n flux-system`
4. **Check ImageUpdateAutomation status**: `kubectl describe imageupdateautomation pixelated-empathy -n flux-system`

## Quick Diagnostic Commands

Run the diagnostic script:
```bash
./scripts/diagnose-flux-deployment.sh
```

Or run manually:
```bash
# Check all Flux resources status
kubectl get gitrepository,kustomization,imagerepository,imagepolicy,imageupdateautomation -n flux-system

# Check for errors
kubectl describe imagerepository pixelated-empathy -n flux-system
kubectl describe imagepolicy pixelated-empathy -n flux-system
kubectl describe imageupdateautomation pixelated-empathy -n flux-system

# Check Flux pods
kubectl get pods -n flux-system

# Check logs
kubectl logs -n flux-system -l app=image-reflector-controller --tail=100
kubectl logs -n flux-system -l app=image-automation-controller --tail=100
```

## Common Error Messages and Fixes

### "authentication required" or "401 Unauthorized"
- Docker Hub secret missing or incorrect
- Fix: Create `dockerhub-secret` as shown in Step 1

### "failed to clone repository" or "authentication failed"
- GitRepository secret missing or expired
- Fix: Create/update `flux-system` secret as shown in Step 3

### "failed to push commit"
- ImageUpdateAutomation can't push to GitHub
- Fix: Add GitHub token secret as shown in Step 2

### ImageRepository shows "no tags found"
- Docker Hub authentication issue OR no images with matching tag pattern
- Fix: Check authentication and verify tags exist: `docker pull pixelatedempathy/pixelated-empathy:build-*`

## Verification Checklist

- [ ] Docker Hub secret created and ImageRepository updated
- [ ] GitHub token secret created and ImageUpdateAutomation updated
- [ ] GitRepository secret exists and is valid
- [ ] GitHub Actions secrets configured
- [ ] All Flux components running (no Suspended=true)
- [ ] ImageRepository can see new images
- [ ] ImagePolicy selects correct tag
- [ ] ImageUpdateAutomation commits changes
- [ ] Deployment updates with new image

