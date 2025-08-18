#!/bin/bash

echo "Starting comprehensive TypeScript error fixes..."

# Fix more unused React imports
find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "import React from 'react'" | while read file; do
  if ! grep -q "React\." "$file" && ! grep -q "<React\." "$file"; then
    echo "Removing unused React import from $file"
    sed -i '/^import React from .react.$/d' "$file"
  fi
done

# Fix more process.env access patterns
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "process\.env\." | while read file; do
  echo "Fixing process.env access in $file"
  sed -i 's/process\.env\.MONGODB_URI/process.env['\''MONGODB_URI'\'']/g' "$file"
  sed -i 's/process\.env\.NEXTAUTH_SECRET/process.env['\''NEXTAUTH_SECRET'\'']/g' "$file"
  sed -i 's/process\.env\.NEXTAUTH_URL/process.env['\''NEXTAUTH_URL'\'']/g' "$file"
  sed -i 's/process\.env\.SUPABASE_URL/process.env['\''SUPABASE_URL'\'']/g' "$file"
  sed -i 's/process\.env\.SUPABASE_ANON_KEY/process.env['\''SUPABASE_ANON_KEY'\'']/g' "$file"
  sed -i 's/process\.env\.OPENAI_API_KEY/process.env['\''OPENAI_API_KEY'\'']/g' "$file"
  sed -i 's/process\.env\.ANTHROPIC_API_KEY/process.env['\''ANTHROPIC_API_KEY'\'']/g' "$file"
  sed -i 's/process\.env\.REDIS_URL/process.env['\''REDIS_URL'\'']/g' "$file"
  sed -i 's/process\.env\.DATABASE_URL/process.env['\''DATABASE_URL'\'']/g' "$file"
  sed -i 's/process\.env\.SENTRY_DSN/process.env['\''SENTRY_DSN'\'']/g' "$file"
done

# Fix implicit any parameters in event handlers
find src -name "*.astro" | xargs grep -l "addEventListener.*(" | while read file; do
  echo "Fixing event handler types in $file"
  sed -i 's/addEventListener(\([^,]*\), (\([^)]*\)) =>/addEventListener(\1, (\2: Event) =>/g' "$file"
  sed -i 's/addEventListener(\([^,]*\), (\([^)]*\) =>/addEventListener(\1, (\2: Event) =>/g' "$file"
done

# Fix unused variables by prefixing with underscore
find src -name "*.ts" -o -name "*.tsx" -o -name "*.astro" | while read file; do
  # Common unused variable patterns
  sed -i 's/const \([a-zA-Z_][a-zA-Z0-9_]*\) = [^;]*; \/\/ unused/const _\1 = /g' "$file"
done

echo "Batch fixes completed"
