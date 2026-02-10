#!/bin/bash
set -e

# Configuration
PROJECT_ROOT="/home/vivi/pixelated"
SAFETY_NET_DIR="$PROJECT_ROOT/.agent/safety-net"
BACKUP_GIT_DIR="$SAFETY_NET_DIR/backup.git"
EXCLUDES_FILE="$SAFETY_NET_DIR/rsync-exclude.txt"

# Get Hostname for unique branch
HOSTNAME=$(hostname 2>/dev/null || echo "unknown-host")
BRANCH_NAME="backup/$HOSTNAME"

# Ensure directories exist
mkdir -p "$SAFETY_NET_DIR"

# Check if EXCLUDES_FILE exists, if not create default
if [ ! -f "$EXCLUDES_FILE" ]; then
    echo "Creating default excludes file..."
    cat > "$EXCLUDES_FILE" <<EOL
.git/
.agent/safety-net/
node_modules/
dist/
venv/
.venv/
__pycache__/
.DS_Store
EOL
fi

# Initialize git backup repo if it doesn't exist (bare)
if [ ! -d "$BACKUP_GIT_DIR" ]; then
    echo "Initializing Safety Net Backup Repository..."
    git init --bare "$BACKUP_GIT_DIR"
    
    # Configure exclude file (using core.excludesfile)
    git --git-dir="$BACKUP_GIT_DIR" config core.excludesfile "$EXCLUDES_FILE"
    
    # Configure user for automated commits
    git --git-dir="$BACKUP_GIT_DIR" config user.name "Safety Net ($HOSTNAME)"
    git --git-dir="$BACKUP_GIT_DIR" config user.email "safetynet@$HOSTNAME.local"
fi

# Change to project root so paths are relative
cd "$PROJECT_ROOT"

# WE USE A STAGING AREA to convert submodules into regular files
# This is necessary because 'git add' refuses to add files inside a submodule of the main repo
# unless we break the submodule linkage.
# So we Mirror -> Staging -> Git Commit.

STAGING_DIR="$SAFETY_NET_DIR/staging"
mkdir -p "$STAGING_DIR"

echo "Syncing project to staging area (flattening submodules)..."
# We exclude .git folders so the backup repo treats everything as plain files
rsync -a --delete --exclude-from="$EXCLUDES_FILE" --exclude=".git" "$PROJECT_ROOT/" "$STAGING_DIR/"

echo "Committing staging area to backup branch..."
cd "$STAGING_DIR"

# Determine changes in the staging repo
git --git-dir="$BACKUP_GIT_DIR" --work-tree="$STAGING_DIR" add .

# Check if there are changes to commit
if git --git-dir="$BACKUP_GIT_DIR" --work-tree="$STAGING_DIR" diff --cached --quiet; then
    echo "No changes since last backup."
    
    # Even if no local changes, we should try to fetch remote updates
    if git --git-dir="$BACKUP_GIT_DIR" remote | grep -q origin; then
        echo "Fetching remote updates..."
        git --git-dir="$BACKUP_GIT_DIR" fetch origin || echo "Fetch failed (network issue?)"
    fi
    exit 0
fi

# ... Commit logic ...
DATE_STAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "Changes detected. Committing to branch $BRANCH_NAME..."
# Ensure symbolic ref is set
CURRENT_HEAD=$(git --git-dir="$BACKUP_GIT_DIR" symbolic-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_HEAD" != "refs/heads/$BRANCH_NAME" ]; then
    git --git-dir="$BACKUP_GIT_DIR" symbolic-ref HEAD "refs/heads/$BRANCH_NAME"
fi

git --git-dir="$BACKUP_GIT_DIR" --work-tree="$STAGING_DIR" commit -m "Backup: $DATE_STAMP"

echo "Backup committed successfully."

# Push / Fetch logic same as before but using BACKUP_GIT_DIR
if git --git-dir="$BACKUP_GIT_DIR" remote | grep -q origin; then
    echo "Pushing to remote origin..."
    git --git-dir="$BACKUP_GIT_DIR" push origin "$BRANCH_NAME" || echo "Push failed."
    git --git-dir="$BACKUP_GIT_DIR" fetch origin || echo "Fetch failed."
else
    echo "No remote 'origin' configured. Skipping sync."
fi

