#!/bin/bash

echo "🔧 Fixing GitHub token references in workflow files..."

# Find all workflow files and replace G_TOKEN with GITHUB_TOKEN
find .github/workflows -name "*.yml" -type f | while read -r file; do
    if grep -q "G_TOKEN" "$file"; then
        echo "Fixing tokens in: $file"
        # Replace all G_TOKEN references with GITHUB_TOKEN
        sed -i 's/secrets\.G_TOKEN/secrets.GITHUB_TOKEN/g' "$file"
        sed -i 's/G_TOKEN:/GITHUB_TOKEN:/g' "$file"
        echo "✅ Fixed $file"
    fi
done

echo "🔍 Checking for remaining G_TOKEN references..."
if grep -r "G_TOKEN" .github/workflows/; then
    echo "⚠️  Some G_TOKEN references may remain"
else
    echo "✅ All G_TOKEN references have been replaced"
fi