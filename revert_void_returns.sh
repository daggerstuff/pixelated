#!/bin/bash

echo "Reverting incorrect void return type additions..."

# Find and revert functions that were incorrectly marked as void but actually return values
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  echo "Processing: $file"
  
  # Revert function declarations that return values but were marked void
  sed -i 's/function \([a-zA-Z_][a-zA-Z0-9_]*\)(): void(/function \1(/g' "$file"
  
  # Revert arrow functions that return values but were marked void
  sed -i 's/const \([a-zA-Z_][a-zA-Z0-9_]*\) = (\([^)]*\)): void => {/const \1 = (\2) => {/g' "$file"
  
  # Revert async functions that return values but were marked void
  sed -i 's/async function \([a-zA-Z_][a-zA-Z0-9_]*\)(): Promise<void>(/async function \1(/g' "$file"
  
  # Revert method definitions that return values but were marked void
  sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\)(): void {/\1() {/g' "$file"
done

echo "Reverted incorrect void return types"
