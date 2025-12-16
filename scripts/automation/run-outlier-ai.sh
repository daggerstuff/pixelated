#!/bin/bash

# Outlier AI Automation Runner Script
# 
# This script runs the Outlier AI automation system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Starting Outlier AI Automation System"
echo "========================================"

# Check if config exists
if [ ! -f "src/lib/automation/outlier-ai/config.ts" ]; then
  echo "❌ Configuration file not found!"
  echo "📝 Please copy config.example.ts to config.ts and fill in your credentials:"
  echo "   cp src/lib/automation/outlier-ai/config.example.ts src/lib/automation/outlier-ai/config.ts"
  exit 1
fi

# Check if we're in uv shell
if [ -z "$VIRTUAL_ENV" ] && [ -z "$UV_PROJECT_ENVIRONMENT" ]; then
  echo "⚠️  Warning: Not in uv shell environment"
  echo "💡 Consider running: uv shell"
fi

# Run the automation system
echo "🤖 Starting orchestrator..."
pnpm tsx src/lib/automation/outlier-ai/run.ts

