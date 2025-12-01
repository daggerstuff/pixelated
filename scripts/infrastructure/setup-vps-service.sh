#!/bin/bash
# Setup script for OCI Instance Creator Service on VPS

set -e

echo "🚀 Setting up OCI Instance Creator Service..."

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y jq curl
elif command -v yum &> /dev/null; then
    yum install -y jq curl
fi

# Install OCI CLI if not present
if ! command -v oci &> /dev/null; then
    echo "☁️  Installing OCI CLI..."
    bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)" -- --accept-all-defaults
fi

# Copy script
echo "📜 Installing script..."
cp create-a1-flex-instance.sh /usr/local/bin/
chmod +x /usr/local/bin/create-a1-flex-instance.sh

# Copy service
echo "⚙️  Installing systemd service..."
cp oci-instance-creator.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable and start service
echo "✅ Enabling and starting service..."
systemctl enable oci-instance-creator.service
systemctl start oci-instance-creator.service

echo "🎉 Setup complete! Check status with: systemctl status oci-instance-creator.service"
echo "📝 Logs are at: /var/log/oci-instance-creator.log"
echo "⚠️  IMPORTANT: Make sure you have configured OCI CLI with 'oci setup config' or copied your ~/.oci directory to /root/.oci"
