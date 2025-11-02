# GCP Authentication Fix Summary

## Issue Identified
The GitHub Actions workflow was failing with an `invalid_target` error during Google Cloud authentication. The root cause was a **service account mismatch** in the Workload Identity configuration.

## Root Cause
- **Expected Service Account**: `action@pixelatedempathy.com` (hardcoded in workflow)
- **Actual Service Account**: `github-actions-sa@pixelated-463209-e5.iam.gserviceaccount.com` (exists in GCP)
- **Project**: `pixelated-463209-e5` (correct)
- **Project Number**: `751556915102` (correct)

## Changes Made

### 1. Updated GitHub Actions Workflow (`.github/workflows/gke-deploy.yml`)
- Fixed service account reference in authentication step
- Updated verification steps to show correct service account
- Maintained existing Workload Identity Provider configuration

### 2. Created Fix Script (`scripts/fix-gcp-auth.sh`)
- Automated verification of GCP configuration
- Clear instructions for GitHub Secrets setup
- Validation of all Workload Identity components

## Verified Configuration

✅ **Workload Identity Pool**: `github-pool` (exists)  
✅ **Workload Identity Provider**: `github-provider` (exists)  
✅ **Service Account**: `github-actions-sa@pixelated-463209-e5.iam.gserviceaccount.com` (exists)  
✅ **IAM Bindings**: Proper workload identity user binding configured  

## Required GitHub Secrets

Update these secrets in your GitHub repository (`Settings → Secrets and variables → Actions`):

| Secret Name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | `pixelated-463209-e5` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/751556915102/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `github-actions-sa@pixelated-463209-e5.iam.gserviceaccount.com` |

## Testing the Fix

1. **Update GitHub Secrets** with the values above
2. **Commit and push** the updated workflow file
3. **Trigger the workflow** by pushing to main/master branch
4. **Monitor the logs** for successful authentication

## Expected Result

The authentication step should now succeed with output similar to:
```
Created credentials file at "/home/runner/work/pixelated/pixelated/gha-creds-xxxxx.json"
```

## Additional Notes

- The Workload Identity configuration is properly set up in GCP
- No changes needed to the GCP infrastructure
- The fix only required updating the workflow to use the correct service account
- All other authentication parameters were already correct

## Troubleshooting

If authentication still fails:
1. Verify GitHub Secrets are set exactly as shown above
2. Ensure repository name is `pixelatedempathy/pixelated`
3. Check that the workflow has permissions to run on the target branch
4. Run `scripts/fix-gcp-auth.sh` to re-verify the GCP configuration