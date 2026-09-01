/**
 * Image Optimization Utilities
 * Compress and optimize static assets for better performance
 */

import { existsSync, statSync } from 'fs'
import { readdir, readFile, mkdir, writeFile } from 'fs/promises'
import { join, extname } from 'path'

import sharp from 'sharp'

import {
  ALLOWED_DIRECTORIES,
  safeJoin,
  validatePath,
} from '../../utils/path-security'
import { getLogger } from '../logging'

const logger = getLogger({ prefix: 'image-optimizer' })

// Optimization configuration
const IMAGE_CONFIG = {
  // Supported formats and their optimization settings
  FORMATS: {
    jpeg: {
      quality: 85,
      progressive: true,
      mozjpeg: true,
    },
    png: {
      quality: 85,
      compressionLevel: 6,
      palette: true,
    },
    webp: {
      quality: 85,
      effort: 6,
      lossless: false,
    },
    avif: {
      quality: 80,
      effort: 6,
    },
  },

  // Size thresholds
  THRESHOLDS: {
    LARGE_FILE: 500 * 1024, // 500KB
    MEDIUM_FILE: 100 * 1024, // 100KB
    SMALL_FILE: 10 * 1024, // 10KB
  },

  // Output directories (relative to ALLOWED_DIRECTORIES.PUBLIC = PROJECT_ROOT/public)
  OUTPUT_DIRS: {
    optimized: validatePath('assets/optimized', ALLOWED_DIRECTORIES.PUBLIC),
    webp: validatePath('assets/webp', ALLOWED_DIRECTORIES.PUBLIC),
    avif: validatePath('assets/avif', ALLOWED_DIRECTORIES.PUBLIC),
    resized: validatePath('assets/resized', ALLOWED_DIRECTORIES.PUBLIC),
  },

  // Responsive resize breakpoints (width in pixels)
  RESIZE: {
    thumbnail: { width: 150, suffix: 'thumb' },
    small: { width: 480, suffix: 'small' },
    medium: { width: 800, suffix: 'medium' },
    large: { width: 1200, suffix: 'large' },
  } as const,
}

export interface ResizeVariant {
  name: string
  width: number
  path: string
  size: number
}

export interface BufferVariant {
  buffer: Buffer
  size: number
  mimetype: string
}

export interface BufferResizeVariant extends BufferVariant {
  name: string
  width: number
}

export interface BufferOptimizationResult {
  original: BufferVariant
  optimized?: BufferVariant
  webp?: BufferVariant
  avif?: BufferVariant
  thumbnail?: BufferVariant
  resizeVariants: BufferResizeVariant[]
  savings: number
}

/**
 * Image optimization result
 */
export interface OptimizationResult {
  originalPath: string
  originalSize: number
  optimizedPath?: string
  optimizedSize?: number
  webpPath?: string
  webpSize?: number
  avifPath?: string
  avifSize?: number
  resizeVariants: ResizeVariant[]
  savings: number
  compressionRatio: number
}

/**
 * Image optimization service
 */
export class ImageOptimizer {
  private readonly outputDirs: string[]

  constructor() {
    this.outputDirs = [
      IMAGE_CONFIG.OUTPUT_DIRS.optimized,
      IMAGE_CONFIG.OUTPUT_DIRS.webp,
      IMAGE_CONFIG.OUTPUT_DIRS.avif,
      IMAGE_CONFIG.OUTPUT_DIRS.resized,
    ]
    void this.ensureOutputDirectories()
  }

  /**
   * Ensure output directories exist
   */
  private async ensureOutputDirectories(): Promise<void> {
    for (const dir of this.outputDirs) {
      try {
        await mkdir(dir, { recursive: true })
      } catch (error: unknown) {
        logger.warn(`Failed to create output directory: ${dir}`, { error })
      }
    }
  }

