#!/bin/bash
# Close all open Dependabot PRs so they can be recreated with grouping

set -e

echo "🔍 Finding all open Dependabot PRs..."

# Get all open PRs authored by dependabot
prs=$(gh pr list --author "app/dependabot" --state open --json number,title --jq '.[] | "\(.number)|\(.title)"')

if [ -z "$prs" ]; then
  echo "✅ No open Dependabot PRs found!"
  exit 0
fi

echo "Found the following Dependabot PRs:"
echo "$prs" | while IFS='|' read -r number title; do
  echo "  #$number: $title"
done

echo ""
read -p "Close all these PRs? (y/N): " confirm

if [[ $confirm != [yY] ]]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "🗑️  Closing PRs..."

echo "$prs" | while IFS='|' read -r number title; do
  echo "  Closing #$number..."
  gh pr close "$number" --comment "Closing to allow Dependabot to recreate with grouping configuration. See .github/dependabot.yml for new grouping settings."
done

echo ""
echo "✅ Done! All Dependabot PRs closed."
echo "💡 Dependabot will recreate them as grouped PRs on its next scheduled run."
