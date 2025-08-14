#!/bin/bash

# Generate SSH RSA key for Azure
# This script creates a new SSH RSA key pair for Azure services

set -e

# Configuration
KEY_NAME="azure_key"
KEY_DIR="$HOME/.ssh"
KEY_PATH="$KEY_DIR/$KEY_NAME"
COMMENT="azure-$(date +%Y%m%d)"

echo "🔑 Generating new SSH RSA key for Azure..."
echo "📁 Key will be saved to: $KEY_PATH"

# Create .ssh directory if it doesn't exist
mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"

# Generate the SSH key
ssh-keygen -t rsa -b 4096 -f "$KEY_PATH" -C "$COMMENT" -N ""

# Set proper permissions
chmod 600 "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"

echo ""
echo "✅ SSH key generated successfully!"
echo ""
echo "📋 Public key (add this to Azure):"
echo "=================================="
cat "$KEY_PATH.pub"
echo ""
echo "🔐 Private key location: $KEY_PATH"
echo "📄 Public key location: $KEY_PATH.pub"
echo ""
echo "💡 To add this key to Azure:"
echo "   1. Copy the public key above"
echo "   2. Go to Azure Portal > Virtual Machines > Your VM > Settings > SSH public keys"
echo "   3. Add the public key"
echo ""
echo "🔧 To use this key with SSH:"
echo "   ssh -i $KEY_PATH username@your-azure-vm-ip"
echo ""
echo "📝 To add to SSH config for easier access:"
echo "   Add to ~/.ssh/config:"
echo "   Host azure-vm"
echo "     HostName your-azure-vm-ip"
echo "     User your-username"
echo "     IdentityFile $KEY_PATH"
