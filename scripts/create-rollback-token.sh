#!/bin/bash

# Script to guide creation of Personal Access Token for rollback workflow
# This script provides the correct CLI commands and guidance for manual token creation

set -e

echo "🔧 Personal Access Token Setup for Rollback Workflow"
echo "=================================================="

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "❌ You are not authenticated with GitHub CLI. Please run:"
    echo "   gh auth login"
    exit 1
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📁 Repository: $REPO"

echo ""
echo "ℹ️  IMPORTANT: GitHub CLI cannot create Personal Access Tokens directly."
echo "   This is a security feature - tokens must be created through the web interface."
echo ""

# Generate a unique token name
TOKEN_NAME="rollback-workflow-$(date +%Y%m%d-%H%M%S)"
SCOPES="repo,workflow"
EXPIRATION_DAYS=90

echo "📝 Token Configuration:"
echo "  - Suggested Name: $TOKEN_NAME"
echo "  - Required Scopes: $SCOPES"
echo "  - Recommended Expiration: $EXPIRATION_DAYS days"
echo ""

# Open the token creation page
echo "🌐 Opening GitHub token creation page..."
gh auth token --help > /dev/null 2>&1 || echo "Opening browser to token creation page..."

# Provide the direct URL and instructions
TOKEN_URL="https://github.com/settings/tokens/new"
echo "👉 Please create your token at: $TOKEN_URL"
echo ""
echo "📋 Step-by-step instructions:"
echo "1. Click the link above or run: open $TOKEN_URL"
echo "2. Set Token name: $TOKEN_NAME"
echo "3. Set Expiration: $EXPIRATION_DAYS days (or your preferred duration)"
echo "4. Select these scopes:"
echo "   - ✅ repo (Full control of private repositories)"
echo "   - ✅ workflow (Update GitHub Action workflows)"
echo "5. Click 'Generate token' at the bottom"
echo "6. Copy the generated token (you won't see it again!)"
echo ""

# Ask if user wants to open the URL automatically
read -p "Open the token creation page in your browser? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "$TOKEN_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$TOKEN_URL"
    else
        echo "⚠️  Could not open browser automatically. Please visit: $TOKEN_URL"
    fi
fi

echo ""
echo "⏳ Waiting for you to create the token..."
echo "Press Enter when you have copied your token..."
read -r

echo ""
echo "🔐 Now let's add the token as a repository secret..."
echo ""

# Get the token from user
read -sp "Paste your Personal Access Token here: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ No token provided. Setup cancelled."
    echo "You can add the token later by running:"
    echo "  gh secret set PERSONAL_ACCESS_TOKEN --body \"YOUR_TOKEN_HERE\" --repo \"$REPO\""
    exit 1
fi

# Add as repository secret
echo "Adding token as repository secret..."
if gh secret set PERSONAL_ACCESS_TOKEN --body "$TOKEN" --repo "$REPO"; then
    echo "✅ Token successfully added as PERSONAL_ACCESS_TOKEN secret!"
    echo ""
    echo "🎉 Setup complete! The rollback workflow will now use this token."
    echo ""
    echo "📋 Summary:"
    echo "  - Token created: $TOKEN_NAME"
    echo "  - Repository secret: PERSONAL_ACCESS_TOKEN"
    echo "  - Repository: $REPO"
    echo ""
    echo "🔄 Remember to rotate this token before it expires!"
    echo "   Set a reminder for $(date -d "+$EXPIRATION_DAYS days" -Iseconds)"
else
    echo "❌ Failed to add token as repository secret."
    echo "Please add it manually by running:"
    echo "  gh secret set PERSONAL_ACCESS_TOKEN --body \"$TOKEN\" --repo \"$REPO\""
    echo ""
    echo "Or visit: https://github.com/$REPO/settings/secrets/actions"
fi