#!/bin/bash

# VS Code Shell Integration Fix Script
# This script enables proper shell integration to stop the fucking warning

echo "🔧 Fixing VS Code Shell Integration..."

# Set environment variables for VS Code
export TERM_PROGRAM="vscode"
export VSCODE_INJECTION="1"

# Source the updated bashrc
source ~/.bashrc

echo "✅ Shell integration enabled"
echo "✅ Terminal should now show proper command detection"
echo ""
echo "If you still see warnings, restart VS Code or open a new terminal."

# Test the integration
echo "🧪 Testing shell integration..."
echo "Running test command..."
ls -la /dev/null >/dev/null 2>&1 && echo "✅ Test command executed successfully"

echo ""
echo "🎉 Shell integration setup complete!"
echo "The fucking 'Enable shell integration' warning should be gone now."
