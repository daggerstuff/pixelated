#!/bin/bash
# Troubleshooting script for Azure CLI installation issues in Azure DevOps pipelines

echo "🔍 Azure CLI Troubleshooting Report"
echo "=================================="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"
echo ""

echo "📁 Environment Information:"
echo "PATH: $PATH"
echo "HOME: $HOME"
echo "SHELL: $SHELL"
echo ""

echo "🔍 Checking for existing Azure CLI installations:"
echo ""

# Check common installation paths
AZURE_CLI_PATHS=(
  "/usr/bin/az"
  "/usr/local/bin/az" 
  "$HOME/.local/bin/az"
  "$HOME/bin/az"
  "/opt/az/bin/az"
  "/snap/bin/az"
)

for az_path in "${AZURE_CLI_PATHS[@]}"; do
  if [ -f "$az_path" ]; then
    echo "✅ Found Azure CLI at: $az_path"
    echo "   Version: $($az_path --version 2>/dev/null | head -1 || echo 'Could not get version')"
    echo "   Permissions: $(ls -la $az_path)"
    echo ""
  else
    echo "❌ Not found: $az_path"
  fi
done

echo ""
echo "🔍 Checking which command:"
if command -v az >/dev/null 2>&1; then
  echo "✅ 'az' found via which: $(which az)"
  echo "   Version: $(az --version 2>/dev/null | head -1 || echo 'Could not get version')"
else
  echo "❌ 'az' not found via which command"
fi

echo ""
echo "🔍 Checking Python and pip:"
if command -v python3 >/dev/null 2>&1; then
  echo "✅ Python3: $(which python3)"
  echo "   Version: $(python3 --version)"
  echo "   Pip version: $(python3 -m pip --version 2>/dev/null || echo 'pip not available')"
  echo "   User site packages: $(python3 -m site --user-site 2>/dev/null || echo 'Could not determine')"
else
  echo "❌ Python3 not found"
fi

echo ""
echo "📁 Checking directories:"
echo "~/.local/bin exists: $([ -d ~/.local/bin ] && echo 'Yes' || echo 'No')"
if [ -d ~/.local/bin ]; then
  echo "   Contents: $(ls -la ~/.local/bin/ 2>/dev/null | grep -E '(az|azure)' || echo 'No Azure CLI files found')"
fi

echo "~/.local/lib exists: $([ -d ~/.local/lib ] && echo 'Yes' || echo 'No')"
if [ -d ~/.local/lib ]; then
  echo "   Azure CLI related: $(ls -la ~/.local/lib/ 2>/dev/null | grep -E '(az|azure)' || echo 'No Azure CLI files found')"
fi

echo ""
echo "🔍 Network connectivity check:"
if curl -s --head https://aka.ms/InstallAzureCLIDeb >/dev/null; then
  echo "✅ Can reach Azure CLI installation endpoint"
else
  echo "❌ Cannot reach Azure CLI installation endpoint"
fi

echo ""
echo "🔍 Permissions check:"
echo "Can write to ~/.local/bin: $([ -w ~/.local/bin ] 2>/dev/null && echo 'Yes' || echo 'No (or does not exist)')"
echo "Can execute chmod: $(command -v chmod >/dev/null && echo 'Yes' || echo 'No')"
echo "Can execute curl: $(command -v curl >/dev/null && echo 'Yes' || echo 'No')"

echo ""
echo "📋 Recommendations:"
echo "==================="

if ! command -v az >/dev/null 2>&1; then
  echo "1. Azure CLI is not installed or not in PATH"
  echo "   - Run: ./scripts/install-azure-cli-userspace.sh"
  echo "   - Ensure ~/.local/bin is in your PATH"
fi

if ! [ -d ~/.local/bin ]; then
  echo "2. ~/.local/bin directory doesn't exist"
  echo "   - Run: mkdir -p ~/.local/bin"
fi

if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo "3. ~/.local/bin is not in PATH"
  echo "   - Add: export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo ""
echo "🔧 Quick fix command:"
echo "mkdir -p ~/.local/bin && export PATH=\"\$HOME/.local/bin:\$PATH\" && ./scripts/install-azure-cli-userspace.sh"

echo ""
echo "Troubleshooting report complete."
