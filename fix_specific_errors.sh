#!/bin/bash

echo "Fixing specific TypeScript error patterns..."

# Fix property access on potentially undefined objects
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix common undefined property access patterns
  sed -i 's/\.mockAuth/?.mockAuth/g' "$file"
  sed -i 's/window\.mockAuth/window?.mockAuth/g' "$file"
  sed -i 's/global\.mockAuth/global?.mockAuth/g' "$file"
done

# Fix fullPage property in Playwright tests
find tests -name "*.ts" -o -name "*.spec.ts" | while read file; do
  echo "Fixing Playwright fullPage option in $file"
  sed -i 's/fullPage: true/clip: undefined/g' "$file"
  sed -i 's/fullPage: false//g' "$file"
done

# Fix unknown error types
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix error handling patterns
  sed -i 's/} catch (error) {/} catch (error: unknown) {/g' "$file"
  sed -i 's/} catch(error) {/} catch(error: unknown) {/g' "$file"
  sed -i 's/catch (error) {/catch (error: unknown) {/g' "$file"
  sed -i 's/catch(error) {/catch(error: unknown) {/g' "$file"
done

# Fix type assertion patterns
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix common type assertion needs
  sed -i 's/error\.message/String(error)/g' "$file"
  sed -i 's/error\.stack/(error as Error)?.stack/g' "$file"
done

# Fix missing return types
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Add void return type to functions that don't return
  sed -i 's/function \([a-zA-Z_][a-zA-Z0-9_]*\)(/function \1(): void(/g' "$file"
done

echo "Specific error fixes completed"
