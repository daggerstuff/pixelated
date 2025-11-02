#!/bin/bash

# Quick setup for rollback workflow token - CLI-focused approach
# This script helps add an existing token as a repository secret

set -e

echo "🚀 Quick Setup: Rollback Workflow Token"
echo "======================================"

# Check prerequisites
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Install from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated. Run: gh auth login"
    exit 1
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📁 Repository: $REPO"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [ -z "$REPO" ]; then
    echo "⚠️ Could not determine repository automatically."
    echo "Please run this script from inside the cloned repository or set REPO=owner/repo and re-run."
    echo "Example: export REPO=pixelatedempathy/pixelated"
    exit 1
fi
echo "📁 Repository: $REPO"

echo ""
echo "ℹ️  To complete this setup, you need a Personal Access Token."
echo ""
echo "📝 Required token scopes:"
echo "  - repo (Full control of private repositories)"
echo "  - workflow (Update GitHub Action workflows)"
echo ""

# Provide the direct URL
TOKEN_URL="https://github.com/settings/tokens/new"
echo "👉 Create your token at: $TOKEN_URL"
echo ""

# Ask if user wants to open the URL
read -p "Open token creation page in browser? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "$TOKEN_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$TOKEN_URL"
    else
        echo "⚠️  Could not open browser. Please visit: $TOKEN_URL"
    fi
fi

echo ""
echo "⏳ Waiting for you to create the token..."
echo "After creating the token, copy it and press Enter to continue..."
read -r

echo ""
echo "🔐 Now let's add the token as a repository secret..."
echo ""

# Get the token from user
read -sp "Paste your Personal Access Token here: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ No token provided."
    echo "You can add the token later by running:"
    echo "  gh secret set PERSONAL_ACCESS_TOKEN --body \"YOUR_TOKEN_HERE\" --repo \"$REPO\""
    exit 1
fi

# Add as repository secret
echo "Adding token as repository secret..."
if ! gh secret set PERSONAL_ACCESS_TOKEN --body "$TOKEN" --repo "$REPO"; then
    RC=$?
    echo "❌ Failed to add token as repository secret (exit code: $RC)."
    echo "Possible causes: you are authenticated as a different user, or you lack admin/maintainer permissions on the repository." 
    echo "Please check 'gh auth status' and that your account has permission to create repository secrets for $REPO."
    echo "You can also add the secret via the web UI: https://github.com/$REPO/settings/secrets/actions"
    exit $RC
fi

echo "✅ Token successfully added as PERSONAL_ACCESS_TOKEN secret!"
echo ""
echo "🎉 Setup complete! The rollback workflow will now use this token."
echo ""
echo "📋 Next steps:"
echo "  1. Test the rollback workflow by pushing to staging/master branch"
echo "  2. Monitor the workflow to ensure it completes successfully"
echo ""
echo "🔄 Remember to rotate this token before it expires!"
exit 0