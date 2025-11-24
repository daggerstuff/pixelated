#!/bin/bash
# Cloudflare Pages build script
# This script skips Python dependency installation to avoid build timeouts
# Cloudflare Pages will use requirements.txt (minimal) instead of pyproject.toml

set -e

echo "🔵 Cloudflare Pages build - skipping Python dependencies"
echo "📦 Installing Node.js dependencies only..."

# Install Node.js dependencies
pnpm install --frozen-lockfile

# Build the Astro project
echo "🏗️  Building Astro project..."
pnpm build

echo "✅ Build completed successfully"

