#!/bin/bash

# WARNING: This script uses sed for bulk code modifications.
# It is fragile and may cause unintended changes, especially if patterns appear in strings or comments.
# For future refactoring, use AST-aware tools (e.g., ts-morph) or ESLint autofix rules.
# This script is intended for one-time use only and should be removed after execution.

echo "Fixing error handling patterns..."

# Fix unknown error types in catch blocks
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  echo "Processing error handling in $file"
  
  # Fix catch blocks with unknown error type
  sed -i 's/catch (error) {/catch (error: unknown) {/g' "$file"
  sed -i 's/catch(error) {/catch(error: unknown) {/g' "$file"
  sed -i 's/catch (err) {/catch (err: unknown) {/g' "$file"
  sed -i 's/catch(err) {/catch(err: unknown) {/g' "$file"
  
  # Fix error message access
  sed -i 's/error\.message/(error as Error)?.message || String(error)/g' "$file"
  sed -i 's/err\.message/(err as Error)?.message || String(err)/g' "$file"
  
  # Fix error stack access
  sed -i 's/error\.stack/(error as Error)?.stack/g' "$file"
  sed -i 's/err\.stack/(err as Error)?.stack/g' "$file"
  
  # Fix error name access
  sed -i 's/error\.name/(error as Error)?.name/g' "$file"
  sed -i 's/err\.name/(err as Error)?.name/g' "$file"
done

# Fix test files specifically
find tests -name "*.ts" -o -name "*.spec.ts" | while read file; do
  echo "Processing test error handling in $file"
  
  # Fix test-specific error patterns
  sed -i 's/catch (error) {/catch (error: unknown) {/g' "$file"
  sed -i 's/error\.message/String(error)/g' "$file"
done

echo "Error handling fixes completed"
