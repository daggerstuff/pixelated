# GKE Cluster Shutdown Guide

## Why Your GKE Cluster Is Still Running

Your GKE cluster (`pixelcluster`) is still running and costing money because:

1. **GitHub Actions Auto-Deployment**: The workflow `.github/workflows/gke-deploy.yml` automatically deploys to GKE on every push to `master` branch. This keeps the cluster alive.

2. **Cluster Not Deleted**: The cluster itself hasn't been deleted, so it continues to run and incur costs.

## What I've Done

✅ **Disabled GitHub Actions Workflow**: Modified `.github/workflows/gke-deploy.yml` to disable all GKE deployment jobs:
   - `deploy-gke` job now has `if: false`
   - `health-check-gke` job now has `if: false`
   - `cleanup` job now has `if: false`

✅ **Created Shutdown Script**: Created `scripts/shutdown-gke-cluster.sh` to safely delete the cluster.

## What You Need to Do

### Step 1: Delete the GKE Cluster

Run the shutdown script:

```bash
cd /home/vivi/pixelated
./scripts/shutdown-gke-cluster.sh
```

This script will:
- Check authentication
- Verify cluster exists
- Ask for confirmation (type `DELETE` to confirm)
- Delete the cluster (takes 5-15 minutes)
- Check for orphaned resources

**Alternative Manual Command:**

```bash
gcloud container clusters delete pixelcluster \
  --region=us-east1 \
  --project=pixelated-463209-e5
```

### Step 2: Verify Billing Has Stopped

After deletion completes:
1. Go to [GCP Console Billing](https://console.cloud.google.com/billing)
2. Check your project `pixelated-463209-e5`
3. Verify no more GKE charges are accumulating

### Step 3: Monitor for Orphaned Resources

The script will check for orphaned disks, but manually verify:

```bash
# Check for orphaned disks
gcloud compute disks list --project=pixelated-463209-e5 --filter="name~gke-pixelcluster OR name~pixelcluster"

# List all clusters (should be empty)
gcloud container clusters list --project=pixelated-463209-e5
```

## Cost Savings

After deletion, you'll stop paying for:
- **Compute nodes** (e2-medium instances)
- **Persistent disks** (storage)
- **Load balancer** (if using)
- **Network egress** (if any)

**Estimated monthly savings**: ~$50-150/month depending on your cluster size.

## Important Notes

⚠️ **Data Loss**: Deleting the cluster will permanently delete:
   - All running pods and services
   - All persistent volumes (unless backed up)
   - All cluster configurations

⚠️ **GitHub Actions**: The workflow is now disabled, so future pushes won't try to deploy to GKE. If you need to re-enable it later, change `if: false` back to the original condition.

⚠️ **Backup**: If you have important data, back it up before deletion:
   ```bash
   # Export cluster resources
   kubectl get all --all-namespaces -o yaml > cluster-backup.yaml
   ```

## Troubleshooting

### If cluster deletion fails:

1. **Check permissions**:
   ```bash
   gcloud projects get-iam-policy pixelated-463209-e5
   ```
   You need `roles/container.admin` or `roles/owner`.

2. **Check for stuck resources**:
   ```bash
   # Check for stuck pods
   kubectl get pods --all-namespaces
   
   # Force delete if needed
   kubectl delete pod <pod-name> --force --grace-period=0
   ```

3. **Manual cleanup**:
   ```bash
   # Delete node pools first
   gcloud container node-pools list --cluster=pixelcluster --region=us-east1 --project=pixelated-463209-e5
   
   # Then delete cluster
   gcloud container clusters delete pixelcluster --region=us-east1 --project=pixelated-463209-e5
   ```

## Next Steps After Shutdown

1. ✅ Verify cluster is deleted
2. ✅ Confirm billing has stopped
3. ✅ Monitor for 24-48 hours to ensure no charges
4. ✅ Update any documentation referencing GKE
5. ✅ Consider deleting GCP service account if no longer needed

## Migration to Civo

Since you've migrated to Civo:
- Make sure your Civo cluster is properly configured
- Update any CI/CD pipelines to deploy to Civo instead
- Update environment variables and secrets
- Update documentation

---

**Created**: 2025-01-XX  
**Last Updated**: 2025-01-XX

