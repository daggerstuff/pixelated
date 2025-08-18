#!/bin/bash

echo "Fixing TypeScript issues in actual source files..."

# Fix missing property issues in API files
find src/pages/api -name "*.ts" | while read file; do
  echo "Processing API file: $file"
  
  # Fix missing APIRoute imports
  if grep -q "export.*function" "$file" && ! grep -q "APIRoute" "$file"; then
    sed -i '1i import type { APIRoute } from "astro";' "$file"
  fi
  
  # Fix function signatures to match APIRoute
  sed -i 's/export async function GET(/export const GET: APIRoute = async (/g' "$file"
  sed -i 's/export async function POST(/export const POST: APIRoute = async (/g' "$file"
  sed -i 's/export async function PUT(/export const PUT: APIRoute = async (/g' "$file"
  sed -i 's/export async function DELETE(/export const DELETE: APIRoute = async (/g' "$file"
done

# Fix component prop types
find src/components -name "*.tsx" | while read file; do
  echo "Processing component: $file"
  
  # Fix React.FC usage
  sed -i 's/React\.FC</FC</g' "$file"
  sed -i 's/: React\.FC/: FC/g' "$file"
  
  # Add FC import if needed
  if grep -q ": FC" "$file" && ! grep -q "import.*FC" "$file"; then
    sed -i 's/import { /import { FC, /g' "$file"
  fi
done

# Fix test files
find src -name "*.test.ts" -o -name "*.test.tsx" | while read file; do
  echo "Processing test file: $file"
  
  # Fix expect assertions
  sed -i 's/expect(\([^)]*\))\.toHaveBeenCalledWith(/expect(\1).toHaveBeenCalledWith(/g' "$file"
  
  # Fix mock function types
  sed -i 's/jest\.fn()/jest.fn() as jest.MockedFunction<any>/g' "$file"
done

echo "Source file fixes completed"
