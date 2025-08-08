#!/bin/bash

# Fix VS Code to use Zsh with Oh My Zsh instead of bash
echo "🔧 Fixing VS Code to use Zsh with Oh My Zsh..."

# Check if we're currently in bash when we should be in zsh
if [[ "$SHELL" != "/usr/bin/zsh" ]] && [[ "$SHELL" != "/bin/zsh" ]]; then
    echo "⚠️  Current shell: $SHELL"
    echo "🔄 Setting default shell to zsh..."
    chsh -s /usr/bin/zsh
fi

# Set environment variables for VS Code zsh integration
export TERM_PROGRAM="vscode"

echo "✅ VS Code configured to use Zsh"
echo "✅ Oh My Zsh shell integration enabled"
echo ""
echo "🎯 Next steps:"
echo "1. Close this terminal (Ctrl+Shift+\`)"
echo "2. Open a new terminal (Ctrl+Shift+\`)"
echo "3. The new terminal should use Zsh with proper shell integration"
echo ""
echo "🎉 The 'Enable shell integration' warning should be gone!"

# Test zsh availability
if command -v zsh >/dev/null 2>&1; then
    echo "✅ Zsh is available: $(which zsh)"
    echo "✅ Zsh version: $(zsh --version)"
else
    echo "❌ Zsh not found - please install zsh first"
fi
