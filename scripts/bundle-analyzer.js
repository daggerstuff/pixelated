#!/usr/bin/env node

/**
 * Bundle Analyzer for Astro Builds
 *
 * Analyzes build output to identify optimization opportunities
 * and performance bottlenecks in the production bundle.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs'
import { join, extname, relative } from 'path'
import { gzipSync } from 'zlib'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

class BundleAnalyzer {
  constructor() {
    this.results = new Map()
    this.totalSize = 0
  }

  async analyzeBuild() {
    console.log('🔍 Analyzing build output for large files...')

    try {
      // Check if dist folder exists
      const distPath = path.join(process.cwd(), 'dist')
      const stats = await fs.stat(distPath)

      if (stats.isDirectory()) {
        await this.analyzeDirectory(distPath, 'dist')
      }
    } catch (error) {
      console.log('No dist folder found. Building first...')
      try {
        execSync('pnpm build', { stdio: 'inherit' })
        await this.analyzeDirectory(path.join(process.cwd(), 'dist'), 'dist')
      } catch (buildError) {
        console.error('Build failed:', buildError.message)
        return
      }
    }

    // Check .vercel output if it exists
    try {
      const vercelPath = path.join(process.cwd(), '.vercel/output')
      await fs.access(vercelPath)
      await this.analyzeDirectory(vercelPath, '.vercel/output')
    } catch {
      console.log('No .vercel/output folder found')
    }

    this.generateReport()
  }

  async analyzeDirectory(dirPath, prefix = '') {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.join(prefix, entry.name)

        if (entry.isDirectory()) {
          await this.analyzeDirectory(fullPath, relativePath)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          const sizeMB = stats.size / (1024 * 1024)

          // Track files larger than 1MB
          if (sizeMB > 1) {
            this.results.set(relativePath, {
              size: stats.size,
              sizeMB: sizeMB.toFixed(2),
              type: this.getFileType(entry.name),
            })
          }

          this.totalSize += stats.size
        }
      }
    } catch (error) {
      console.error(`Error analyzing ${dirPath}:`, error.message)
    }
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase()
    const types = {
      '.js': 'JavaScript',
      '.mjs': 'ES Module',
      '.ts': 'TypeScript',
      '.json': 'JSON',
      '.wasm': 'WebAssembly',
      '.css': 'CSS',
      '.html': 'HTML',
      '.map': 'Source Map',
      '.gz': 'Compressed',
      '.br': 'Brotli',
    }
    return types[ext] || 'Other'
  }

  generateReport() {
    console.log('\n📊 Bundle Size Analysis Report')
    console.log('=' * 50)
    console.log(
      `Total build size: ${(this.totalSize / (1024 * 1024)).toFixed(2)} MB`,
    )

    if (this.results.size === 0) {
      console.log('✅ No files larger than 1MB found!')
      return
    }

    console.log('\n🔍 Large files (>1MB):')

    // Sort by size descending
    const sorted = Array.from(this.results.entries()).sort(
      (a, b) => b[1].size - a[1].size,
    )

    sorted.forEach(([file, info], index) => {
      const emoji = index < 3 ? '🚨' : '⚠️'
      console.log(`${emoji} ${file} - ${info.sizeMB}MB (${info.type})`)
    })

    // Generate optimization suggestions
    this.generateSuggestions(sorted)
  }

  generateSuggestions(largeFiles) {
    console.log('\n💡 Optimization Suggestions:')

    const jsFiles = largeFiles.filter(
      ([_, info]) => info.type === 'JavaScript' || info.type === 'ES Module',
    )

    if (jsFiles.length > 0) {
      console.log('📦 Large JavaScript files detected:')
      jsFiles.slice(0, 5).forEach(([file, info]) => {
        console.log(`   - ${file} (${info.sizeMB}MB)`)
      })

      console.log('\n   Recommendations:')
      console.log(
        '   • Add more dependencies to external array in astro.config.vercel-minimal.mjs',
      )
      console.log('   • Consider code splitting for large components')
      console.log('   • Check if unused imports are being tree-shaken')
      console.log('   • Consider dynamic imports for heavy libraries')
    }

    const wasmFiles = largeFiles.filter(
      ([_, info]) => info.type === 'WebAssembly',
    )
    if (wasmFiles.length > 0) {
      console.log(
        '\n🔧 WebAssembly files found - consider externalizing WASM dependencies',
      )
    }

    console.log('\n🎯 Quick fixes to try:')
    console.log('1. Update .vercelignore to exclude more directories')
    console.log('2. Add more packages to external arrays in config')
    console.log('3. Use dynamic imports for non-critical dependencies')
    console.log('4. Consider removing unused integrations')
    console.log('5. Check if source maps are being included')
  }

  async checkPackageSize() {
    console.log('\n📦 Analyzing package.json dependencies...')

    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }
      const largeDeps = [
        '@tensorflow/tfjs',
        '@supabase/supabase-js',
        'three',
        'framer-motion',
        '@aws-sdk/client-s3',
        'sharp',
        '@emotion/react',
        '@mui/material',
        'chart.js',
        'mem0ai',
      ]

      console.log('🚨 Large dependencies that should be externalized:')
      largeDeps.forEach((dep) => {
        if (deps[dep]) {
          console.log(`   - ${dep}@${deps[dep]}`)
        }
      })
    } catch (error) {
      console.error('Error reading package.json:', error.message)
    }
  }
}

// Run the analyzer
async function main() {
  const analyzer = new BundleAnalyzer()
  await analyzer.analyzeBuild()
  await analyzer.checkPackageSize()

  console.log('\n🔧 To reduce bundle size further, run:')
  console.log('pnpm build:vercel')
  console.log('node scripts/bundle-analyzer.js')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { BundleAnalyzer }
