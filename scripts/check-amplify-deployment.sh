#!/bin/bash

# Script to verify Amplify deployment structure
set -e

echo "🔍 Checking Amplify deployment structure..."

# Check if .amplify-hosting directory exists
if [ ! -d ".amplify-hosting" ]; then
  echo "❌ ERROR: .amplify-hosting directory not found"
  exit 1
fi

# Check for compute directory
if [ ! -d ".amplify-hosting/compute" ]; then
  echo "❌ ERROR: .amplify-hosting/compute directory not found"
  exit 1
fi

# Check for compute/default directory
if [ ! -d ".amplify-hosting/compute/default" ]; then
  echo "❌ ERROR: .amplify-hosting/compute/default directory not found"
  exit 1
fi

# Check for node_modules in compute/default
if [ ! -d ".amplify-hosting/compute/default/node_modules" ]; then
  echo "❌ ERROR: node_modules not found in compute/default"
  exit 1
fi

# Check for React in node_modules
if [ ! -d ".amplify-hosting/compute/default/node_modules/react" ]; then
  echo "❌ ERROR: React not found in node_modules"
  exit 1
fi

# Check for deploy-manifest.json
if [ ! -f ".amplify-hosting/deploy-manifest.json" ]; then
  echo "❌ ERROR: deploy-manifest.json not found"
  exit 1
fi

# Check for static directory
if [ ! -d ".amplify-hosting/static" ]; then
  echo "❌ ERROR: static directory not found"
  exit 1
fi

# Check for health.json
if [ ! -f ".amplify-hosting/static/health.json" ]; then
  echo "❌ ERROR: health.json not found"
  exit 1
fi

# Check for .env file in compute/default
if [ ! -f ".amplify-hosting/compute/default/.env" ]; then
  echo "❌ ERROR: .env file not found in compute/default"
  exit 1
fi

# Check for entry point file
if [ ! -f ".amplify-hosting/server/entry.mjs" ]; then
  echo "❌ WARNING: entry.mjs not found in server directory"
  echo "  Looking for alternative entry points..."
  find .amplify-hosting/server -name "*.mjs" | head -n 5
fi

echo "✅ All checks passed! Deployment structure looks good."
echo "📦 Deployment artifacts:"
du -sh .amplify-hosting/
du -sh .amplify-hosting/compute/default/
du -sh .amplify-hosting/static/

echo "🚀 Ready for deployment!"