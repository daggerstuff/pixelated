#!/bin/bash
# Vercel-specific build script
# This script is ONLY used by Vercel and does not affect other deployment targets
# Ensures pnpm 10.x is used and runs the Astro build
#
# NOTE: When `builds` exists in vercel.json, Vercel automatically runs this
# `vercel-build` script before processing the builds section

set -e

echo "🔵 Vercel build starting..."
echo "Current pnpm version:"
pnpm --version || echo "pnpm not found"

echo "Setting up pnpm 10.24.0 via corepack..."

# Enable corepack and prepare pnpm 10.24.0
corepack enable || true
corepack prepare pnpm@10.24.0 --activate

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

