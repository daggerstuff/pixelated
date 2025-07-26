#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

console.log('🔧 Fixing logger imports...')

// Find all TypeScript/JavaScript files
const files = glob.sync('src/**/*.{ts,tsx,js,jsx,astro}', { ignore: ['node_modules/**', 'dist/**'] })

let fixedCount = 0

files.forEach(file => {
  try {
    let content = readFileSync(file, 'utf8')
    let modified = false

    // Replace getAppLogger() calls with direct logger creation
    if (content.includes('getAppLogger()')) {
      content = content.replace(/getAppLogger\(\)/g, 'console')
      modified = true
    }

    // Remove getAppLogger imports
    if (content.includes('getAppLogger')) {
      content = content.replace(/import.*getAppLogger.*from.*\n/g, '')
      content = content.replace(/,\s*getAppLogger/g, '')
      content = content.replace(/getAppLogger,\s*/g, '')
      content = content.replace(/{\s*getAppLogger\s*}/g, '{}')
      modified = true
    }

    if (modified) {
      writeFileSync(file, content)
      fixedCount++
      console.log(`✅ Fixed: ${file}`)
    }
  } catch (error) {
    console.log(`⚠️  Skipped: ${file} (${error.message})`)
  }
})

console.log(`🎉 Fixed ${fixedCount} files`)