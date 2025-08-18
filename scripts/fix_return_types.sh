#!/bin/bash

echo "Fixing missing return types and type assertions..."

# Fix missing return types in function declarations
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  echo "Processing return types in $file"
  
  # Add void return type to functions that don't return anything
  sed -i 's/function \([a-zA-Z_][a-zA-Z0-9_]*\)(\([^)]*\)) {/function \1(\2): void {/g' "$file"
  
  # Fix arrow functions without return types
  sed -i 's/const \([a-zA-Z_][a-zA-Z0-9_]*\) = (\([^)]*\)) => {/const \1 = (\2): void => {/g' "$file"
  
  # Fix async functions
  sed -i 's/async function \([a-zA-Z_][a-zA-Z0-9_]*\)(\([^)]*\)) {/async function \1(\2): Promise<void> {/g' "$file"
  
  # Fix method definitions
  sed -i 's/\([a-zA-Z_][a-zA-Z0-9_]*\)(\([^)]*\)) {/\1(\2): void {/g' "$file"
done

# Fix type assertions for common patterns
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  echo "Processing type assertions in $file"
  
  # Fix document.getElementById patterns
  sed -i 's/document\.getElementById(\([^)]*\))/document.getElementById(\1) as HTMLElement/g' "$file"
  
  # Fix querySelector patterns
  sed -i 's/document\.querySelector(\([^)]*\))/document.querySelector(\1) as HTMLElement/g' "$file"
  
  # Fix JSON.parse patterns
  sed -i 's/JSON\.parse(\([^)]*\))/JSON.parse(\1) as any/g' "$file"
done

echo "Return types and type assertions fixes completed"
