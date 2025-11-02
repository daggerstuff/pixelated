#!/bin/bash
# Resolve code conflicts - prefer master (newer) version
# Review manually any that look significant

CONFLICT_FILES=$(git diff --name-only --diff-filter=U)

echo "Resolving code conflicts (preferring master/newer version)..."

for file in $CONFLICT_FILES; do
  if [ -f "$file" ] && grep -q "<<<<<<< HEAD" "$file" 2>/dev/null; then
    # For most code conflicts, prefer master (newer)
    git checkout --theirs "$file" 2>/dev/null
    git add "$file" 2>/dev/null
    echo "Resolved: $file"
  fi
done

