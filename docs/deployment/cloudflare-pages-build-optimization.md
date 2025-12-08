# Cloudflare Pages Build Optimization

## Problem

Cloudflare Pages builds were timing out because the build process was automatically detecting `pyproject.toml` and attempting to install all Python dependencies (including heavy ML packages like PyTorch, spaCy, SHAP, etc.), which takes over 30 minutes and exceeds Cloudflare's build time limits.

## Solution

We've implemented a multi-layered approach to prevent Python dependency installation during Cloudflare Pages builds:

### 1. Build Script Modification

The `build:cloudflare` command in `package.json` now uses `scripts/build-cloudflare.sh`, which:
- Sets all necessary environment variables (`DEPLOY_TARGET=cloudflare`, `SKIP_PYTHON_INSTALL=true`, etc.)
- Temporarily renames `pyproject.toml` to `pyproject.toml.cloudflare-backup` to prevent automatic detection
- Runs the Astro build
- Automatically restores `pyproject.toml` after the build completes (even if the build fails, using `trap`)

### 2. Wrangler Configuration

`wrangler.toml` now uses `pnpm build:cloudflare` instead of `pnpm build` to ensure the optimized build command is used.

### 3. Ignore File

Created `.cloudflareignore` to exclude Python files and directories from Cloudflare Pages builds (though this may not be fully supported by Cloudflare Pages yet).

## Why This Works

Cloudflare Pages automatically detects Python projects by looking for:
- `pyproject.toml`
- `requirements.txt`
- `Pipfile`
- `setup.py`

By temporarily renaming `pyproject.toml` during the build, we prevent Cloudflare from detecting it as a Python project and attempting to install dependencies.

## Important Notes

1. **Python services are separate microservices** - They don't need to be built as part of the Cloudflare Pages deployment
2. **Only frontend/SSR code is needed** - Cloudflare Pages only needs the Astro build output
3. **Build time optimization** - Skipping Python installation reduces build time from 30+ minutes to under 5 minutes

## Manual Override

If you need to test Python installation during Cloudflare builds (not recommended), you can:

```bash
# Skip the Python skip script
DEPLOY_TARGET=cloudflare SKIP_PYTHON_INSTALL=false pnpm build
```

## Troubleshooting

If builds still attempt to install Python dependencies:

1. Check that `DEPLOY_TARGET=cloudflare` is set
2. Verify `scripts/skip-python-install.sh` is executable (`chmod +x scripts/skip-python-install.sh`)
3. Check Cloudflare Pages build settings to ensure the build command is `pnpm build:cloudflare`
4. Review build logs to confirm `pyproject.toml` is being renamed

## Related Files

- `package.json` - Build scripts (uses `build:cloudflare` command)
- `wrangler.toml` - Cloudflare configuration (uses `pnpm build:cloudflare`)
- `scripts/build-cloudflare.sh` - Main Cloudflare build script that skips Python installation
- `scripts/skip-python-install.sh` - Helper script (can be used standalone if needed)
- `.cloudflareignore` - Files to exclude from builds (may not be fully supported)

