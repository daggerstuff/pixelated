# Quick Fix Guide - Flux Deployment Not Updating

## The Problem
Nothing is triggering builds - GitHub Actions, Flux, Docker Hub builds aren't working.

## The Solution (5 Minutes)

### Step 1: Create Required Secrets

Run the interactive script:
```bash
./scripts/create-flux-secrets.sh
```

Or create manually:

**1. Docker Hub Secret** (for ImageRepository to scan Docker Hub):
```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n flux-system
```

**2. GitHub Token Secret** (for ImageUpdateAutomation to push commits):
```bash
kubectl create secret generic github-token \
  --from-literal=username=YOUR_GITHUB_USERNAME \
  --from-literal=password=YOUR_GITHUB_PAT \
  -n flux-system
```

**3. GitRepository Secret** (for Flux to read your repo):
```bash
kubectl create secret generic flux-system \
  --from-literal=username=YOUR_GITHUB_USERNAME \
  --from-literal=password=YOUR_GITHUB_PAT \
  -n flux-system
```

### Step 2: Verify Configuration Updated

The `image-automation.yaml` has already been updated to reference these secrets. Verify:
```bash
kubectl get imagerepository pixelated-empathy -n flux-system -o yaml | grep -A 5 secretRef
kubectl get imageupdateautomation pixelated-empathy -n flux-system -o yaml | grep -A 5 secretRef
```

### Step 3: Apply Updated Configuration

If you made the changes locally, commit and push:
```bash
git add clusters/pixelkube/flux-system/image-automation.yaml
git commit -m "fix: add authentication secrets for Flux image automation"
git push origin master
```

Flux will sync automatically, or force reconciliation:
```bash
kubectl annotate gitrepository flux-system -n flux-system fluxcd.io/reconcile=true
```

### Step 4: Test the Pipeline

**Option A: Trigger GitHub Actions manually**
- Go to GitHub → Actions → "Build and Push to Docker Hub" → Run workflow

**Option B: Push a small change**
```bash
echo "# test" >> README.md
git add README.md
git commit -m "test: trigger build"
git push origin master
```

### Step 5: Monitor Status

Watch Flux detect the new image:
```bash
# Watch ImageRepository
kubectl get imagerepository pixelated-empathy -n flux-system -w

# Watch ImagePolicy
kubectl get imagepolicy pixelated-empathy -n flux-system -w

# Watch ImageUpdateAutomation
kubectl get imageupdateautomation pixelated-empathy -n flux-system -w

# Check deployment
kubectl get deployment pixelated -n pixelated -w
```

### Step 6: Check Logs if Issues Persist

```bash
# Image reflector (scans Docker Hub)
kubectl logs -n flux-system -l app=image-reflector-controller --tail=50

# Image automation (updates git)
kubectl logs -n flux-system -l app=image-automation-controller --tail=50

# Source controller (git operations)
kubectl logs -n flux-system -l app=source-controller --tail=50
```

## Common Issues

**"secret not found"**
- Run Step 1 to create secrets

**"authentication failed"**
- Verify token hasn't expired
- Check token has correct scopes (repo, write:packages)

**"no tags found"**
- Verify Docker Hub credentials are correct
- Check if images with `build-*` tags exist: `docker search pixelatedempathy/pixelated-empathy`

**"failed to push"**
- Verify GitHub token has write access
- Check if branch protection rules allow automation

## Need More Help?

Run full diagnostic:
```bash
./scripts/diagnose-flux-deployment.sh
```

See detailed guide:
```bash
cat docs/FIX-FLUX-DEPLOYMENT.md
```

