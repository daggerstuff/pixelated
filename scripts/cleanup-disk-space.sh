#!/bin/bash

# Azure DevOps Agent Disk Space Cleanup Script
# This script aggressively cleans up disk space on build agents

set -e

echo "=== Azure DevOps Agent Disk Space Cleanup ==="
echo "Starting disk space cleanup at $(date)"

# Check initial disk usage
echo "Initial disk usage:"
df -h /

# Stop the script if disk usage is below 80%
DISK_USAGE=$(df / | awk 'END{print $(NF-1)}' | sed 's/%//')
echo "Current disk usage: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -lt 80 ]; then
    echo "Disk usage is below 80%, cleanup may not be necessary"
    echo "Proceeding with light cleanup only..."
    AGGRESSIVE_CLEANUP=false
else
    echo "Disk usage is high (${DISK_USAGE}%), performing aggressive cleanup..."
    AGGRESSIVE_CLEANUP=true
fi

# Clean Docker system
echo "Cleaning Docker system..."
docker system prune -af --volumes || true
docker builder prune -af || true

# Clean package managers
echo "Cleaning package managers..."
if command -v apt-get &> /dev/null; then
    sudo apt-get clean || true
    sudo apt-get autoclean || true
    sudo rm -rf /var/cache/apt/archives/* || true
fi

if command -v yum &> /dev/null; then
    sudo yum clean all || true
fi

# Clean conda environments if aggressive cleanup is needed
if [ "$AGGRESSIVE_CLEANUP" = true ] && [ -d "/home/vivi/miniconda3" ]; then
    echo "Cleaning conda cache..."
    /home/vivi/miniconda3/bin/conda clean --all -y || true
fi

# Clean npm cache
if command -v npm &> /dev/null; then
    echo "Cleaning npm cache..."
    npm cache clean --force || true
fi

# Clean pnpm cache
if command -v pnpm &> /dev/null; then
    echo "Cleaning pnpm cache..."
    pnpm store prune || true
fi

# Clean temporary files
echo "Cleaning temporary files..."
sudo rm -rf /tmp/* || true
sudo rm -rf /var/tmp/* || true

# Clean log files older than 7 days
echo "Cleaning old log files..."
sudo find /var/log -name "*.log" -type f -mtime +7 -delete || true
sudo find /var/log -name "*.gz" -type f -mtime +7 -delete || true

# Clean Azure DevOps agent work directories if aggressive cleanup
if [ "$AGGRESSIVE_CLEANUP" = true ]; then
    echo "Cleaning Azure DevOps agent work directories..."
    if [ -d "/home/vivi/myagent/_work" ]; then
        # Keep only the most recent 2 builds
        find /home/vivi/myagent/_work -maxdepth 1 -type d -name "[0-9]*" -print0 | \
        xargs -0 ls -dt | tail -n +3 | xargs rm -rf || true
    fi
fi

# Clean journald logs older than 3 days
if [ "$AGGRESSIVE_CLEANUP" = true ]; then
    echo "Cleaning system journal logs..."
    sudo journalctl --vacuum-time=3d || true
fi

# Clean pip cache
if [ -d "$HOME/.cache/pip" ]; then
    echo "Cleaning pip cache..."
    rm -rf $HOME/.cache/pip/* || true
fi

# Clean Azure CLI cache
if [ -d "$HOME/.azure" ]; then
    echo "Cleaning Azure CLI cache..."
    rm -rf $HOME/.azure/logs/* || true
    rm -rf $HOME/.azure/telemetry/* || true
fi

# Final disk usage check
echo "Final disk usage:"
df -h /

FINAL_DISK_USAGE=$(df / | awk 'END{print $(NF-1)}' | sed 's/%//')
echo "Disk usage after cleanup: ${FINAL_DISK_USAGE}%"

SPACE_FREED=$((DISK_USAGE - FINAL_DISK_USAGE))
echo "Space freed: ${SPACE_FREED}%"

if [ "$FINAL_DISK_USAGE" -gt 90 ]; then
    echo "##[warning]Disk usage is still high: ${FINAL_DISK_USAGE}%"
    echo "Consider manually cleaning additional files or expanding disk space"
    exit 1
else
    echo "✅ Disk cleanup completed successfully"
    echo "Cleanup completed at $(date)"
fi
