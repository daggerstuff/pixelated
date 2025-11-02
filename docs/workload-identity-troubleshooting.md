# Workload Identity Federation - Quick Troubleshooting Guide

## Error: `invalid_target`

This error indicates that the Workload Identity Pool or Provider doesn't exist, is disabled, or the resource name format is incorrect.

## Quick Fix Steps

### 1. Run the Verification Script

```bash
export GCP_PROJECT_ID=your-project-id
chmod +x scripts/verify-workload-identity.sh
./scripts/verify-workload-identity.sh [service-account-email]
```

The script will check:
- ✅ Required APIs are enabled
- ✅ Workload Identity Pool exists and is ACTIVE
- ✅ Provider exists with correct issuer URI
- ✅ Service account exists
- ✅ Workload Identity User binding is correct

### 2. Verify GitHub Secrets

Ensure these secrets are set in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Expected Format | Example |
|-------------|----------------|---------|
| `GCP_PROJECT_ID` | Your GCP project ID | `pixelated-empathy-123456` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full resource path | `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account email | `action@pixelatedempathy.com` |

**Important**:
- No extra spaces or quotes
- Use PROJECT_NUMBER (not PROJECT_ID) in the provider path
- The full path must match exactly

### 3. Common Issues and Solutions

#### Issue: Pool/Provider doesn't exist

**Solution**: Create them using the commands provided by the verification script, or:

```bash
# Get project number first
PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)")

# Create pool
gcloud iam workload-identity-pools create github-pool \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

#### Issue: Wrong PROJECT_NUMBER vs PROJECT_ID

The `GCP_WORKLOAD_IDENTITY_PROVIDER` must use the **project number**, not the project ID.

**Get your project number**:
```bash
gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)"
```

**Correct format**:
```
projects/[PROJECT_NUMBER]/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

#### Issue: Missing Workload Identity User Binding

**Solution**:
```bash
PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)")

gcloud iam service-accounts add-iam-policy-binding action@pixelatedempathy.com \
  --project="${GCP_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository_owner/pixelatedempathy"
```

#### Issue: Provider is disabled

**Check status**:
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(state)"
```

If it shows `DELETED` or `DISABLED`, you may need to recreate it or check IAM permissions.

### 4. Verify Workflow Permissions

Ensure your workflow has the `id-token: write` permission:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC
```

### 5. Manual Testing

Test authentication locally (requires `gcloud` CLI):

```bash
# Authenticate
gcloud auth application-default login

# Test service account access
gcloud auth activate-service-account --impersonate-service-account=action@pixelatedempathy.com

# Verify
gcloud projects list
```

## Getting Help

1. Run the verification script first: `./scripts/verify-workload-identity.sh`
2. Check the script output for specific issues
3. Review the detailed setup guide: `docs/gcp-authentication-setup.md`
4. Check GitHub Actions logs for the exact error message

## Related Documentation

- Full setup guide: `docs/gcp-authentication-setup.md`
- Workload Identity details: `docs/gcp-workload-identity-setup.md`
- Migration guide: `docs/authentication-migration-summary.md`
