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
echo "Current pnpm version:"
pnpm --version || echo "pnpm not found"

echo "Setting up pnpm 10.26.0 via corepack..."

# Enable corepack and prepare pnpm 10.26.0
corepack enable || true
corepack prepare pnpm@10.26.0 --activate

echo "Verifying pnpm version after setup:"
pnpm --version

# Ensure dependencies are installed with correct pnpm version
# (In case install step used wrong version)
echo "Installing/updating dependencies with pnpm 10.x..."
pnpm install --frozen-lockfile

echo "Running Astro build..."
pnpm build

# Verify build output exists
if [ ! -f "dist/server/entry.mjs" ]; then
  echo "❌ ERROR: dist/server/entry.mjs not found after build!"
  exit 1
fi

echo "✅ Vercel build complete! Build output verified."

