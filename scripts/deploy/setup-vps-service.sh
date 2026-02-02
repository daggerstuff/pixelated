#!/bin/bash
# Setup script for OCI Instance Creator Service on VPS

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

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

# Check if OCI CLI is installed in /root/bin
if [ -f "/root/bin/oci" ]; then
    echo "✅ OCI CLI found in /root/bin"
    export PATH=$PATH:/root/bin
elif ! command -v oci &> /dev/null; then
    echo "☁️  Installing OCI CLI..."
    # Clean up previous partial install if it exists
    if [ -d "/root/lib/oracle-cli" ]; then
        echo "🧹 Removing existing OCI CLI directory to ensure clean install..."
        rm -rf /root/lib/oracle-cli
    fi
    
    bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)" -- --accept-all-defaults
    export PATH=$PATH:/root/bin
fi

# Create symlink to make oci available in system path (for systemd)
if [ -f "/root/bin/oci" ]; then
    echo "🔗 Creating symlink for oci in /usr/local/bin..."
    ln -sf /root/bin/oci /usr/local/bin/oci
fi

# Copy script
echo "📜 Installing script..."
if [ -f "$SCRIPT_DIR/create-a1-flex-instance.sh" ]; then
    cp "$SCRIPT_DIR/create-a1-flex-instance.sh" /usr/local/bin/
    chmod +x /usr/local/bin/create-a1-flex-instance.sh
else
    echo "❌ Could not find create-a1-flex-instance.sh in $SCRIPT_DIR"
    exit 1
fi

# Determine target user (SUDO_USER if available, else root)
TARGET_USER=${SUDO_USER:-root}
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

echo "👤 Configuring service to run as user: $TARGET_USER"

# Copy service and configure user
echo "⚙️  Installing systemd service..."
if [ -f "$SCRIPT_DIR/oci-instance-creator.service" ]; then
    cp "$SCRIPT_DIR/oci-instance-creator.service" /etc/systemd/system/
    # Replace placeholder with actual user
    sed -i "s/PLACEHOLDER_USER/$TARGET_USER/g" /etc/systemd/system/oci-instance-creator.service
else
    echo "❌ Could not find oci-instance-creator.service in $SCRIPT_DIR"
    exit 1
fi

# Setup log file permissions
LOG_FILE="/var/log/oci-instance-creator.log"
touch "$LOG_FILE"
chown "$TARGET_USER:$TARGET_USER" "$LOG_FILE"
chmod 644 "$LOG_FILE"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable and start service
echo "✅ Enabling and starting service..."
systemctl enable oci-instance-creator.service
systemctl start oci-instance-creator.service

echo "🎉 Setup complete! Check status with: systemctl status oci-instance-creator.service"
echo "📝 Logs are at: $LOG_FILE"
echo "⚠️  IMPORTANT: Make sure you have configured OCI CLI in $TARGET_HOME/.oci/config"
