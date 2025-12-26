# Project Root Organization - Next Steps

## What Was Done

Your project root directory has been reorganized to reduce clutter and improve maintainability. All loose files have been moved into appropriate subdirectories based on their function.

### Moved Files Summary

**1. Config Files → `/config`** (56 files)
   - Build configs: `astro.config.mjs`, `vite.config.js`, etc.
   - Test configs: `vitest.config.ts`, `playwright.config.ts`
   - Linting configs: `eslint.config.js`, `.prettierrc`
   - Language tools: `tsconfig.json`, `mypy.ini`, `pyrightconfig.json`
   - Infrastructure: `Caddyfile`, `compass.yml`
   - Organized into subdirectories:
     - `config/package/` - Package manager configs (`.npmrc`, `.pnpmrc`, `.nvmrc`)
     - `config/templates/` - Environment templates
     - `config/k8s/` - Kubernetes configs
     - `config/hidden/` - Additional tool configs

**2. CI/CD Files → `/ci-cd`** (4 files)
   - `azure-pipelines.yml`
   - `azure-pipelines-terraform.yml`
   - `bitbucket-pipelines.yaml`
   - `.gitlab-ci.yml`

**3. Docker Files → `/docker`** (13 docker-compose files + Dockerfiles)
   - `Dockerfile`, `Dockerfile.prod`
   - All `docker-compose.*.yml` files

**4. Scripts → `/scripts`** (3 directories)
   - `scripts/migrations/` - Database migration scripts
   - `scripts/utils/` - Utility scripts (Python, Node.js)
   - `scripts/bin/` - Executable scripts

**5. Test Files → `/tests/_legacy`** (26 files)
   - Old test files and demo files
   - Legacy test configurations

**6. Logs → `/logs`** (7 files)
   - Build and deployment logs
   - Error reports

**7. Security → `/security/certs`** (2 files)
   - SSL certificates (sp-cert.pem, sp-key.pem)

### Symlinks Created

The following symlinks were created in the root to ensure tools find configs in expected locations:

```
.npmrc → config/package/.npmrc
.pnpmrc → config/package/.pnpmrc
.nvmrc → config/package/.nvmrc
```

## Actions Required

### 1. Update CI/CD Pipeline References

Your CI/CD files need to reference the new locations:

**Azure Pipelines** (`ci-cd/azure-pipelines.yml`):
```yaml
# Old references like this:
# sourceVersion: azure-pipelines.yml

# Need updating to point to new location in CI/CD config
trigger:
  paths:
    include:
      - ci-cd/azure-pipelines.yml
```

### 2. Update Build Scripts

If your `package.json` or CI scripts reference old file paths, update them:

```json
{
  "scripts": {
    "build": "astro build --config config/astro.config.mjs",
    "typecheck": "tsc --project config/tsconfig.json",
    "test": "vitest --config config/vitest.config.ts"
  }
}
```

### 3. Update Docker Build References

If you reference `Dockerfile` from scripts or CI/CD:

```bash
# Old
docker build -f Dockerfile -t image:tag .

# New
docker build -f docker/Dockerfile -t image:tag .
```

### 4. IDE/Editor Configuration

Update editor config files to reference new locations:

**.vscode/settings.json:**
```json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript"
  ],
  "eslint.options": {
    "configFile": "config/.eslintrc.js"
  },
  "prettier.configPath": "config/.prettierrc"
}
```

### 5. Tool Configuration Files

Update any tool config that may hardcode paths:

**If using mypy:**
```bash
# In scripts or CI/CD
mypy --config-file config/hidden/mypy.ini src/
```

**If using pytest:**
```bash
# In scripts or CI/CD
pytest --ini config/hidden/pytest.ini tests/
```

### 6. Git Updates

The git status will show many deletions and additions. The moves need to be staged:

```bash
# Stage all changes
git add .

# Verify the moves
git status

# Commit the reorganization
git commit -m "refactor: reorganize root directory for better structure"
```

## Verification Checklist

- [ ] CI/CD pipelines updated to reference new file locations
- [ ] `package.json` build scripts point to correct config files
- [ ] Docker builds reference `docker/Dockerfile`
- [ ] Editor settings reference new config paths
- [ ] Local build works: `pnpm build`
- [ ] Local tests work: `pnpm test`
- [ ] Linting works: `pnpm lint`
- [ ] Type checking works: `pnpm typecheck`
- [ ] CI/CD pipeline runs successfully
- [ ] Git commit created for this reorganization

## File Reference Quick Guide

| Old Location | New Location | Notes |
|---|---|---|
| `astro.config.mjs` | `config/astro.config.mjs` | Update build scripts |
| `tsconfig.json` | `config/tsconfig.json` | Update IDE/editor settings |
| `eslint.config.js` | `config/eslint.config.js` | ESLint should auto-discover |
| `.prettierrc` | `config/.prettierrc` | Prettier may need explicit config path |
| `vite.config.js` | `config/vite.config.js` | Usually auto-discovered |
| `Dockerfile` | `docker/Dockerfile` | Update CI/CD and build scripts |
| `docker-compose.yml` | `docker/docker-compose.yml` | Update references in scripts |
| `azure-pipelines.yml` | `ci-cd/azure-pipelines.yml` | Update Azure DevOps references |
| `.npmrc` | → **root** (symlink) | Symlink maintains compatibility |
| `.pnpmrc` | → **root** (symlink) | Symlink maintains compatibility |
| `.nvmrc` | → **root** (symlink) | Symlink maintains compatibility |

## Benefits of This Organization

✅ **Cleaner Root** - From 100+ scattered files to 41 essential files  
✅ **Better Structure** - Files grouped by purpose and function  
✅ **Easier Navigation** - Configs, CI/CD, and scripts are obvious where to find  
✅ **Maintainability** - Reduces cognitive load when onboarding new developers  
✅ **Tool Compatibility** - Symlinks ensure tools still find expected configs  
✅ **Scalability** - Clear directories for future growth  

## Questions or Issues?

If any tool fails to find its config file:
1. Check if a symlink exists in the root for that tool
2. Check tool documentation for custom config path option
3. Create a symlink to the new location if needed

Example:
```bash
# If pytest can't find config
ln -s config/hidden/pytest.ini pytest.ini
```

