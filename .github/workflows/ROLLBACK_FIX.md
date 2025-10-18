# GitHub Rollback Workflow Fix

## Problem
The rollback workflow was failing with the error:
```
! [remote rejected] prod-rollback-20251018-01-01 -> prod-rollback-20251018-01-01 (refusing to allow a GitHub App to create or update workflow `.github/workflows/ai-validation.yml` without `workflows` permission)
```

## Root Cause
The GitHub App used by GitHub Actions doesn't have the `workflows` permission required to push to repositories containing workflow files. This is a security restriction that prevents GitHub Apps from modifying workflow files without explicit permission.

## Solution
Modified the rollback workflow to use a Personal Access Token (PAT) instead of the default `GITHUB_TOKEN` when available. The workflow now:

1. First tries to use `PERSONAL_ACCESS_TOKEN` secret if available
2. Falls back to `GITHUB_TOKEN` if PAT is not configured
3. Sets the `GITHUB_TOKEN` environment variable for git operations

## Changes Made

### 1. Updated Checkout Step
```yaml
- name: Checkout repository
  uses: actions/checkout@v5
  with:
    fetch-depth: 0
    token: ${{ secrets.PERSONAL_ACCESS_TOKEN || secrets.GITHUB_TOKEN }}
```

### 2. Added Environment Variables to Git Push Steps
```yaml
  - name: Create rollback tag
    run: |
      # ... existing git commands ...
      git push ${GIT_PUSH_REMOTE:-origin} "$TAG_NAME"
    env:
      GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN || secrets.GITHUB_TOKEN }}
```

Note: You can configure the push remote with the `GIT_PUSH_REMOTE` environment variable (defaults to `origin`). This helps align with local remote mapping like `origin -> GitHub` and `gitlab -> GitLab`.

## Setup Instructions

### Option 1: Interactive CLI Setup (Recommended)

Use the provided script for guided token setup:

```bash
# Run the interactive setup script
./scripts/create-rollback-token.sh
```

The script will:
- Check GitHub CLI authentication
- Open the token creation page in your browser
- Guide you through the token creation process
- Help you add the token as a repository secret
- Provide setup confirmation

### Option 2: Quick CLI Setup

If you prefer manual control, use the GitHub API via CLI:

```bash
# Get current repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Create token manually at: https://github.com/settings/tokens/new
# Required scopes: repo, workflow

# Add as repository secret
gh secret set PERSONAL_ACCESS_TOKEN --body "$TOKEN" --repo "$REPO"
```

### Option 3: Manual CLI Commands

If you prefer to do it step by step:

```bash
# 1. Get your repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# 2. Create token manually at: https://github.com/settings/tokens/new
#    Required scopes: repo, workflow

# 3. Add as repository secret (replace YOUR_TOKEN with actual token)
gh secret set PERSONAL_ACCESS_TOKEN --body "YOUR_TOKEN" --repo "$REPO"
```

### Option 4: Manual Web Interface Setup

1. **Create a Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a descriptive name like "Rollback Workflow Token"
   - Set expiration (recommend 90 days or less for security)
   - Select scopes:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)

2. **Add the Token to Repository Secrets:**
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `PERSONAL_ACCESS_TOKEN`
   - Value: Paste your generated token
   - Click "Add secret"

3. **Test the Rollback Workflow:**
   - Push to staging or master branch to trigger the rollback workflow
   - Verify that tags are created successfully without permission errors

### For Users Without PAT Access

If you don't have access to create a PAT or add secrets, the workflow will automatically fall back to using the default `GITHUB_TOKEN`. However, you may encounter the same permission issues if your GitHub App doesn't have the required permissions.

## Security Considerations

- PATs should be rotated regularly (recommended every 90 days)
- Use the minimum required permissions for the PAT
- Consider using fine-grained personal access tokens for better security
- Monitor token usage and revoke if compromised

## Alternative Solutions

If you cannot use a PAT, consider:

1. **Update GitHub App Permissions:** Request the repository owner to add `workflows` permission to the GitHub App
2. **Use Deploy Keys:** Set up SSH deploy keys with write access for git operations
3. **Manual Rollback:** Use manual git commands with appropriate authentication

## Monitoring

After implementation, monitor:
- Workflow success rates
- Token expiration dates
- Any new permission-related errors

## References

- [GitHub Actions Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub App Permissions](https://docs.github.com/en/developers/apps/building-github-apps/setting-permissions-for-github-apps)
- [Authenticate with GITHUB_TOKEN - GitHub Docs](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)