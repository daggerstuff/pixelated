#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const SECURITY_PATTERNS = [
  { pattern: /\beval\s*\(/, message: 'Use of eval() detected', safe: false },
  {
    pattern: /\bnew\s+Function\s*\(/,
    message: 'Use of new Function() detected',
    safe: false,
  },
  {
    pattern: /\bsetTimeout\s*\(\s*["'`][^"']*["'`]/,
    message: 'setTimeout with string argument detected',
    safe: false,
  },
  {
    pattern: /\bsetInterval\s*\(\s*["'`][^"']*["'`]/,
    message: 'setInterval with string argument detected',
    safe: false,
  },
  {
    pattern: /innerHTML\s*=\s*[^'"]*$/,
    message: 'Potential XSS via innerHTML',
    safe: false,
  },
  {
    pattern: /document\.write\s*\(/,
    message: 'Use of document.write() detected',
    safe: false,
  },
]

// Safe patterns that should be ignored
const SAFE_PATTERNS = [
  /\$\$eval\(/, // Puppeteer's $$eval is safe
  /page\.\$eval\(/, // Puppeteer's $eval is safe
  /page\.\$\$eval\(/, // Puppeteer's $$eval is safe
]

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.astro',
]

function scanDirectory(dir) {
  const results = []

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Skip safe patterns
      const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(line))
      if (isSafe) return

      SECURITY_PATTERNS.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          results.push({
            file: filePath,
            line: index + 1,
            message,
            code: line.trim(),
            safe: false,
          })
        }
      })
    })
  }

  function walkDir(currentDir) {
    const items = fs.readdirSync(currentDir)

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory() && !EXCLUDED_DIRS.includes(item)) {
        walkDir(fullPath)
      } else if (stat.isFile() && /\.(js|ts|jsx|tsx|mjs|cjs)$/.test(item)) {
        scanFile(fullPath)
      }
    })
  }

  walkDir(dir)
  return results
}

function main() {
  console.log('🔍 Security Audit - Scanning for unsafe patterns...\n')

  const results = scanDirectory('src')
  const unsafeResults = results.filter((r) => !r.safe)

  if (unsafeResults.length === 0) {
    console.log('✅ No security issues found!')
    return
  }

  console.log(`⚠️  Found ${unsafeResults.length} potential security issues:\n`)

  unsafeResults.forEach(({ file, line, message, code }) => {
    console.log(`📁 ${file}:${line}`)
    console.log(`   ${message}`)
    console.log(`   Code: ${code}`)
    console.log()
  })

  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { scanDirectory }
