#!/bin/bash

# TypeScript TSServer Crash Fix Script
# This script helps manage TypeScript configuration to prevent TSServer crashes

set -e

echo "🔧 TypeScript TSServer Fix Script"
echo "=================================="

case "${1:-help}" in
  "stable")
    echo "🔄 Switching to stable TypeScript configuration..."
    cp tsconfig.json tsconfig.json.backup
    cp tsconfig.stable.json tsconfig.json
    echo "✅ Switched to stable configuration"
    echo "📝 Key changes:"
    echo "   - Disabled noUnusedLocals and noUnusedParameters"
    echo "   - Disabled noUncheckedIndexedAccess"
    echo "   - Disabled noPropertyAccessFromIndexSignature"
    echo "   - Enabled skipLibCheck"
    echo "   - Enabled incremental compilation"
    echo "   - Reduced watch scope"
    ;;

  "original")
    echo "🔄 Restoring original TypeScript configuration..."
    if [ -f "tsconfig.json.backup" ]; then
      cp tsconfig.json.backup tsconfig.json
      echo "✅ Restored original configuration"
    else
      echo "❌ No backup found. Cannot restore original configuration."
      exit 1
    fi
    ;;

  "clean")
    echo "🧹 Cleaning TypeScript cache and build artifacts..."
    rm -rf .tsbuildinfo
    rm -rf node_modules/.cache
    rm -rf node_modules/.vite
    rm -rf node_modules/.astro
    echo "✅ Cleaned TypeScript cache"
    ;;

  "restart")
    echo "🔄 Restarting TypeScript language server..."
    echo "📋 Please reload VS Code window:"
    echo "   - Press Ctrl+Shift+P"
    echo "   - Type 'Reload Window'"
    echo "   - Press Enter"
    ;;

  "diagnose")
    echo "🔍 Diagnosing TypeScript configuration..."
    echo "📊 Current configuration analysis:"

    if [ -f "tsconfig.json" ]; then
      echo "✅ tsconfig.json exists"

      # Check for problematic settings
      if grep -q '"skipLibCheck": false' tsconfig.json; then
        echo "⚠️  skipLibCheck is disabled - this can cause memory issues"
      fi

      if grep -q '"noUnusedLocals": true' tsconfig.json; then
        echo "⚠️  noUnusedLocals is enabled - this can cause performance issues"
      fi

      if grep -q '"noUnusedParameters": true' tsconfig.json; then
        echo "⚠️  noUnusedParameters is enabled - this can cause performance issues"
      fi

      if grep -q '"noUncheckedIndexedAccess": true' tsconfig.json; then
        echo "⚠️  noUncheckedIndexedAccess is enabled - this can cause performance issues"
      fi

      if grep -q '"incremental": false' tsconfig.json; then
        echo "⚠️  incremental compilation is disabled - this can cause performance issues"
      fi
    else
      echo "❌ tsconfig.json not found"
    fi

    # Check VS Code settings
    if [ -f ".vscode/settings.json" ]; then
      echo "✅ VS Code settings found"
      if grep -q '"typescript.tsserver.maxTsServerMemory"' .vscode/settings.json; then
        echo "✅ TSServer memory limit configured"
      else
        echo "⚠️  TSServer memory limit not configured"
      fi
    else
      echo "⚠️  VS Code settings not found"
    fi
    ;;

  "help"|*)
    echo "Usage: $0 {stable|original|clean|restart|diagnose|help}"
    echo ""
    echo "Commands:"
    echo "  stable    - Switch to stable TypeScript configuration (recommended)"
    echo "  original  - Restore original TypeScript configuration"
    echo "  clean     - Clean TypeScript cache and build artifacts"
    echo "  restart   - Provide instructions to restart TypeScript language server"
    echo "  diagnose  - Diagnose current TypeScript configuration issues"
    echo "  help      - Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 stable    # Switch to stable config"
    echo "  $0 clean     # Clean cache"
    echo "  $0 restart   # Get restart instructions"
    ;;
esac

echo ""
echo "🎯 Next steps:"
echo "   1. Run the command above to switch configurations"
echo "   2. Restart VS Code or reload the window"
echo "   3. Check if TSServer crashes are resolved"
echo ""
echo "💡 If crashes persist, try:"
echo "   - Running '$0 clean' to clear cache"
echo "   - Increasing VS Code memory limit"
echo "   - Disabling extensions that might conflict"
