#!/usr/bin/env node

/**
 * Image Optimization Script for Pixelated Empathy
 * 
 * This script optimizes images in the public directory to improve performance.
 * It converts images to WebP format and creates multiple sizes for responsive images.
 */

import { readdir, stat, mkdir } from 'fs/promises'
import { join, extname, basename, dirname } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'

const PUBLIC_DIR = './public'
const OUTPUT_DIR = './public/optimized'
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.tiff', '.gif']

// Size configurations for responsive images
const SIZES = [
  { width: 320, suffix: '-mobile' },
  { width: 768, suffix: '-tablet' },
  { width: 1200, suffix: '-desktop' },
  { width: 1920, suffix: '-xl' }
]

// Quality settings
const QUALITY = {
  webp: 80,
  jpeg: 85,
  png: 90
}

/**
 * Get all image files recursively from a directory
 */
async function getImageFiles(dir) {
  const files = []
  
  const traverse = async (currentDir) => {
    const items = await readdir(currentDir)
    
    for (const item of items) {
      const fullPath = join(currentDir, item)
      const stats = await stat(fullPath)
      
      if (stats.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', '.git', 'dist', 'build', 'optimized'].includes(item)) {
          await traverse(fullPath)
        }
      } else if (SUPPORTED_FORMATS.includes(extname(item).toLowerCase())) {
        files.push(fullPath)
      }
    }
  }
  
  await traverse(dir)
  return files
}

/**
 * Get file size in KB
 */
function getFileSizeKB(bytes) {
  return (bytes / 1024).toFixed(2)
}

/**
 * Create responsive versions of an image
 */
async function createResponsiveImages(inputPath, outputDir) {
  const ext = extname(inputPath)
  const name = basename(inputPath, ext)
  const relativePath = dirname(inputPath).replace(PUBLIC_DIR, '')
  
  // Create output directory structure
  const fullOutputDir = join(outputDir, relativePath)
  if (!existsSync(fullOutputDir)) {
    await mkdir(fullOutputDir, { recursive: true })
  }
  
  const results = []
  
  try {
    const image = sharp(inputPath)
    const metadata = await image.metadata()
    const originalSize = metadata.width
    
    console.log(`Processing: ${inputPath}`)
    console.log(`  Original: ${metadata.width}x${metadata.height} (${getFileSizeKB(metadata.size)}KB)`)
    
    // Create WebP versions for different sizes
    for (const size of SIZES) {
      // Skip if the target size is larger than the original
      if (size.width > originalSize) {
        continue
      }
      
      const outputPath = join(fullOutputDir, `${name}${size.suffix}.webp`)
      
      await image
        .resize(size.width)
        .webp({ quality: QUALITY.webp })
        .toFile(outputPath)
      
      const stats = await stat(outputPath)
      results.push({
        path: outputPath,
        size: stats.size,
        width: size.width
      })
      
      console.log(`  Created: ${basename(outputPath)} (${getFileSizeKB(stats.size)}KB)`)
    }
    
    // Create optimized original size in WebP
    const originalWebP = join(fullOutputDir, `${name}.webp`)
    await image
      .webp({ quality: QUALITY.webp })
      .toFile(originalWebP)
    
    const webpStats = await stat(originalWebP)
    results.push({
      path: originalWebP,
      size: webpStats.size,
      width: originalSize
    })
    
    console.log(`  Created: ${basename(originalWebP)} (${getFileSizeKB(webpStats.size)}KB)`)
    
    // Calculate total savings
    const originalStats = await stat(inputPath)
    const totalOptimizedSize = results.reduce((sum, result) => sum + result.size, 0)
    const savings = ((originalStats.size - webpStats.size) / originalStats.size * 100).toFixed(1)
    
    console.log(`  Savings: ${savings}% (${getFileSizeKB(originalStats.size - webpStats.size)}KB saved)`)
    console.log('')
    
    return results
    
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error.message)
    return []
  }
}

/**
 * Generate Astro component code for responsive images
 */
