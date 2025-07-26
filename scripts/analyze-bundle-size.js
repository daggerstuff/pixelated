#!/usr/bin/env node

/**
 * Bundle size analysis script for AWS Amplify builds
 * Identifies large files and dependencies that contribute to bundle size
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getDirectorySize(dirPath) {
  try {
    const result = execSync(
      `du -sb "${dirPath}" 2>/dev/null || echo "0\t${dirPath}"`,
      { encoding: 'utf8' },
    )
    const sizeBytes = parseInt(result.split('\t')[0])
    return sizeBytes
  } catch (error) {
    return 0
  }
}

function analyzeDirectory(dirPath, maxDepth = 2, currentDepth = 0) {
  const items = []

  if (currentDepth >= maxDepth || !fs.existsSync(dirPath)) {
    return items
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const size = getDirectorySize(fullPath)
        items.push({
          name: entry.name,
          path: fullPath,
          size: size,
          type: 'directory',
          children:
            currentDepth < maxDepth - 1
              ? analyzeDirectory(fullPath, maxDepth, currentDepth + 1)
              : [],
        })
      } else {
        try {
          const stats = fs.statSync(fullPath)
          items.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            type: 'file',
          })
        } catch (error) {
          // Skip files we can't read
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message)
  }

  return items.sort((a, b) => b.size - a.size)
}

function printAnalysis(items, prefix = '', maxItems = 20) {
  items.slice(0, maxItems).forEach((item, index) => {
    const sizeStr = formatBytes(item.size)
    const isLast = index === Math.min(items.length, maxItems) - 1
    const connector = isLast ? '└── ' : '├── '

    console.log(`${prefix}${connector}${item.name} (${sizeStr})`)

    if (
      item.children &&
      item.children.length > 0 &&
      item.size > 10 * 1024 * 1024
    ) {
      // 10MB threshold
      const newPrefix = prefix + (isLast ? '    ' : '│   ')
      printAnalysis(item.children, newPrefix, 10)
    }
  })
}

function identifyLargeDependencies() {
  console.log('🔍 Analyzing bundle size contributors...\n')

  // Analyze key directories
  const directories = [
    'node_modules',
    '.amplify-hosting/compute/default/node_modules',
    '.amplify-hosting/static',
    '.amplify-hosting/compute/default',
    'dist',
    'build',
  ]

  directories.forEach((dir) => {
    if (fs.existsSync(dir)) {
      console.log(`📂 Analyzing ${dir}:`)
      const totalSize = getDirectorySize(dir)
      console.log(`   Total: ${formatBytes(totalSize)}\n`)

      const analysis = analyzeDirectory(dir, 3)
      printAnalysis(analysis, '   ', 15)
      console.log('\n' + '─'.repeat(80) + '\n')
    }
  })

  // Check for specific heavy dependencies
  const heavyDeps = [
    '@tensorflow/tfjs',
    'three',
    'playwright',
    'sharp',
    '@google-cloud/storage',
    'aws-sdk',
    '@aws-sdk',
    'react',
    'astro',
    '@radix-ui',
    '@sentry',
    'typescript',
    '@types',
  ]

  console.log('🎯 Heavy dependency analysis:')
  heavyDeps.forEach((dep) => {
    const depPath = `node_modules/${dep}`
    if (fs.existsSync(depPath)) {
      const size = getDirectorySize(depPath)
      if (size > 1024 * 1024) {
        // 1MB threshold
        console.log(`   ${dep}: ${formatBytes(size)}`)
      }
    }
  })

  console.log('\n📊 Recommendations:')
  console.log('   1. Move heavy dependencies to Lambda layers')
  console.log('   2. Use external/peer dependencies where possible')
  console.log('   3. Remove dev dependencies from production builds')
  console.log('   4. Consider code splitting for client-side bundles')
  console.log('   5. Use tree-shaking to eliminate dead code')
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  identifyLargeDependencies()
}
