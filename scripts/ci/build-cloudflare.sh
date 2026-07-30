#!/usr/bin/env bash
# scripts/ci/build-cloudflare.sh
#
# Cloudflare Pages build script that skips Python dependency installation.
# Temporarily hides pyproject.toml to prevent Cloudflare from automatically
# installing Python dependencies during the build.
#
# Usage: build-cloudflare.sh [--help]
# Exit codes:
#   0 — build succeeded
#   1 — build failed

set -euo pipefail

echo "🔵 Starting Cloudflare Pages build (Python dependencies will be skipped)"

# Set environment variables
export DEPLOY_TARGET=cloudflare
export SKIP_PYTHON_INSTALL=true
export UV_SKIP_INSTALL=1
export NO_PYTHON_INSTALL=1

# Backup and hide pyproject.toml to prevent automatic Python installation
PYPROJECT_BACKUP=""
if [ -f "pyproject.toml" ]; then
  mv pyproject.toml pyproject.toml.cloudflare-backup
  PYPROJECT_BACKUP="pyproject.toml.cloudflare-backup"
  echo "📦 Temporarily moved pyproject.toml to prevent Python installation"
fi

# Function to restore pyproject.toml on exit
restore_pyproject() {
  if [ -n "$PYPROJECT_BACKUP" ] && [ -f "$PYPROJECT_BACKUP" ]; then
    mv "$PYPROJECT_BACKUP" pyproject.toml
    echo "📦 Restored pyproject.toml after build"
  fi
}

# Ensure pyproject.toml is restored even if build fails
trap restore_pyproject EXIT

# Run the Astro build
echo "🚀 Running Astro build for Cloudflare Pages..."
pnpm astro build

echo "✅ Cloudflare Pages build completed successfully"