function generateAstroImageComponent(imagePath, sizes) {
  const name = basename(imagePath, extname(imagePath))
  const relativePath = imagePath.replace(PUBLIC_DIR, '').replace(/^\//, '')
  
  return `
---
// Auto-generated responsive image component for ${name}
// Usage: <ResponsiveImage${name.charAt(0).toUpperCase() + name.slice(1)} alt="Description" />

export interface Props {
  alt: string;
  loading?: 'lazy' | 'eager';
  class?: string;
}

const { alt, loading = 'lazy', class: className } = Astro.props;
---

<picture class={className}>
  <source
    media="(min-width: 1200px)"
    srcset="/optimized/${relativePath.replace(extname(relativePath), '-desktop.webp')}"
    type="image/webp"
  />
  <source
    media="(min-width: 768px)"
    srcset="/optimized/${relativePath.replace(extname(relativePath), '-tablet.webp')}"
    type="image/webp"
  />
  <source
    media="(max-width: 767px)"
    srcset="/optimized/${relativePath.replace(extname(relativePath), '-mobile.webp')}"
    type="image/webp"
  />
  <img
    src="/optimized/${relativePath.replace(extname(relativePath), '.webp')}"
    alt={alt}
    loading={loading}
    decoding="async"
  />
</picture>
`.trim()
}

/**
 * Main optimization function
 */
async function optimizeImages() {
  console.log('🖼️  Starting image optimization...\n')
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }
  
  // Get all image files
  const imageFiles = await getImageFiles(PUBLIC_DIR)
  console.log(`Found ${imageFiles.length} images to optimize\n`)
  
  if (imageFiles.length === 0) {
    console.log('No images found to optimize.')
    return
  }
  
  let totalOriginalSize = 0
  let totalOptimizedSize = 0
  const components = []
  
  // Process each image
  for (const imagePath of imageFiles) {
    const results = await createResponsiveImages(imagePath, OUTPUT_DIR)
    
    if (results.length > 0) {
      const originalStats = await stat(imagePath)
      totalOriginalSize += originalStats.size
      
      // Use the main WebP file size for comparison
      const mainWebP = results.find(r => !r.path.includes('-mobile') && !r.path.includes('-tablet') && !r.path.includes('-desktop') && !r.path.includes('-xl'))
      if (mainWebP) {
        totalOptimizedSize += mainWebP.size
      }
      
      // Generate component code
      const componentCode = generateAstroImageComponent(imagePath, results)
      components.push({
        name: basename(imagePath, extname(imagePath)),
        code: componentCode
      })
    }
  }
  
  // Save component examples
  const componentExamples = components.map(c => c.code).join('\n\n---\n\n')
  const examplePath = join(OUTPUT_DIR, 'astro-components-example.astro')
  
  try {
    const { writeFile } = await import('fs/promises')
    await writeFile(examplePath, `---
// Example responsive image components
// Copy individual components to your Astro component files as needed
---

${componentExamples}`)
    
    console.log(`📝 Generated Astro component examples: ${examplePath}\n`)
  } catch (error) {
    console.error('Error writing component examples:', error.message)
  }
  
  // Summary
  const totalSavings = totalOriginalSize - totalOptimizedSize
  const savingsPercent = ((totalSavings / totalOriginalSize) * 100).toFixed(1)
  
  console.log('📊 Optimization Summary:')
  console.log(`  Original total size: ${getFileSizeKB(totalOriginalSize)}KB`)
  console.log(`  Optimized total size: ${getFileSizeKB(totalOptimizedSize)}KB`)
  console.log(`  Total savings: ${getFileSizeKB(totalSavings)}KB (${savingsPercent}%)`)
  console.log(`  Files processed: ${imageFiles.length}`)
  console.log(`  Responsive variants created: ${components.length * SIZES.length}`)
  
  console.log('\n🎉 Image optimization complete!')
  console.log('\nNext steps:')
  console.log('1. Update your Astro components to use the optimized images')
  console.log('2. Use the responsive image components for better performance')
  console.log('3. Consider lazy loading for below-the-fold images')
  console.log('4. Test the performance impact with Lighthouse')
}

// Check if sharp is available
try {
  await import('sharp')
  optimizeImages().catch(console.error)
} catch (error) {
  console.error('❌ Sharp is required for image optimization.')
  console.error('Install it with: pnpm add -D sharp')
  console.error('')
  console.error('Full error:', error.message)
  process.exit(1)
}
