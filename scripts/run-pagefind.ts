#!/usr/bin/env tsx

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import process from 'node:process'

/**
 * Script that replaces pagefind with flexsearch for better compatibility
 * with Apple Silicon and other architectures
 */

const DIST_DIR = path.join(process.cwd(), 'dist')

console.log('🔍 Running search indexing...')

// Make sure the dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ Error: dist directory not found. Run build first.')
  process.exit(1)
}

try {
  // FlexSearch is integrated directly in the Astro build process
  // via the flexsearch integration, so we don't need to do anything here
  console.log('✅ Search index was generated during build with FlexSearch')
  console.log('🔍 Cleaning up any pagefind artifacts...')
  // Remove pagefind directory if it exists
  if (existsSync(path.join(DIST_DIR, 'pagefind'))) {
    execSync('npx del-cli "dist/pagefind"', { stdio: 'inherit' })
    console.log('✅ Pagefind artifacts removed successfully')
  } else {
    console.log('ℹ️ No pagefind artifacts found')
  }
  console.log('✅ Search processing completed successfully')
} catch (error) {
  console.error('❌ Error during search processing:', error)
  console.log('⚠️ Site will build but search functionality may be limited')
}
