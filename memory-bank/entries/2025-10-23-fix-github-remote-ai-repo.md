# Fix: GitHub Remote Configuration for AI Repository

## Problem
The GitHub Pull Request extension was failing with the error: `file:///home/vivi/pixelated/ai has no GitHub remotes`. This occurred because the `ai` repository had conflicting remote configurations:
- `github` remote: `git@github-pixelated:pixelatedempathy/ai.git` (correct GitHub remote)
- `origin` remote: `git@gitlab-gemcity:gemcity/ai.git` (incorrect GitLab remote)

The extension expected a GitHub remote but found a GitLab remote as the default (`origin`).

## Solution
Updated the `origin` remote to point to the correct GitHub repository:
```bash
cd /home/vivi/pixelated/ai
git remote set-url origin git@github-pixelated:pixelatedempathy/ai.git
```

This made both `github` and `origin` remotes point to the same GitHub repository:
```
github	git@github-pixelated:pixelatedempathy/ai.git (fetch)
github	git@github-pixelated:pixelatedempathy/ai.git (push)
origin	git@github-pixelated:pixelatedempathy/ai.git (fetch)
origin	git@github-pixelated:pixelatedempathy/ai.git (push)
```

## Verification
After the change:
- GitHub Pull Request extension now works correctly
- `git remote -v` shows consistent remote configuration
- Push/pull operations will work with the correct GitHub repository

## Impact
This fix enables:
- GitHub Pull Request functionality in VS Code
- Proper integration with GitHub workflows
- Consistent remote configuration across the team

## Additional Notes
The repository was previously configured with a GitLab remote, likely due to legacy configuration. The correct remote should always point to the GitHub repository since this is a GitHub-hosted project.