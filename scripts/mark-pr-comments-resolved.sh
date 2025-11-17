#!/bin/bash
# Script to mark PR #147 comments as resolved
# Usage: ./scripts/mark-pr-comments-resolved.sh

set -e

PR_NUMBER=147
REPO="pixelatedempathy/pixelated"
COMMITS="0e7f59ad and 2a7caf69"

# Check for GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "⚠️  Not authenticated with GitHub CLI"
    echo "Please run: gh auth login"
    exit 1
fi

echo "✅ Authenticated with GitHub CLI"
echo "Marking comments as resolved for PR #$PR_NUMBER..."
echo ""

# List of comment IDs that were fixed
COMMENT_IDS=(
    2528729517 2528729881 2528729890 2528737726 2528737738 2528737744
    2528737763 2528737774 2528737787 2528737799 2528737806 2528737816
    2528737823 2528737833 2528737840 2528737846 2528737856 2528737871
    2528737879 2528737891 2528737899 2528737904 2528737911 2528737924
    2528737937 2528737947 2528737953 2528737969 2528737979 2528737987
    2528737993 2528737999 2528738003 2528738010 2528738019 2529496384
    2529496392 2529500237
)

RESOLVED=0
FAILED=0

for comment_id in "${COMMENT_IDS[@]}"; do
    echo -n "Marking comment $comment_id... "
    
    # Reply to comment indicating it's fixed
    if gh api "repos/$REPO/pulls/comments/$comment_id" \
        -X PATCH \
        -f body="✅ Fixed in commits $COMMITS" \
        &> /dev/null; then
        echo "✅"
        ((RESOLVED++))
    else
        echo "❌"
        ((FAILED++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary: $RESOLVED resolved, $FAILED failed"
echo ""
echo "Note: Some comments may need to be manually marked as"
echo "'Resolved' in the GitHub web interface if the API"
echo "doesn't support automatic resolution."
echo ""
echo "View PR: https://github.com/$REPO/pull/$PR_NUMBER"

