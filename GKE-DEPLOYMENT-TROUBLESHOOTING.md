# GKE Deployment Troubleshooting Guide

## 🔧 Recent Fixes Applied

### 1. ✅ Fixed GitLab CI YAML Syntax Error
**Problem:** Invalid escape sequences in multiline string causing pipeline validation to fail.

**Solution:** Converted quoted scalar to literal block scalar (`|`) for the deployment script.

**Files Changed:** `.gitlab-ci.yml`

---

### 2. ✅ Fixed Replica Count Mismatch
**Problem:** Deployment configuration conflict causing rollout failures:
- Deployment: `replicas: 2`
- HorizontalPodAutoscaler (HPA): `minReplicas: 3`
- PodDisruptionBudget (PDB): `minAvailable: 2`

**Solution:** Updated Deployment to match HPA minimum: `replicas: 3`

**Files Changed:** `k8s/deployment.yaml`

**Why This Matters:**
- HPA will always try to scale to 3 pods (its minimum)
- Old config had 2 replicas causing constant scaling battles
- PDB requiring 2 available pods can block rollouts when only 2-3 pods exist

---

### 3. ✅ Enhanced Deployment Diagnostics
**Added:** Comprehensive failure diagnostics that automatically run when rollout fails:

- Pod status and node placement
- ReplicaSet status
- Recent Kubernetes events (last 30)
- Deployment description
- Pod event details
- Container logs from failing pods
- Common failure causes checklist

**Timeout:** Extended from 600s (10 min) to 900s (15 min)

---

## 🔍 Next Pipeline Run - What to Expect

When you push these changes and run the pipeline again:

### If Deployment Succeeds ✅
You'll see:
```
✅ Deployed to GKE successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Namespace: pixelated
Deployment: pixelated
Image: registry.gitlab.com/pixeldeck/pixelated:abc1234
Pods:
NAME                         READY   STATUS    RESTARTS   AGE   IP           NODE
pixelated-abc123-xyz         1/1     Running   0          2m    10.x.x.x     node-1
pixelated-abc123-def         1/1     Running   0          2m    10.x.x.x     node-2
pixelated-abc123-ghi         1/1     Running   0          2m    10.x.x.x     node-3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### If Deployment Fails ❌
You'll see detailed diagnostics including:

1. **Pod Status** - Shows which pods are failing and on which nodes
2. **ReplicaSet Status** - Shows the rollout progression
3. **Recent Events** - Kubernetes events explaining what went wrong
4. **Pod Descriptions** - Detailed reason for failures (ImagePullBackOff, CrashLoopBackOff, etc.)
5. **Container Logs** - Actual application logs from failing pods
6. **Common Causes** - Checklist of typical issues

Example diagnostic output:
```
❌ Rollout failed or timed out after 15 minutes

🔍 Diagnosing rollout failure...

=== Pod Status ===
NAME                         READY   STATUS             RESTARTS   AGE
pixelated-abc123-xyz         0/1     ImagePullBackOff   0          5m

=== Recent Events ===
5m  Warning  Failed  Pod  Failed to pull image: unauthorized

💡 Common causes:
  1. Health check endpoint not responding (/health)
  2. Container startup failures (missing env vars, secrets)
  3. Image pull failures
  4. Resource constraints (insufficient CPU/memory)
  5. PodDisruptionBudget blocking pod termination
```

---

## 🚀 Commands to Run Now

### 1. Commit and Push Changes
```bash
cd /root/pixelated
git add .gitlab-ci.yml k8s/deployment.yaml
git commit -m "fix: resolve GKE deployment issues

- Fix YAML syntax error in .gitlab-ci.yml (escape sequences)
- Align deployment replicas (3) with HPA minReplicas (3)
- Add comprehensive deployment failure diagnostics
- Extend rollout timeout to 15 minutes"
git push origin master
```

### 2. Monitor the Pipeline
```bash
# Watch pipeline status
# Go to: https://gitlab.com/pixeldeck/pixelated/-/pipelines

# Or use GitLab CLI if installed
glab ci view
```

### 3. Manual Kubernetes Diagnosis (If Needed)
```bash
# Check current deployment status
kubectl get deployments -n pixelated

# Check pod status
kubectl get pods -n pixelated -l app=pixelated-app -o wide

# View pod details
kubectl describe pods -n pixelated -l app=pixelated-app

# Check logs from a specific pod
kubectl logs -n pixelated <pod-name> --tail=100

# View recent events
kubectl get events -n pixelated --sort-by='.lastTimestamp' | tail -20

# Check HPA status
kubectl get hpa -n pixelated

# Check PDB status
kubectl get pdb -n pixelated
```

---

## 🐛 Known Issues to Watch For

### Issue 1: Health Check Failures
**Symptom:** Pods stuck in "Running" but not "Ready"
**Cause:** `/health` endpoint not responding on port 4321
**Fix:** Verify your application has a health endpoint or adjust the probe in `k8s/deployment.yaml`

### Issue 2: Image Pull Errors
**Symptom:** `ImagePullBackOff` or `ErrImagePull`
**Causes:**
- Registry authentication failure
- Image doesn't exist in registry
- Network issues accessing registry
**Fix:** Verify `regcred` secret exists and is valid

### Issue 3: Resource Constraints
**Symptom:** Pods stuck in "Pending" state
**Cause:** Insufficient cluster resources
**Current Requests:** 
- CPU: 250m per pod × 3 pods = 750m
- Memory: 256Mi per pod × 3 pods = 768Mi
**Fix:** Scale cluster or reduce resource requests

### Issue 4: PDB Blocking Rollout
**Symptom:** Rollout progresses slowly or times out
**Cause:** PDB requires `minAvailable: 2`, but cluster trying to update all pods
**Fix:** This should be resolved with 3 replicas now

---

## 📊 Configuration Summary

| Component | Setting | Value |
|-----------|---------|-------|
| Deployment Replicas | Initial | 3 |
| HPA Min Replicas | Auto-scale floor | 3 |
| HPA Max Replicas | Auto-scale ceiling | 20 |
| PDB Min Available | Minimum healthy | 2 |
| Rollout Timeout | Max wait time | 900s (15m) |
| Health Check Path | Endpoint | `/health` |
| Health Check Port | Port | 4321 |
| CPU Request | Per pod | 250m |
| Memory Request | Per pod | 256Mi |

---

## 🎯 Success Criteria

Your deployment is successful when:

1. ✅ Pipeline `deploy-gke` job completes without errors
2. ✅ All 3 pods show `READY 1/1` and `STATUS Running`
3. ✅ Health check job passes (optional but recommended)
4. ✅ Application accessible at: http://35.243.226.27

---

## 📞 Need More Help?

If the deployment still fails after these fixes:

1. **Check the diagnostic output** in the GitLab CI logs
2. **Run manual kubectl commands** to inspect cluster state
3. **Verify secrets and configmaps** are properly configured
4. **Check node resources** to ensure cluster has capacity
5. **Review application logs** for startup errors

---

**Last Updated:** $(date)
**Pipeline Configuration:** `.gitlab-ci.yml`
**Kubernetes Manifests:** `k8s/deployment.yaml`
