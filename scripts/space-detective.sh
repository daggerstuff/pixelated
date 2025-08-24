#!/bin/bash

set -euo pipefail

echo "🔍 SPACE DETECTIVE - Finding what's eating your 150GB ON VPS"
echo "============================================================="

echo -e "\n📊 OVERALL DISK USAGE:"
df -h

echo -e "\n🗂️  TOP 20 LARGEST DIRECTORIES ON SYSTEM:"
du -h --max-depth=2 / 2>/dev/null | sort -hr | head -20

echo -e "\n🐳 DOCKER SPACE BREAKDOWN:"
docker system df -v 2>/dev/null || echo "Docker not running or accessible"

echo -e "\n📦 DOCKER IMAGES DETAILED:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>/dev/null || echo "No Docker images"

echo -e "\n🗃️  DOCKER VOLUMES:"
docker volume ls -q | xargs docker volume inspect --format '{{ .Name }}: {{ .Mountpoint }}' 2>/dev/null | while read line; do
    name=$(echo "$line" | cut -d: -f1)
    path=$(echo "$line" | cut -d: -f2-)
    size=$(sudo du -sh "$path" 2>/dev/null | cut -f1 || echo "N/A")
    echo "$name: $size"
done || echo "No Docker volumes or permission denied"

echo -e "\n🏗️  DOCKER BUILD CACHE:"
docker builder du 2>/dev/null || echo "No build cache info available"

echo -e "\n📁 LARGEST FILES ON SYSTEM (>1GB):"
sudo find / -type f -size +1G -exec ls -lh {} \; 2>/dev/null | head -10 || echo "No large files found or permission denied"

echo -e "\n🗄️  LOG FILES:"
sudo find /var/log -type f -size +100M -exec ls -lh {} \; 2>/dev/null || echo "No large log files"

echo -e "\n💾 TEMP DIRECTORIES:"
echo "/tmp usage:"
sudo du -sh /tmp/* 2>/dev/null | sort -hr | head -10 || echo "Empty or permission denied"
echo "/var/tmp usage:"
sudo du -sh /var/tmp/* 2>/dev/null | sort -hr | head -10 || echo "Empty or permission denied"

echo -e "\n🏠 HOME DIRECTORIES:"
sudo du -sh /home/* 2>/dev/null | sort -hr || echo "No home directories or permission denied"

echo -e "\n🔧 PACKAGE MANAGER CACHES:"
echo "APT cache:"
sudo du -sh /var/cache/apt 2>/dev/null || echo "N/A"
echo "NPM cache:"
du -sh ~/.npm 2>/dev/null || echo "N/A"
echo "PNPM store:"
du -sh ~/.local/share/pnpm 2>/dev/null || echo "N/A"

echo -e "\n🐍 PYTHON CACHES:"
find ~ -name "__pycache__" -type d -exec du -sh {} \; 2>/dev/null | head -10 || echo "No Python caches found"

echo -e "\n🎯 CURRENT DIRECTORY BREAKDOWN:"
echo "Current directory: $(pwd)"
du -sh ./* 2>/dev/null | sort -hr | head -20

echo -e "\n🚨 POTENTIAL CULPRITS:"
echo "Checking for common space hogs..."

# Check for Docker overlay2 storage
if [ -d "/var/lib/docker/overlay2" ]; then
    echo "Docker overlay2 storage: $(sudo du -sh /var/lib/docker/overlay2 2>/dev/null | cut -f1)"
fi

# Check for systemd journals
if [ -d "/var/log/journal" ]; then
    echo "Systemd journals: $(sudo du -sh /var/log/journal 2>/dev/null | cut -f1)"
fi

# Check for core dumps
echo "Core dumps in /var/crash: $(sudo du -sh /var/crash 2>/dev/null | cut -f1 || echo 'N/A')"

# Check for swap files
echo "Swap files:"
sudo find / -name "*.swap" -o -name "swapfile" -exec ls -lh {} \; 2>/dev/null || echo "No swap files found"

echo -e "\n💡 RECOMMENDATIONS:"
echo "Based on the above, look for:"
echo "1. Huge Docker overlay2 directories"
echo "2. Massive log files in /var/log"
echo "3. Large files in /tmp or /var/tmp"
echo "4. Bloated package manager caches"
echo "5. Core dumps or swap files"
echo "6. Multiple Docker image layers"