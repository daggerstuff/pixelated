#!/usr/bin/env bash
set -euo pipefail

echo "🔍 CI Environment Diagnostics for pnpm install issues"
echo "======================================================"
echo ""

echo "📋 System Information:"
echo "  - OS: $(uname -s) $(uname -r)"
echo "  - Architecture: $(uname -m)"
echo "  - Available memory: $(free -h 2>/dev/null | grep Mem || echo 'N/A')"
echo "  - Available disk space: $(df -h . | tail -1 | awk '{print $4}')"
echo ""

echo "🔧 Node.js Environment:"
echo "  - Node version: $(node --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "  - npm version: $(npm --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "  - pnpm version: $(pnpm --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "  - Package manager in package.json: $(cat package.json | grep packageManager || echo 'not specified')"
echo ""

echo "📦 Package.json Configuration Analysis:"
if [ -f "package.json" ]; then
  echo "  - Dependencies count: $(cat package.json | jq '.dependencies | length' 2>/dev/null || echo 'N/A')"
  echo "  - DevDependencies count: $(cat package.json | jq '.devDependencies | length' 2>/dev/null || echo 'N/A')"
  echo "  - Overrides count: $(cat package.json | jq '.pnpm.overrides | length' 2>/dev/null || echo '0')"
  echo "  - onlyBuiltDependencies count: $(cat package.json | jq '.pnpm.onlyBuiltDependencies | length' 2>/dev/null || echo '0')"
  echo ""
  
  echo "  🔍 Checking for common problematic dependencies..."
  PROBLEMATIC_DEPS=("sharp" "better-sqlite3" "node-seal" "esbuild" "canvas" "node-gyp")
  for dep in "${PROBLEMATIC_DEPS[@]}"; do
    if grep -q "\"$dep\"" package.json; then
      VERSION=$(cat package.json | jq -r ".dependencies.\"$dep\" // .devDependencies.\"$dep\" // \"not found\"")
      echo "    ⚠️  Found: $dep@$VERSION (requires native compilation)"
    fi
  done
else
  echo "  ❌ package.json not found!"
fi
echo ""

echo "🔒 Lockfile Status:"
if [ -f "pnpm-lock.yaml" ]; then
  echo "  ✅ pnpm-lock.yaml exists"
  echo "  - Size: $(du -h pnpm-lock.yaml | cut -f1)"
  echo "  - Last modified: $(stat -c %y pnpm-lock.yaml 2>/dev/null || stat -f %Sm pnpm-lock.yaml 2>/dev/null || echo 'N/A')"
  
  # Check lockfile version
  LOCKFILE_VERSION=$(head -1 pnpm-lock.yaml 2>/dev/null || echo "unknown")
  echo "  - Lockfile version: $LOCKFILE_VERSION"
else
  echo "  ❌ pnpm-lock.yaml NOT FOUND!"
fi
echo ""

echo "🌐 Network Connectivity:"
echo "  - Testing npm registry..."
if ping -c 1 registry.npmjs.org >/dev/null 2>&1; then
  echo "    ✅ registry.npmjs.org reachable"
else
  echo "    ❌ registry.npmjs.org UNREACHABLE"
fi

if command -v curl >/dev/null 2>&1; then
  echo "  - Testing HTTPS connection to registry..."
  if curl -s --max-time 5 https://registry.npmjs.org/ >/dev/null 2>&1; then
    echo "    ✅ HTTPS connection successful"
  else
    echo "    ❌ HTTPS connection FAILED"
  fi
fi
echo ""

echo "📂 pnpm Store Information:"
if command -v pnpm >/dev/null 2>&1; then
  echo "  - Store path: $(pnpm store path 2>/dev/null || echo 'N/A')"
  if [ -d "$(pnpm store path 2>/dev/null)" ]; then
    echo "  - Store size: $(du -sh "$(pnpm store path 2>/dev/null)" | cut -f1)"
  fi
else
  echo "  ⚠️  pnpm not installed"
fi
echo ""

echo "🗂️ node_modules Status:"
if [ -d "node_modules" ]; then
  echo "  ✅ node_modules exists"
  echo "  - Size: $(du -sh node_modules | cut -f1)"
  echo "  - Package count: $(find node_modules -maxdepth 1 -type d | wc -l)"
else
  echo "  ℹ️  node_modules not found (clean state)"
fi
echo ""

echo "🔐 Git Configuration (for git dependencies):"
git config --list | grep -E "(http|pack|lfs|credential)" || echo "  ℹ️  No relevant git config found"
echo ""

echo "💡 Recommended Actions:"
echo "  1. Ensure Node $(grep -oP '\"node\": \">=\K[0-9.]+' package.json || echo '24') is installed"
echo "  2. Ensure pnpm $(grep -oP 'pnpm@\K[0-9.]+' package.json || echo '10.28.0') is installed"
echo "  3. Clear pnpm cache: pnpm store prune"
echo "  4. Remove node_modules: rm -rf node_modules"
echo "  5. Try: pnpm install --no-frozen-lockfile"
echo "  6. If network issues persist, check firewall/proxy settings"
echo ""

echo "✅ Diagnostics complete!"
