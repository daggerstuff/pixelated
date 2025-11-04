# Flux System Configuration

This directory contains the Flux CD GitOps configuration for managing the cluster.

## ⚠️ Critical Resources

### `pixelated-kustomization.yaml`

**CRITICAL**: The `pixelated-kustomization.yaml` file **MUST** be included in `flux-system/kustomization.yaml` resources list.

**Location**: `flux-system/kustomization.yaml` (line 6)

**Why it's critical**: 
- This file defines the Flux Kustomization resource that orchestrates deployment of the pixelated application
- If removed from the resources list, Flux will prune (delete) the Kustomization resource
- This causes the entire pixelated deployment to be removed from the cluster
- All pods will be terminated and the application will stop serving traffic

## Safeguards

Multiple safeguards are in place to prevent accidental removal:

1. **Pre-commit Git Hook** (`.git/hooks/pre-commit`)
   - Validates configuration before allowing commits
   - Blocks commits that remove `pixelated-kustomization.yaml` from resources

2. **GitHub Actions Workflow** (`.github/workflows/validate-flux-config.yml`)
   - Runs on every PR and push to master
   - Validates that `pixelated-kustomization.yaml` is included
   - Validates YAML syntax

3. **Validation Script** (`scripts/validate-flux-kustomization.sh`)
   - Can be run manually: `./scripts/validate-flux-kustomization.sh`
   - Useful for local validation before committing

## File Structure

```
flux-system/
├── flux-system/
│   ├── kustomization.yaml          # Main Kustomize config (CRITICAL: must include pixelated-kustomization.yaml)
│   ├── pixelated-kustomization.yaml # Flux Kustomization for pixelated app (CRITICAL)
│   ├── gotk-components.yaml        # Flux components
│   ├── gotk-sync.yaml             # GitRepository and Kustomization sync config
│   ├── image-automation.yaml       # ImageRepository, ImagePolicy, ImageUpdateAutomation
│   ├── flux-clusterrole-secrets-patch.yaml
│   ├── flux-clusterrolebinding-patch.yaml
│   └── flux-namespace-secret-role.yaml
└── README.md                       # This file
```

## Making Changes

When modifying `kustomization.yaml`:

1. **Always verify** `pixelated-kustomization.yaml` remains in the resources list
2. Run the validation script: `./scripts/validate-flux-kustomization.sh`
3. The pre-commit hook will automatically validate on commit
4. GitHub Actions will validate on PR/push

## Troubleshooting

If you see validation errors:

1. Check that `pixelated-kustomization.yaml` is in the resources list
2. Verify the file exists at `flux-system/flux-system/pixelated-kustomization.yaml`
3. Ensure YAML syntax is valid
4. Check the GitHub Actions workflow output for detailed error messages

