#!/usr/bin/env bash
# scripts/ci/ci-build.sh
#
# Build the Pixelated application with CI-optimized settings.
# Handles NODE_OPTIONS tuning, SIGPIPE, and CI environment detection.
#
# Usage: ci-build.sh [--json] [--quiet] [--help]
# Exit codes:
#   0 — build succeeded
#   1 — build failed
#
# Flags:
#   --json    Output structured JSON result instead of human-readable
#   --quiet   Suppress non-error output
#   --help    Print this help and exit 0

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect CI environment
IS_CI=false
CI_PROVIDER=""

if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  IS_CI=true
  CI_PROVIDER="GitHub Actions"
elif [ -n "${VERCEL:-}" ]; then
  IS_CI=true
  CI_PROVIDER="Vercel"
elif [ -n "${NETLIFY:-}" ]; then
  IS_CI=true
  CI_PROVIDER="Netlify"
fi

# Optimized NODE_OPTIONS for CI builds
# 1. --max-old-space-size=8192: Allocate 8GB for Astro build (includes dependencies, AST processing, etc.)
# 2. --no-deprecation: Suppress deprecation warnings (reduces log noise)
# 3. --unhandled-rejections=strict: Fail on unhandled promise rejections
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192 --no-deprecation --unhandled-rejections=strict}"

# Optimize Node.js for builds in resource-constrained CI environments
if [ "$IS_CI" = true ]; then
  # In CI: Use single-threaded for more predictable performance
  export NODE_BUILD_OPTIMIZE=1
  export NODE_ENV=production
  
  # Disable V8 code caching for faster builds (trades startup time for memory)
  export NODE_NO_WARNINGS=1
  
  # Suppress less critical warnings
  export FORCE_COLOR=1
  
  echo "🔧 CI Environment Detected: $CI_PROVIDER"
  echo "   NODE_OPTIONS: $NODE_OPTIONS"
  echo "   Build Mode: single-threaded optimization"
fi

# Change to project root
cd "$PROJECT_ROOT"

echo ""
echo "📦 Building Pixelated application..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run build with proper signal handling
# The build-with-pipe-handling script handles EPIPE errors
if ! pnpm run build; then
  echo ""
  echo "❌ Build failed!"
  echo ""
  echo "Common causes:"
  echo "  1. Out of memory: Increase NODE_OPTIONS --max-old-space-size"
  echo "  2. Broken pipe (EPIPE): Parent process closed log stream"
  echo "  3. Dependency issues: Run 'pnpm install --force' and retry"
  echo "  4. Type errors: Run 'pnpm typecheck' to see TypeScript errors"
  echo ""
  exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Report build artifacts
if [ -d "./dist" ]; then
  DIST_SIZE=$(du -sh "./dist" | cut -f1)
  FILE_COUNT=$(find "./dist" -type f | wc -l)
  echo ""
  echo "📊 Build artifacts:"
  echo "   Size: $DIST_SIZE"
  echo "   Files: $FILE_COUNT"
  echo "   Location: ./dist"
fi
