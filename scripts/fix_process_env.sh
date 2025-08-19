#!/bin/bash

# Fix process.env access patterns in test files
files=(
  "src/lib/ai/bias-detection/__tests__/config.test.ts"
  "src/lib/ai/bias-detection/__tests__/utils.test.ts"
  "src/lib/ai/mental-llama/evidence/utils/__tests__/semanticEvidenceParser.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file"
    # Fix common process.env patterns
    sed -i 's/process\.env\.ENABLE_METRICS/process.env['\''ENABLE_METRICS'\'']/g' "$file"
    sed -i 's/process\.env\.AUDIT_LOGGING_ENABLED/process.env['\''AUDIT_LOGGING_ENABLED'\'']/g' "$file"
    sed -i 's/process\.env\.ENCRYPTION_ENABLED/process.env['\''ENCRYPTION_ENABLED'\'']/g' "$file"
    sed -i 's/process\.env\.CACHE_ENABLED/process.env['\''CACHE_ENABLED'\'']/g' "$file"
    sed -i 's/process\.env\.LOG_LEVEL/process.env['\''LOG_LEVEL'\'']/g' "$file"
    sed -i 's/process\.env\.NODE_ENV/process.env['\''NODE_ENV'\'']/g' "$file"
    sed -i 's/process\.env\.ENCRYPTION_KEY/process.env['\''ENCRYPTION_KEY'\'']/g' "$file"
    sed -i 's/process\.env\.JWT_SECRET/process.env['\''JWT_SECRET'\'']/g' "$file"
    sed -i 's/process\.env\.PYTHON_SERVICE_HOST/process.env['\''PYTHON_SERVICE_HOST'\'']/g' "$file"
    sed -i 's/process\.env\.PYTHON_SERVICE_PORT/process.env['\''PYTHON_SERVICE_PORT'\'']/g' "$file"
  fi
done

echo "Fixed process.env access patterns"
