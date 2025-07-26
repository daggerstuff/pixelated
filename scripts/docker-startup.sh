#!/bin/bash
set -e

echo "🚀 Starting Pixelated container..."
echo "📋 Environment check:"
echo "  Node version: $(node --version)"
echo "  pnpm version: $(pnpm --version)"
echo "  Working directory: $(pwd)"
echo "  User: $(whoami)"
echo "  PATH: ${PATH}"

echo "🔍 Checking critical files:"
if ! ls -la dist/server/entry.mjs; then
	echo "❌ Server entry missing"
fi
ls -la scripts/start-server.js || echo "❌ Start script missing"
ls -la package.json || echo "❌ Package.json missing"

echo "🔧 Binary availability check:"
echo "  Standard binary check:"
which pnpm && echo "     ✅ pnpm found at: $(which pnpm)" || echo "     ❌ pnpm not found"
which astro && echo "     ✅ astro found at: $(which astro)" || echo "     ❌ astro not in PATH"
ls -la /app/node_modules/.bin/astro && echo "     ✅ astro binary exists in node_modules" || echo "     ❌ astro missing from node_modules"
ls -la /opt/bitnami/node/bin/pnpm && echo "     ✅ global pnpm exists" || echo "     ❌ global pnpm missing"

echo "📦 Available scripts in package.json:"
node -e "const pkg = require('./package.json'); console.log(Object.keys(pkg.scripts).join(', '))" || echo "❌ Cannot read scripts"

echo "🔧 Ensuring proper PATH and starting application..."
export PATH="/opt/bitnami/node/bin:/app/node_modules/.bin:${PATH}"
echo "  Final PATH: ${PATH}"

echo "✅ Final binary verification:"
which astro && echo "   ✅ astro available at: $(which astro)" || echo "   ❌ astro still not found!"
which pnpm && echo "   ✅ pnpm available at: $(which pnpm)" || echo "   ❌ pnpm still not found!"

echo "🚀 Attempting startup with error output enabled..."

# Check if we can run the startup fallback if main approach fails
if ! command -v astro >/dev/null 2>&1; then
	echo "⚠️ astro command not available, trying fallback approach..."
	if [[ -f "/app/startup-fallback.sh" ]]; then
		echo "🔄 Executing startup fallback script..."
		exec /app/startup-fallback.sh
	else
		echo "⚠️ Fallback script not found, continuing with main approach..."
	fi
fi

echo "📁 Ensuring .astro directory exists with proper permissions..."
mkdir -p /app/.astro && chmod -R 755 /app/.astro

echo "🔧 Setting up environment variables for Azure App Service..."
export PORT=${WEBSITES_PORT:-${PORT:-4321}}
export HOST=${HOST:-0.0.0.0}
export NODE_ENV=${NODE_ENV:-production}
echo "  Final PORT: ${PORT}"
echo "  Final HOST: ${HOST}"
echo "  Final NODE_ENV: ${NODE_ENV}"

echo "🚀 Starting application with node scripts/start-server.js..."
exec node scripts/start-server.js