  /**
   * Optimize a single image
   */
  async optimizeImage(imagePath: string): Promise<OptimizationResult> {
    // Validate path to prevent traversal attacks
    try {
      validatePath(imagePath, ALLOWED_DIRECTORIES.PROJECT_ROOT, {
        allowAbsolutePath: true,
      })
    } catch (error: unknown) {
      throw new Error(
        `Invalid image path: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const startTime = Date.now()

    try {
      // Security: Validate path is within public assets
      validatePath(imagePath, ALLOWED_DIRECTORIES.PUBLIC, {
        allowAbsolutePath: true,
      })

      // Check if file exists
      if (!existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`)
      }

      const stat = statSync(imagePath)
      const originalSize = stat.size

      logger.info('Starting image optimization', {
        imagePath,
        originalSize,
        sizeKB: Math.round(originalSize / 1024),
      })

      // Read image file
      const imageBuffer = await readFile(imagePath)

      // Determine image format
      const format = this.detectImageFormat(imagePath, imageBuffer)

      // Skip optimization for very small files
      if (originalSize < IMAGE_CONFIG.THRESHOLDS.SMALL_FILE) {
        logger.info('Skipping optimization for small file', {
          imagePath,
          size: originalSize,
        })
        return {
          originalPath: imagePath,
          originalSize,
          resizeVariants: [],
          savings: 0,
          compressionRatio: 1,
        }
      }

      // Optimize based on format
      const result: OptimizationResult = {
        originalPath: imagePath,
        originalSize,
        resizeVariants: [],
        savings: 0,
        compressionRatio: 1,
      }

      // Generate optimized versions
      if (format === 'jpeg' || format === 'png') {
        // Re-compress original format
        const optimizedResult = await this.optimizeOriginalFormat(
          imagePath,
          imageBuffer,
          format,
        )
        if (optimizedResult) {
          result.optimizedPath = optimizedResult.path
          result.optimizedSize = optimizedResult.size
        }

        // Generate WebP version
        const webpResult = await this.generateWebP(imagePath, imageBuffer)
        if (webpResult) {
          result.webpPath = webpResult.path
          result.webpSize = webpResult.size
        }

        // Generate AVIF version for modern browsers
        const avifResult = await this.generateAVIF(imagePath, imageBuffer)
        if (avifResult) {
          result.avifPath = avifResult.path
          result.avifSize = avifResult.size
        }

        // Generate responsive resize variants
        result.resizeVariants = await this.resizeImage(imagePath, imageBuffer)
      }

      // Calculate total savings — use the smallest optimized version as the
      // effective serving size (browsers pick AVIF or WebP via <picture>)
      const optimizedSizes = [
        result.webpSize,
        result.avifSize,
        result.optimizedSize,
      ].filter((s): s is number => s !== undefined && s > 0)

      const bestOptimizedSize =
        optimizedSizes.length > 0 ? Math.min(...optimizedSizes) : originalSize
      const effectiveSize = Math.min(originalSize, bestOptimizedSize)

      result.savings = originalSize - effectiveSize
      result.compressionRatio =
        effectiveSize > 0 ? originalSize / effectiveSize : 1

      const processingTime = Date.now() - startTime

      logger.info('Image optimization completed', {
        imagePath,
        originalSize,
        bestOptimizedSize,
        savings: result.savings,
        compressionRatio: Math.round(result.compressionRatio * 100) / 100,
        processingTime,
      })

      return result
    } catch (error: unknown) {
      logger.error('Image optimization failed', {
        imagePath,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Detect image format from file path or buffer
   */
  private detectImageFormat(filePath: string, buffer: Buffer): string {
    // Check file extension first
    const ext = filePath.toLowerCase().split('.').pop()

    if (['jpg', 'jpeg'].includes(ext ?? '')) return 'jpeg'
    if (ext === 'png') return 'png'
    if (ext === 'webp') return 'webp'
    if (ext === 'avif') return 'avif'
    if (ext === 'gif') return 'gif'

    // Check magic bytes if extension is unclear
    const magic = buffer.subarray(0, 12).toString('hex')

    if (magic.startsWith('ffd8ff')) return 'jpeg'
    if (magic.startsWith('89504e47')) return 'png'
    if (
      magic.startsWith('52494646') &&
      buffer.subarray(8, 12).toString('hex') === '57454250'
    )
      return 'webp'
    if (
      magic.startsWith('52494646') &&
      buffer.subarray(8, 12).toString('hex') === '41564946'
    )
      return 'avif'

    // Default to jpeg if unknown
    return 'jpeg'
  }

  /**
   * Generate WebP version of image using sharp
   */
  private async generateWebP(
    imagePath: string,
    buffer: Buffer,
  ): Promise<{ path: string; size: number } | null> {
    try {
      const outputPath = safeJoin(
        IMAGE_CONFIG.OUTPUT_DIRS.webp,
        this.getOptimizedFilename(imagePath, 'webp'),
      )

      const webpBuffer = await sharp(buffer)
        .webp({
          quality: IMAGE_CONFIG.FORMATS.webp.quality,
          effort: IMAGE_CONFIG.FORMATS.webp.effort,
          lossless: IMAGE_CONFIG.FORMATS.webp.lossless,
        })
        .toBuffer()

      await writeFile(outputPath, webpBuffer)

      logger.info('WebP generation completed', {
        inputPath: imagePath,
        outputPath,
        originalSize: buffer.length,
        webpSize: webpBuffer.length,
      })

      return {
        path: outputPath,
        size: webpBuffer.length,
      }
    } catch (error: unknown) {
      logger.warn('WebP generation failed', {
        imagePath,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Generate AVIF version of image using sharp
   */
  private async generateAVIF(
    imagePath: string,
    buffer: Buffer,
  ): Promise<{ path: string; size: number } | null> {
    try {
      const outputPath = safeJoin(
        IMAGE_CONFIG.OUTPUT_DIRS.avif,
        this.getOptimizedFilename(imagePath, 'avif'),
      )

      const avifBuffer = await sharp(buffer)
        .avif({
          quality: IMAGE_CONFIG.FORMATS.avif.quality,
          effort: IMAGE_CONFIG.FORMATS.avif.effort,
        })
        .toBuffer()

      await writeFile(outputPath, avifBuffer)

      logger.info('AVIF generation completed', {
        inputPath: imagePath,
        outputPath,
        originalSize: buffer.length,
        avifSize: avifBuffer.length,
      })

      return {
        path: outputPath,
        size: avifBuffer.length,
      }
    } catch (error: unknown) {
      logger.warn('AVIF generation failed', {
        imagePath,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Generate responsive resize variants for an image
   */
  private async resizeImage(
    imagePath: string,
    buffer: Buffer,
  ): Promise<ResizeVariant[]> {
    const variants: ResizeVariant[] = []
    const basename =
      imagePath
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') ?? 'image'
    const ext = extname(imagePath).toLowerCase().replace('.', '') || 'jpeg'

    try {
      let metadata
      let originalWidth = 0
      try {
        metadata = await sharp(buffer).metadata()
        originalWidth = metadata.width ?? 0
      } catch {
        return variants
      }

      for (const [name, config] of Object.entries(IMAGE_CONFIG.RESIZE)) {
        // Skip if original is smaller than target width
        if (originalWidth > 0 && originalWidth <= config.width) {
          continue
        }

        try {
          const outputFilename = `${basename}-${config.suffix}.${ext}`
          const outputPath = safeJoin(
            IMAGE_CONFIG.OUTPUT_DIRS.resized,
            outputFilename,
          )

          const resizedBuffer = await sharp(buffer)
            .resize({ width: config.width, withoutEnlargement: true })
            .toBuffer()

          await writeFile(outputPath, resizedBuffer)

          variants.push({
            name,
            width: config.width,
            path: outputPath,
            size: resizedBuffer.length,
          })

          logger.info('Resize variant generated', {
            inputPath: imagePath,
            variant: name,
            width: config.width,
            size: resizedBuffer.length,
          })
        } catch (error: unknown) {
          logger.warn('Resize variant failed', {
            imagePath,
            variant: name,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } catch (error: unknown) {
      logger.warn('Resize image failed', {
        imagePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return variants
  }

  /**
   * Optimize original format (re-compress JPEG/PNG)
   */
  private async optimizeOriginalFormat(
    imagePath: string,
    buffer: Buffer,
    format: string,
  ): Promise<{ path: string; size: number } | null> {
    if (format !== 'jpeg' && format !== 'png') {
      return null
    }

    try {
      const ext = format === 'jpeg' ? 'jpg' : 'png'
      const outputPath = safeJoin(
        IMAGE_CONFIG.OUTPUT_DIRS.optimized,
        this.getOptimizedFilename(imagePath, ext),
      )

      let optimizedBuffer: Buffer

      if (format === 'jpeg') {
        optimizedBuffer = await sharp(buffer)
          .jpeg({
            quality: IMAGE_CONFIG.FORMATS.jpeg.quality,
            progressive: IMAGE_CONFIG.FORMATS.jpeg.progressive,
            mozjpeg: IMAGE_CONFIG.FORMATS.jpeg.mozjpeg,
          })
          .toBuffer()
      } else {
        optimizedBuffer = await sharp(buffer)
          .png({
            quality: IMAGE_CONFIG.FORMATS.png.quality,
            compressionLevel: IMAGE_CONFIG.FORMATS.png.compressionLevel,
            palette: IMAGE_CONFIG.FORMATS.png.palette,
          })
          .toBuffer()
      }

      // Only keep if smaller than original
      if (optimizedBuffer.length >= buffer.length) {
        logger.info('Optimized format not smaller than original, skipping', {
          imagePath,
          originalSize: buffer.length,
          optimizedSize: optimizedBuffer.length,
        })
        return null
      }

      await writeFile(outputPath, optimizedBuffer)

      logger.info('Original format optimization completed', {
        inputPath: imagePath,
        outputPath,
        originalSize: buffer.length,
        optimizedSize: optimizedBuffer.length,
      })

      return {
        path: outputPath,
        size: optimizedBuffer.length,
      }
    } catch (error: unknown) {
      logger.warn('Original format optimization failed', {
        imagePath,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Generate optimized filename
   */
  private getOptimizedFilename(originalPath: string, format: string): string {
    const parts = originalPath.split('/')
    const basename = parts.pop()?.replace(/\.[^/.]+$/, '') ?? 'image'
    const parentDir = parts[parts.length - 1] ?? ''
    // Include parent directory to prevent collisions between files
    // with the same basename in different directories
    const prefix = parentDir ? `${parentDir}-` : ''
    return `${prefix}${basename}-optimized.${format}`
  }

  /**
   * Batch optimize multiple images
   */
  async optimizeImages(imagePaths: string[]): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = []

    logger.info('Starting batch image optimization', {
      count: imagePaths.length,
    })

    // Process in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize)

      const batchPromises = batch.map(async (imagePath) => {
        try {
          return await this.optimizeImage(imagePath)
        } catch (error: unknown) {
          logger.warn('Image optimization failed in batch, skipping', {
            imagePath,
            error: error instanceof Error ? error.message : String(error),
          })
          return {
            originalPath: imagePath,
            originalSize: 0,
            resizeVariants: [],
            savings: 0,
            compressionRatio: 1,
          } as OptimizationResult
        }
      })
      const batchResults = await Promise.all(batchPromises)

      results.push(...batchResults)

      // Small delay between batches
      if (i + batchSize < imagePaths.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    const totalOriginalSize = results.reduce(
      (sum, r) => sum + r.originalSize,
      0,
    )
    const totalOptimizedSize = results.reduce((sum, r) => {
      const sizes = [r.webpSize, r.avifSize, r.optimizedSize].filter(
        (s): s is number => s !== undefined && s > 0,
      )
      const best = sizes.length > 0 ? Math.min(...sizes) : r.originalSize
      return sum + best
    }, 0)
    const totalSavings = totalOriginalSize - totalOptimizedSize

    logger.info('Batch image optimization completed', {
      processed: results.length,
      totalOriginalSize: Math.round(totalOriginalSize / 1024),
      totalOptimizedSize: Math.round(totalOptimizedSize / 1024),
      totalSavings: Math.round(totalSavings / 1024),
      avgCompressionRatio:
        Math.round((totalOptimizedSize / totalOriginalSize) * 100) / 100,
    })

    return results
  }

  /**
   * Optimize an image from a buffer (for upload pipeline)
   * Returns optimized buffers without writing to filesystem
   */
  async optimizeBuffer(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<BufferOptimizationResult> {
    const startTime = Date.now()
    const format = this.detectImageFormat(filename, buffer)

    const result: BufferOptimizationResult = {
      original: { buffer, size: buffer.length, mimetype },
      resizeVariants: [],
      savings: 0,
    }

    if (buffer.length < IMAGE_CONFIG.THRESHOLDS.SMALL_FILE) {
      logger.info('Skipping buffer optimization for small file', {
        filename,
        size: buffer.length,
      })
      return result
    }

    if (format === 'jpeg' || format === 'png') {
      // Re-compress original format
      try {
        let optimizedBuffer: Buffer
        if (format === 'jpeg') {
          optimizedBuffer = await sharp(buffer)
            .jpeg({
              quality: IMAGE_CONFIG.FORMATS.jpeg.quality,
              progressive: IMAGE_CONFIG.FORMATS.jpeg.progressive,
              mozjpeg: IMAGE_CONFIG.FORMATS.jpeg.mozjpeg,
            })
            .toBuffer()
        } else {
          optimizedBuffer = await sharp(buffer)
            .png({
              quality: IMAGE_CONFIG.FORMATS.png.quality,
              compressionLevel: IMAGE_CONFIG.FORMATS.png.compressionLevel,
              palette: IMAGE_CONFIG.FORMATS.png.palette,
            })
            .toBuffer()
        }

        if (optimizedBuffer.length < buffer.length) {
          result.optimized = {
            buffer: optimizedBuffer,
            size: optimizedBuffer.length,
            mimetype,
          }
        }
      } catch (error: unknown) {
        logger.warn('Buffer original format optimization failed', {
          filename,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Generate WebP
      try {
        const webpBuffer = await sharp(buffer)
          .webp({
            quality: IMAGE_CONFIG.FORMATS.webp.quality,
            effort: IMAGE_CONFIG.FORMATS.webp.effort,
            lossless: IMAGE_CONFIG.FORMATS.webp.lossless,
          })
          .toBuffer()

        result.webp = {
          buffer: webpBuffer,
          size: webpBuffer.length,
          mimetype: 'image/webp',
        }
      } catch (error: unknown) {
        logger.warn('Buffer WebP generation failed', {
          filename,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Generate AVIF
      try {
        const avifBuffer = await sharp(buffer)
          .avif({
            quality: IMAGE_CONFIG.FORMATS.avif.quality,
            effort: IMAGE_CONFIG.FORMATS.avif.effort,
          })
          .toBuffer()

        result.avif = {
          buffer: avifBuffer,
          size: avifBuffer.length,
          mimetype: 'image/avif',
        }
      } catch (error: unknown) {
        logger.warn('Buffer AVIF generation failed', {
          filename,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Generate thumbnail
      try {
        const thumbBuffer = await sharp(buffer)
          .resize({
            width: IMAGE_CONFIG.RESIZE.thumbnail.width,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer()

        result.thumbnail = {
          buffer: thumbBuffer,
          size: thumbBuffer.length,
          mimetype: 'image/jpeg',
        }
      } catch (error: unknown) {
        logger.warn('Buffer thumbnail generation failed', {
          filename,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Generate resize variants
      let metadata
      let originalWidth = 0
      try {
        metadata = await sharp(buffer).metadata()
        originalWidth = metadata.width ?? 0
      } catch {
        return result
      }

      for (const [name, config] of Object.entries(IMAGE_CONFIG.RESIZE)) {
        if (originalWidth > 0 && originalWidth <= config.width) {
          continue
        }

        try {
          const resizedBuffer = await sharp(buffer)
            .resize({ width: config.width, withoutEnlargement: true })
            .toBuffer()

          result.resizeVariants.push({
            buffer: resizedBuffer,
            size: resizedBuffer.length,
            mimetype,
            name,
            width: config.width,
          })
        } catch (error: unknown) {
          logger.warn('Buffer resize variant failed', {
            filename,
            variant: name,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    // Calculate savings — use smallest optimized version
    const optimizedSizes = [
      result.optimized?.size,
      result.webp?.size,
      result.avif?.size,
    ].filter((s): s is number => s !== undefined && s > 0)

    const bestSize =
      optimizedSizes.length > 0 ? Math.min(...optimizedSizes) : buffer.length
    const effectiveSize = Math.min(buffer.length, bestSize)
    result.savings = buffer.length - effectiveSize

    logger.info('Buffer optimization completed', {
      filename,
      originalSize: buffer.length,
      bestSize,
      savings: result.savings,
      processingTime: Date.now() - startTime,
    })

    return result
  }
  /**
   * Generate responsive image HTML with srcset for resize variants
   */
  generateResponsiveImage(result: OptimizationResult): string {
    const alt =
      result.originalPath
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') ?? 'image'

    let html = `<!-- Responsive image: ${alt} -->\n`
    html += `<picture>\n`

    if (result.avifPath) {
      html += `  <source srcset="${result.avifPath}" type="image/avif">\n`
    }

    if (result.webpPath) {
      html += `  <source srcset="${result.webpPath}" type="image/webp">\n`
    }

    const fallbackPath = result.optimizedPath ?? result.originalPath
    const fallbackSrcset = this.buildSrcset(fallbackPath, result.resizeVariants)
    const srcsetAttribute = fallbackSrcset ? ` srcset="${fallbackSrcset}"` : ''
    html += `  <img src="${fallbackPath}"${srcsetAttribute} alt="${alt}" loading="lazy">\n`
    html += `</picture>`

    return html
  }

  private buildSrcset(_basePath: string, variants: ResizeVariant[]): string {
    return variants.map((v) => `${v.path} ${v.width}w`).join(', ')
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(results: OptimizationResult[]): {
    totalFiles: number
    totalOriginalSize: number
    totalOptimizedSize: number
    totalSavings: number
    avgCompressionRatio: number
    formatBreakdown: Record<string, number>
    totalResizeVariants: number
  } {
    const totalOriginalSize = results.reduce(
      (sum, r) => sum + r.originalSize,
      0,
    )
    const totalOptimizedSize = results.reduce((sum, r) => {
      const sizes = [r.webpSize, r.avifSize, r.optimizedSize].filter(
        (s): s is number => s !== undefined && s > 0,
      )
      const best = sizes.length > 0 ? Math.min(...sizes) : r.originalSize
      return sum + best
    }, 0)

    const totalSavings = totalOriginalSize - totalOptimizedSize

    const formatBreakdown: Record<string, number> = {}
    let totalResizeVariants = 0
    results.forEach((result) => {
      if (result.webpSize)
        formatBreakdown['webp'] = (formatBreakdown['webp'] ?? 0) + 1
      if (result.avifSize)
        formatBreakdown['avif'] = (formatBreakdown['avif'] ?? 0) + 1
      if (result.optimizedSize)
        formatBreakdown['optimized'] = (formatBreakdown['optimized'] ?? 0) + 1
      totalResizeVariants += result.resizeVariants.length
    })

    return {
      totalFiles: results.length,
      totalOriginalSize,
      totalOptimizedSize,
      totalSavings,
      avgCompressionRatio: totalOriginalSize / Math.max(totalOptimizedSize, 1),
      formatBreakdown,
      totalResizeVariants,
    }
  }
}

/**
 * Image optimization utilities
 */
export const imageOptimizer = new ImageOptimizer()

/**
 * Optimize all images in public directory
 */
export async function optimizePublicImages(): Promise<OptimizationResult[]> {
  logger.info('Starting public image optimization')

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
  const imagePaths: string[] = []

  async function findImages(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'optimized' ||
          entry.name === 'webp' ||
          entry.name === 'avif' ||
          entry.name === 'resized'
        ) {
          continue
        }
        await findImages(fullPath)
      } else if (
        imageExtensions.includes(extname(entry.name).toLowerCase()) &&
        statSync(fullPath).size >= IMAGE_CONFIG.THRESHOLDS.SMALL_FILE
      ) {
        imagePaths.push(fullPath)
      }
    }
  }

  const publicDir = ALLOWED_DIRECTORIES.PUBLIC
  await findImages(publicDir)

  logger.info('Found images to optimize', { count: imagePaths.length })

  const results = await imageOptimizer.optimizeImages(imagePaths)

  logger.info('Public image optimization completed', {
    optimized: results.length,
  })

  return results
}

/**
 * Generate image optimization report
 */
export async function generateOptimizationReport(
  results: OptimizationResult[],
): Promise<string> {
  const stats = imageOptimizer.getOptimizationStats(results)

  let report = `# Image Optimization Report\n\n`
  report += `## Summary\n`
  report += `- **Total Files**: ${stats.totalFiles}\n`
  report += `- **Original Size**: ${Math.round(stats.totalOriginalSize / 1024)}KB\n`
  report += `- **Optimized Size**: ${Math.round(stats.totalOptimizedSize / 1024)}KB\n`
  report += `- **Space Saved**: ${Math.round(stats.totalSavings / 1024)}KB (${Math.round((stats.totalSavings / stats.totalOriginalSize) * 100)}%)\n`
  report += `- **Avg Compression**: ${Math.round(stats.avgCompressionRatio * 100) / 100}x\n\n`

  report += `## Format Breakdown\n`
  Object.entries(stats.formatBreakdown).forEach(([format, count]) => {
    report += `- **${format.toUpperCase()}**: ${count} files\n`
  })

  report += `\n## Performance Impact\n`
  report += `- **Load Time Improvement**: ~${Math.round((stats.totalSavings / stats.totalOriginalSize) * 50)}% faster\n`
  report += `- **Bandwidth Savings**: ${Math.round(stats.totalSavings / 1024)}KB per page load\n`
  report += `- **CDN Cost Reduction**: ~${Math.round((stats.totalSavings / stats.totalOriginalSize) * 30)}% savings\n\n`

  return report
}
