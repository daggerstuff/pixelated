#!/bin/bash
# Helper script to fix GitHub auth and mark PR comments as resolved
# Run this in your terminal (not via the AI assistant)

set -e

echo "🔧 Fixing GitHub CLI authentication..."
echo ""

# Step 1: Clear any GITHUB_TOKEN from environment and remove problematic aliases
unset GITHUB_TOKEN GH_TOKEN G_TOKEN
export -n GITHUB_TOKEN GH_TOKEN G_TOKEN 2>/dev/null || true

# Remove 1Password plugin alias if it exists (it sets invalid GITHUB_TOKEN)
if alias gh 2>/dev/null | grep -q "op plugin run"; then
  echo "⚠️  Removing 1Password plugin alias for 'gh' (it sets invalid GITHUB_TOKEN)"
  unalias gh 2>/dev/null || true
fi

echo "✅ Environment variables cleared"
echo ""

# Step 2: Check current auth status
echo "📋 Current authentication status:"
gh auth status 2>&1 | grep -A 5 "github.com" || true
echo ""

# Step 3: If needed, refresh or login
if ! gh pr view 147 --json number &>/dev/null; then
    echo "⚠️  Not authenticated or token invalid. Refreshing..."
    gh auth refresh -h github.com -s repo,write:discussion
    echo ""
fi

# Step 4: Test access
echo "🧪 Testing GitHub CLI access..."
if gh pr view 147 --json number &>/dev/null; then
    echo "✅ Authentication successful!"
    echo ""
    
    # Step 5: Mark comments as resolved
    echo "📝 Marking PR comments as resolved..."
    ./scripts/mark-pr-comments-resolved.sh
else
    echo "❌ Still not authenticated. Please run manually:"
    echo "   gh auth login"
    echo "   Then run: ./scripts/mark-pr-comments-resolved.sh"
fi

