#!/bin/bash
# Script to prevent Python dependency installation during Cloudflare Pages builds
# This is called before the build to ensure Python packages aren't installed

set -e

# Check if we're building for Cloudflare Pages
if [ "$DEPLOY_TARGET" = "cloudflare" ] || [ "$CF_PAGES" = "1" ] || [ "$SKIP_PYTHON_INSTALL" = "true" ]; then
  echo "🔵 Cloudflare Pages build detected - skipping Python dependency installation"
  
  # Remove or rename pyproject.toml temporarily to prevent automatic installation
  if [ -f "pyproject.toml" ]; then
    mv pyproject.toml pyproject.toml.cloudflare-backup
    echo "📦 Temporarily moved pyproject.toml to prevent Python installation"
    
    # Restore function to be called after build
    restore_pyproject() {
      if [ -f "pyproject.toml.cloudflare-backup" ]; then
        mv pyproject.toml.cloudflare-backup pyproject.toml
        echo "📦 Restored pyproject.toml after build"
      fi
    }
    trap restore_pyproject EXIT
  fi
  
  # Set environment variables to prevent uv from running
  export UV_SKIP_INSTALL=1
  export SKIP_PYTHON_INSTALL=true
  export NO_PYTHON_INSTALL=1
  
  # Also create a dummy .python-version file to prevent auto-detection
  if [ ! -f ".python-version" ]; then
    echo "3.11" > .python-version.cloudflare-dummy
    echo "📝 Created dummy .python-version file"
  fi
  
  echo "✅ Python installation skipped for Cloudflare Pages build"
else
  echo "ℹ️  Not a Cloudflare Pages build - Python dependencies will be installed normally"
fi

