#!/bin/bash
set -e

# Configuration
PROJECT_ROOT="$(pwd)"
SAFETY_NET_DIR="$PROJECT_ROOT/.agent/safety-net"
BACKUP_GIT_DIR="$SAFETY_NET_DIR/backup.git"

# Check if a remote URL was provided
REMOTE_URL="$1"

if [ -z "$REMOTE_URL" ]; then
    echo "Usage: $0 <git-remote-url>"
    echo "Example: $0 git@github.com:username/my-private-repo.git"
    exit 1
fi

echo "--- Setting up Safety Net on $(hostname) ---"

# Step 1: Ensure executable permissions
chmod +x "$SAFETY_NET_DIR/install-cron.sh"
chmod +x "$SAFETY_NET_DIR/safety-net-backup.sh"

# Step 2: Install the Cron Job
echo "1. Installing Cron Job..."
"$SAFETY_NET_DIR/install-cron.sh"

# Step 3: Initialize the Backup Repo (by running the backup script once)
echo "2. Initializing Backup Repository..."
"$SAFETY_NET_DIR/safety-net-backup.sh"

# Step 4: Configure the Remote
echo "3. Configuring Remote: $REMOTE_URL"

# Check if remote 'origin' already exists
if git --git-dir="$BACKUP_GIT_DIR" remote | grep -q origin; then
    echo "   Remote 'origin' already exists. Updating URL..."
    git --git-dir="$BACKUP_GIT_DIR" remote set-url origin "$REMOTE_URL"
else
    git --git-dir="$BACKUP_GIT_DIR" remote add origin "$REMOTE_URL"
fi

# Configure fetch to get ALL branches (so we see other servers)
git --git-dir="$BACKUP_GIT_DIR" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"

echo "4. Fetching existing backups from remote..."
git --git-dir="$BACKUP_GIT_DIR" fetch origin || echo "   (Fetch failed - maybe repo is empty? That's fine.)"

echo ""
echo "✅ Safety Net Setup Complete for $(hostname)!"
echo "   - Local tracking initialized."
echo "   - Cron job active (every 4 hours)."
echo "   - Remote linked to $REMOTE_URL."
echo "   - You are posting to branch: backup/$(hostname)"
