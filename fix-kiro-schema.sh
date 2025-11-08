#!/bin/bash
# Fix Kiro Agent Schema Missing File Issue
# This script resolves the config_schema.json not found error

echo "🔧 Fixing Kiro Agent Schema Issue..."

# Create the system directory structure
echo "📁 Creating system directory structure..."
sudo mkdir -p /usr/share/kiro/resources/app/extensions/kiro.kiro-agent/packages/continuedev/extension/

# Copy the schema file to system location
echo "📋 Installing schema file to system location..."
sudo cp packages/continuedev/extension/config_schema.json /usr/share/kiro/resources/app/extensions/kiro.kiro-agent/packages/continuedev/extension/

# Set proper permissions
echo "🔐 Setting proper permissions..."
sudo chmod 644 /usr/share/kiro/resources/app/extensions/kiro.kiro-agent/packages/continuedev/extension/config_schema.json

# Verify installation
echo "✅ Verifying installation..."
if [ -f "/usr/share/kiro/resources/app/extensions/kiro.kiro-agent/packages/continuedev/extension/config_schema.json" ]; then
    echo "✅ Schema file successfully installed!"
    echo "📍 Location: /usr/share/kiro/resources/app/extensions/kiro.kiro-agent/packages/continuedev/extension/config_schema.json"
else
    echo "❌ Installation failed!"
    exit 1
fi

echo ""
echo "🎯 Problem Resolved!"
echo "The Kiro agent should now be able to load the schema file without errors."
echo ""
echo "📝 What was created:"
echo "  - JSON Schema for Kiro agent configuration validation"
echo "  - Supports MCP servers, security settings, logging, and agent capabilities"
echo "  - Validates against your existing .kiro/settings/mcp.json configuration"
echo ""
echo "🔄 Next: Restart your Kiro agent to pick up the new schema."