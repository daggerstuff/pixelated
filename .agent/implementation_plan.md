# Fix duplicated mapping key in pnpm-lock.yaml

## Goal
Resolve the `ERR_PNPM_BROKEN_LOCKFILE` error in the Azure pipeline caused by a duplicated mapping key for `jsonwebtoken@9.0.3` in `pnpm-lock.yaml`. Ensure `pnpm install --frozen-lockfile` succeeds and the pipeline builds successfully.

## Proposed Changes
- Open `pnpm-lock.yaml` located at the repository root.
- Locate the duplicate entry for `jsonwebtoken@9.0.3` (around line 8119).
- Remove the duplicated mapping key, keeping a single, correct entry.
- Ensure the YAML syntax remains valid (proper indentation, no stray characters).
- Commit the updated `pnpm-lock.yaml`.

## Verification Plan
- **Local Verification**: Run `pnpm install --frozen-lockfile` locally to confirm the lockfile is no longer broken.
- **Pipeline Verification**: Push the changes and trigger the Azure pipeline. The build should complete without the `ERR_PNPM_BROKEN_LOCKFILE` error.

### Steps to Verify Locally
1. Ensure `pnpm` is installed (`pnpm --version`).
2. Execute:
   ```bash
   pnpm install --frozen-lockfile
   ```
   The command should finish without errors.

### Steps to Verify in Azure Pipeline
1. Commit and push the changes to the repository.
2. Observe the pipeline run; it should reach the `pnpm install` step successfully and continue to subsequent build steps.

## User Review Required
- Confirmation to edit `pnpm-lock.yaml` as described.
- Approval to run `pnpm install --frozen-lockfile` locally for verification.
- Optionally, any additional constraints or testing preferences.
