#!/bin/bash
# SECURITY: Remove MongoDB credentials from git history
# This script uses git-filter-repo to scrub sensitive data
set -e

echo "🔒 SECURITY REMEDIATION: Removing MongoDB credentials from git history"
echo "====================================================================="

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &>/dev/null; then
	echo "📦 Installing git-filter-repo..."
	pip install git-filter-repo
fi

# Backup current state
echo "💾 Creating backup..."
BACKUP_DIR="/tmp/pixelated-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . "${BACKUP_DIR}"
echo "✅ Backup created at: ${BACKUP_DIR}"

# Create expressions file for filtering
cat >/tmp/filter-expressions.txt <<'EOF'
# Replace the exposed MongoDB URI with a placeholder
regex:mongodb\+srv://CORE_USER:CORE_PASS@CORE_CLUSTER\.mongodb\.net/DATABASE\?retryWrites=true&w=majority&appName=APP_NAME==>mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE?retryWrites=true&w=majority&appName=APP_NAME
EOF

echo "🔍 Scanning repository for exposed credentials..."
git log --all --full-history --source -- ai-services/start-api-db.sh
echo ""

echo "⚠️  WARNING: This will rewrite git history!"
echo "   - All commit SHAs will change"
echo "   - Force push will be required to all remotes"
echo "   - Anyone with a clone will need to re-clone"
echo ""
read -p "Continue? (yes/no): " -r
if [[ ! ${REPLY} =~ ^[Yy][Ee][Ss]$ ]]; then
	echo "❌ Aborted. Backup preserved at: ${BACKUP_DIR}"
	exit 1
fi

# Run git-filter-repo
echo "🧹 Scrubbing credentials from history..."
git filter-repo --replace-text /tmp/filter-expressions.txt --force

# Re-add remotes (filter-repo removes them)
echo "🔗 Re-adding remotes..."
git remote add origin git@github.com:pixelatedempathy/pixelated.git
git remote add gitlab git@gitlab.com:ratchetaf/pixelated.git
git remote add azure git@ssh.dev.azure.com:v3/pixeljump/pixelated/pixelated
git remote add bucket git@bitbucket.org:ratchetaf/pixelated.git

echo ""
echo "✅ History scrubbed successfully!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. ROTATE MongoDB credentials immediately in Atlas"
echo "2. Review the changes: git log --oneline -10"
echo "3. Force push to all remotes:"
echo "   git push --force --all origin"
echo "   git push --force --all gitlab"
echo "   git push --force --all azure"
echo "   git push --force --all bucket"
echo "4. Notify team members to re-clone the repository"
echo "5. Check GitGuardian to confirm the alert is resolved"
echo ""
echo "⚠️  Remember: The old credentials are STILL EXPOSED in the public history"
echo "   until you rotate them in MongoDB Atlas!"
