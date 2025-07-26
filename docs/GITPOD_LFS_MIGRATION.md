# Gitpod LFS Migration Options

## Current Issue
Your Git LFS is configured to use a private Gitea instance that Gitpod cannot authenticate with.

## Solution Options

### Option 1: Use GitHub LFS (Recommended for Gitpod)
```bash
# Remove current LFS config
rm .lfsconfig

# Let Git LFS use the default GitHub endpoint
git lfs uninstall
git lfs install

# Push LFS files to GitHub
git lfs push --all origin
```

### Option 2: Use GitLab LFS
```bash
# Configure for GitLab
echo '[lfs]' > .lfsconfig
echo 'url = https://gitlab.com/your-username/your-repo.git/info/lfs' >> .lfsconfig

# Migrate LFS files
git lfs fetch --all
git remote add gitlab https://gitlab.com/your-username/your-repo.git
git lfs push --all gitlab
```

### Option 3: Disable LFS for Gitpod
Create a `.gitpod.yml` that temporarily disables LFS:

```yaml
tasks:
  - name: Setup without LFS
    before: |
      # Skip LFS for Gitpod builds
      git config lfs.fetchinclude ""
      git config lfs.fetchexclude "*"
      echo "⚠️  LFS disabled for Gitpod - some large files may be missing"
    init: |
      pnpm install
    command: |
      pnpm dev
```

### Option 4: Use Git-Credential Manager
For advanced users, configure git-credential-manager in the Dockerfile:

```dockerfile
# In .gitpod/Dockerfile
RUN curl -L https://github.com/git-ecosystem/git-credential-manager/releases/latest/download/gcm-linux_amd64.2.0.935.tar.gz | tar -xz -C /usr/local/bin
RUN git config --global credential.helper manager
```

## Recommended Approach
For the best Gitpod experience, use Option 1 (GitHub LFS) as it requires no additional authentication setup. 