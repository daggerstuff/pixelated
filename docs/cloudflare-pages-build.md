# Cloudflare Pages Build Configuration

## Python Dependencies

Cloudflare Pages automatically detects Python projects and attempts to install dependencies. However, our project has heavy ML/AI dependencies (PyTorch, spaCy, SHAP, etc.) that take 30+ minutes to resolve, exceeding Cloudflare's build time limits.

### Solution

We use a minimal `requirements.txt` file to prevent Cloudflare Pages from installing heavy Python dependencies:

- **`requirements.txt`**: Empty/minimal file that Cloudflare Pages will use instead of `pyproject.toml`
- **`pyproject.toml`**: Contains all dependencies for local development and other deployments

### Build Process

1. Cloudflare Pages detects `requirements.txt` and uses it (empty = no Python deps installed)
2. Only Node.js dependencies are installed via `pnpm install`
3. Astro build runs normally without Python

### Local Development

For local development, use `uv` (recommended) or `pip`:

```bash
# Using uv (recommended)
uv install

# Using pip
pip install -e .
```

### Other Deployments

For deployments that need Python dependencies (Kubernetes, Docker, etc.), they should:
- Use `pyproject.toml` directly
- Or install from `requirements.txt` if a full requirements file is needed

## Build Script

A build script is available at `scripts/cloudflare-build.sh` that explicitly skips Python installation, but Cloudflare Pages should automatically use `requirements.txt` instead.

