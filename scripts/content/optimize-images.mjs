#!/usr/bin/env node

/**
 * Image Optimization Script
 * Optimizes images in the public directory for better performance
 */

import { readdir, stat } from 'fs/promises'
import { extname } from 'path'

import {
  ALLOWED_DIRECTORIES,
  safeJoin,
} from '../src/utils/path-security.ts'
import {
  imageOptimizer,
  generateOptimizationReport,
} from '../src/lib/utils/image-optimizer.ts'

// Configuration
const CONFIG = {
  PUBLIC_DIR: ALLOWED_DIRECTORIES.PUBLIC,
  IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  SKIP_PATTERNS: ['node_modules', '.git', 'dist', 'build'],
  MIN_SIZE: 10 * 1024, // 10KB minimum for optimization
}

/**
 * Recursively find image files
 */
async function findImageFiles(dir, files = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = safeJoin(dir, entry.name)

      // Skip unwanted directories
      if (entry.isDirectory() && !CONFIG.SKIP_PATTERNS.includes(entry.name)) {
        await findImageFiles(fullPath, files)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (CONFIG.IMAGE_EXTENSIONS.includes(ext)) {
          const stats = await stat(fullPath)
          if (stats.size >= CONFIG.MIN_SIZE) {
            files.push(fullPath)
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message)
  }

  return files
}

/**
 * Main optimization function
 */
async function main() {
  console.log('🚀 Starting image optimization...\n')

  try {
    // Find all image files
    console.log('📁 Scanning for images...')
    const imageFiles = await findImageFiles(CONFIG.PUBLIC_DIR)

    console.log(`Found ${imageFiles.length} images to optimize\n`)

    if (imageFiles.length === 0) {
      console.log('✅ No images found for optimization')
      return
    }

    // Optimize images
    console.log('⚡ Optimizing images...')
    const results = await imageOptimizer.optimizeImages(imageFiles)

    // Generate report
    console.log('\n📊 Generating optimization report...')
    const report = await generateOptimizationReport(results)

    console.log('\n' + '='.repeat(60))
    console.log(report)
    console.log('='.repeat(60))

    // Summary
    const stats = imageOptimizer.getOptimizationStats(results)
    const savingsPercent = Math.round(
      (stats.totalSavings / stats.totalOriginalSize) * 100,
    )

    console.log(`\n✨ Optimization complete!`)
    console.log(`   • Processed: ${stats.totalFiles} images`)
    console.log(
      `   • Space saved: ${Math.round(stats.totalSavings / 1024)}KB (${savingsPercent}%)`,
    )
    console.log(
      `   • Avg compression: ${Math.round(stats.avgCompressionRatio * 100) / 100}x`,
    )
  } catch (error) {
    console.error('❌ Image optimization failed:', error.message)
    process.exit(1)
  }
}

// Run optimization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main as optimizeImages }
