#!/bin/bash
# Vercel-specific build script
# This script is ONLY used by Vercel and does not affect other deployment targets
# Ensures pnpm 10.x is used and runs the Astro build
#
# NOTE: This script can be used as an alternative to inline buildCommand in vercel.json
# When using the `builds` array in vercel.json, you must specify `buildCommand` explicitly
# Vercel does NOT automatically run `vercel-build` - use buildCommand in vercel.json instead

set -e

echo "🔵 Vercel build starting..."
echo "Node version: $(node --version)"
echo "Npm version: $(npm --version)"

echo "Setting up pnpm 10.26.0 via corepack..."

# Enable corepack and prepare pnpm 10.26.0
corepack enable || true
corepack prepare pnpm@10.26.0 --activate

echo "pnpm version after setup:"
pnpm --version

# Ensure dependencies are installed with correct pnpm version
# (In case install step used wrong version)
echo "Installing/updating dependencies with pnpm 10.x..."
pnpm install --frozen-lockfile

# Show disk space
echo "Disk space available:"
df -h

echo "Running Astro build..."
# Run with verbose output and error handling
if ! pnpm build; then
  echo "❌ ASTRO BUILD FAILED!"
  echo "Recent logs:"
  tail -100
  exit 1
fi

# Verify build output exists
echo "Verifying build artifacts..."
if [ ! -d "dist" ]; then
  echo "❌ ERROR: dist/ directory not found after build!"
  exit 1
fi

if [ ! -d "dist/server" ]; then
  echo "❌ ERROR: dist/server/ directory not found after build!"
  echo "Available dist structure:"
  ls -la dist/ || true
  exit 1
fi

if [ ! -f "dist/server/entry.mjs" ]; then
  echo "❌ ERROR: dist/server/entry.mjs not found after build!"
  echo "Available files in dist/server/:"
  ls -la dist/server/ || true
  exit 1
fi

# Verify the handler can be found
if [ ! -f "deploy/vercel/vercel-handler.js" ]; then
  echo "❌ ERROR: deploy/vercel/vercel-handler.js not found!"
  exit 1
fi

# Show file sizes for debugging
echo "Build artifact sizes:"
du -sh dist/ 2>/dev/null || true
du -sh dist/server/entry.mjs 2>/dev/null || true

echo "✅ Vercel build complete! All artifacts verified."

