#!/usr/bin/env bash
# Install Struct CLI Bridge
# Run this script to install the Struct CLI for "Open in Agent" functionality

set -euo pipefail

echo "🔧 Installing Struct CLI Bridge..."

# Check if struct CLI is available on npm
if npm view @struct/cli version >/dev/null 2>&1; then
    echo "📦 Installing @struct/cli from npm..."
    npm install -g @struct/cli
else
    echo "⚠️  @struct/cli not found on public npm registry."
    echo "   This package may be private or hosted on a different registry."
    echo ""
    echo "   Options:"
    echo "   1. Check if you have access to a private npm registry"
    echo "   2. Download from Struct dashboard: https://app.struct.ai/settings/cli"
    echo "   3. Contact Struct support for installation instructions"
    echo ""
    echo "   For now, skipping CLI installation."
    exit 0
fi

# Install the bridge
echo "🌉 Installing Struct bridge..."
struct bridge install

echo "✅ Struct CLI Bridge installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Run 'struct login' to authenticate"
echo "  2. Test with 'struct --version'"
echo "  3. The 'Open in Claude Code/Cursor' buttons in Struct web app will now work"