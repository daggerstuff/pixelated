import { existsSync, statSync } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import sharp from 'sharp'

import {
  generateOptimizationReport,
  imageOptimizer,
  type OptimizationResult,
} from './image-optimizer'

const TMP_DIR = join(process.cwd(), 'public', 'assets', 'test-tmp')
const TEST_IMAGES = {
  jpeg: join(TMP_DIR, 'test.jpg'),
  png: join(TMP_DIR, 'test.png'),
  webp: join(TMP_DIR, 'test.webp'),
}

async function createTestImages(): Promise<void> {
  await mkdir(TMP_DIR, { recursive: true })

  // Create a JPEG above SMALL_FILE threshold (10KB) — 200x200 with random noise
  const rawNoise = Buffer.alloc(200 * 200 * 3)
  for (let i = 0; i < rawNoise.length; i += 3) {
    rawNoise[i] = Math.floor(Math.random() * 256)
    rawNoise[i + 1] = Math.floor(Math.random() * 256)
    rawNoise[i + 2] = Math.floor(Math.random() * 256)
  }
  const noiseJpeg = await sharp(rawNoise, {
    raw: { width: 200, height: 200, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
  await writeFile(TEST_IMAGES.jpeg, noiseJpeg)

  // Create a PNG above threshold — 200x200 with random noise
  const rawPngNoise = Buffer.alloc(200 * 200 * 4)
  for (let i = 0; i < rawPngNoise.length; i += 4) {
    rawPngNoise[i] = Math.floor(Math.random() * 256)
    rawPngNoise[i + 1] = Math.floor(Math.random() * 256)
    rawPngNoise[i + 2] = Math.floor(Math.random() * 256)
    rawPngNoise[i + 3] = 255
  }
  const pngBuffer = await sharp(rawPngNoise, {
    raw: { width: 200, height: 200, channels: 4 },
  })
    .png()
    .toBuffer()
  await writeFile(TEST_IMAGES.png, pngBuffer)

  // Create a WebP
  const webpBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 100, g: 200, b: 100 },
    },
  })
    .webp({ quality: 90 })
    .toBuffer()
  await writeFile(TEST_IMAGES.webp, webpBuffer)
}

describe('ImageOptimizer', () => {
  beforeEach(async () => {
    await createTestImages()
  })

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true })
    // Clean up output dirs that may have been created during tests
    const outputDirs = [
      join(process.cwd(), 'public', 'assets', 'webp'),
      join(process.cwd(), 'public', 'assets', 'avif'),
      join(process.cwd(), 'public', 'assets', 'optimized'),
      join(process.cwd(), 'public', 'assets', 'resized'),
    ]
    for (const dir of outputDirs) {
      const testFiles = ['test-optimized.webp', 'test-optimized.avif']
      for (const f of testFiles) {
        const p = join(dir, f)
        if (existsSync(p)) await rm(p, { force: true })
      }
    }
  })

  describe('optimizeImage', () => {
    it('should optimize a JPEG and generate WebP + AVIF', async () => {
      const result = await imageOptimizer.optimizeImage(TEST_IMAGES.jpeg)

      expect(result.originalPath).toBe(TEST_IMAGES.jpeg)
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.webpPath).toBeDefined()
      expect(result.webpSize).toBeGreaterThan(0)
      expect(result.avifPath).toBeDefined()
      expect(result.avifSize).toBeGreaterThan(0)
      expect(result.savings).toBeGreaterThan(0)
      expect(result.compressionRatio).toBeGreaterThanOrEqual(1)

      // Verify files were actually written
      if (result.webpPath) {
        expect(existsSync(result.webpPath)).toBe(true)
        expect(statSync(result.webpPath).size).toBe(result.webpSize)
      }
      if (result.avifPath) {
        expect(existsSync(result.avifPath)).toBe(true)
        expect(statSync(result.avifPath).size).toBe(result.avifSize)
      }
    })

    it('should optimize a PNG and generate WebP + AVIF', async () => {
      const result = await imageOptimizer.optimizeImage(TEST_IMAGES.png)

      expect(result.originalPath).toBe(TEST_IMAGES.png)
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.webpPath).toBeDefined()
      expect(result.webpSize).toBeGreaterThan(0)
      expect(result.avifPath).toBeDefined()
      expect(result.avifSize).toBeGreaterThan(0)
      expect(result.savings).toBeGreaterThanOrEqual(0)
    })

    it('should produce smaller WebP/AVIF than original for JPEG', async () => {
      const result = await imageOptimizer.optimizeImage(TEST_IMAGES.jpeg)

      // WebP and AVIF should generally be smaller than the original JPEG
      if (result.webpSize) {
        expect(result.webpSize).toBeLessThanOrEqual(result.originalSize)
      }
      if (result.avifSize) {
        expect(result.avifSize).toBeLessThanOrEqual(result.originalSize)
      }
    })

    it('should skip optimization for files below small file threshold', async () => {
      // Create a tiny JPEG below 10KB threshold
      const tinyBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg({ quality: 50 })
        .toBuffer()
      const tinyPath = join(TMP_DIR, 'tiny.jpg')
      await writeFile(tinyPath, tinyBuffer)

      const tinySize = statSync(tinyPath).size
      if (tinySize < 10 * 1024) {
        const result = await imageOptimizer.optimizeImage(tinyPath)
        expect(result.savings).toBe(0)
        expect(result.compressionRatio).toBe(1)
        expect(result.webpPath).toBeUndefined()
        expect(result.avifPath).toBeUndefined()
      }
    })

    it('should throw on invalid path', async () => {
      await expect(
        imageOptimizer.optimizeImage('/nonexistent/path/to/image.jpg'),
      ).rejects.toThrow()
    })
  })

  describe('optimizeImages (batch)', () => {
    it('should process multiple images in batch', async () => {
      const paths = [TEST_IMAGES.jpeg, TEST_IMAGES.png]
      const results = await imageOptimizer.optimizeImages(paths)

      expect(results).toHaveLength(2)
      expect(results[0].originalPath).toBe(TEST_IMAGES.jpeg)
      expect(results[1].originalPath).toBe(TEST_IMAGES.png)
      expect(results[0].webpSize).toBeGreaterThan(0)
      expect(results[1].webpSize).toBeGreaterThan(0)
    })
  })

  describe('getOptimizationStats', () => {
    it('should compute correct statistics across results', () => {
      const mockResults: OptimizationResult[] = [
        {
          originalPath: 'a.jpg',
          originalSize: 100000,
          webpSize: 70000,
          avifSize: 50000,
          resizeVariants: [],
          savings: 50000,
          compressionRatio: 2,
        },
        {
          originalPath: 'b.png',
          originalSize: 200000,
          webpSize: 150000,
          avifSize: 120000,
          resizeVariants: [],
          savings: 80000,
          compressionRatio: 1.67,
        },
      ]

      const stats = imageOptimizer.getOptimizationStats(mockResults)

      expect(stats.totalFiles).toBe(2)
      expect(stats.totalOriginalSize).toBe(300000)
      // best optimized = min(70000,50000) + min(150000,120000) = 50000+120000
      expect(stats.totalOptimizedSize).toBe(170000)
      expect(stats.totalSavings).toBe(130000)
      expect(stats.avgCompressionRatio).toBe(
        stats.totalOriginalSize / stats.totalOptimizedSize,
      )
      expect(stats.formatBreakdown.webp).toBe(2)
      expect(stats.formatBreakdown.avif).toBe(2)
    })

    it('should handle results with no optimized versions', () => {
      const mockResults: OptimizationResult[] = [
        {
          originalPath: 'small.gif',
          originalSize: 5000,
          resizeVariants: [],
          savings: 0,
          compressionRatio: 1,
        },
      ]

      const stats = imageOptimizer.getOptimizationStats(mockResults)

      expect(stats.totalFiles).toBe(1)
      expect(stats.totalOriginalSize).toBe(5000)
      expect(stats.totalOptimizedSize).toBe(5000)
      expect(stats.totalSavings).toBe(0)
      expect(stats.formatBreakdown.webp ?? 0).toBe(0)
    })
  })

  describe('generateResponsiveImage', () => {
    it('should generate <picture> HTML with AVIF and WebP sources', () => {
      const result: OptimizationResult = {
        originalPath: '/public/assets/test.jpg',
        originalSize: 100000,
        webpPath: '/public/assets/webp/test-optimized.webp',
        webpSize: 70000,
        avifPath: '/public/assets/avif/test-optimized.avif',
        avifSize: 50000,
        resizeVariants: [],
        savings: 50000,
        compressionRatio: 2,
      }

      const html = imageOptimizer.generateResponsiveImage(result)

      expect(html).toContain('<picture>')
      expect(html).toContain('type="image/avif"')
      expect(html).toContain('type="image/webp"')
      expect(html).toContain('loading="lazy"')
      expect(html).toContain('test"')
    })

    it('should fall back to original path when no optimized versions', () => {
      const result: OptimizationResult = {
        originalPath: '/public/assets/test.jpg',
        originalSize: 5000,
        resizeVariants: [],
        savings: 0,
        compressionRatio: 1,
      }

      const html = imageOptimizer.generateResponsiveImage(result)

      expect(html).toContain('<picture>')
      expect(html).not.toContain('type="image/avif"')
      expect(html).not.toContain('type="image/webp"')
      expect(html).toContain('src="/public/assets/test.jpg"')
    })
  })

  describe('generateOptimizationReport', () => {
    it('should generate a readable report', async () => {
      const mockResults: OptimizationResult[] = [
        {
          originalPath: 'test.jpg',
          originalSize: 102400,
          webpSize: 71680,
          avifSize: 51200,
          resizeVariants: [],
          savings: 51200,
          compressionRatio: 2,
        },
      ]

      const report = await generateOptimizationReport(mockResults)

      expect(report).toContain('Image Optimization Report')
      expect(report).toContain('Total Files')
      expect(report).toContain('Format Breakdown')
      expect(report).toContain('WEBP')
      expect(report).toContain('AVIF')
    })
  })

  describe('resizeImage (via optimizeImage)', () => {
    it('should generate resize variants for images wider than breakpoints', async () => {
      const rawNoise = Buffer.alloc(1300 * 800 * 3)
      for (let i = 0; i < rawNoise.length; i += 3) {
        rawNoise[i] = Math.floor(Math.random() * 256)
        rawNoise[i + 1] = Math.floor(Math.random() * 256)
        rawNoise[i + 2] = Math.floor(Math.random() * 256)
      }
      const wideBuffer = await sharp(rawNoise, {
        raw: { width: 1300, height: 800, channels: 3 },
      })
        .jpeg({ quality: 85 })
        .toBuffer()
      const widePath = join(TMP_DIR, 'wide.jpg')
      await writeFile(widePath, wideBuffer)

      const result = await imageOptimizer.optimizeImage(widePath)

      expect(result.resizeVariants.length).toBeGreaterThan(0)
      for (const variant of result.resizeVariants) {
        expect(variant.width).toBeGreaterThan(0)
        expect(variant.size).toBeGreaterThan(0)
        expect(existsSync(variant.path)).toBe(true)
        expect(statSync(variant.path).size).toBe(variant.size)
      }
    }, 30000)

    it('should not generate resize variants larger than the original width', async () => {
      const result = await imageOptimizer.optimizeImage(TEST_IMAGES.jpeg)
      const originalMeta = await sharp(TEST_IMAGES.jpeg).metadata()
      const originalWidth = originalMeta.width ?? 0

      for (const variant of result.resizeVariants) {
        expect(variant.width).toBeLessThan(originalWidth)
      }
    })
  })

  describe('optimizeOriginalFormat (via optimizeImage)', () => {
    it('should re-compress JPEG and populate optimizedPath/optimizedSize', async () => {
      const result = await imageOptimizer.optimizeImage(TEST_IMAGES.jpeg)

      expect(result.optimizedPath).toBeDefined()
      expect(result.optimizedSize).toBeDefined()
      if (result.optimizedPath && result.optimizedSize) {
        expect(existsSync(result.optimizedPath)).toBe(true)
        expect(statSync(result.optimizedPath).size).toBe(result.optimizedSize)
        expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
      }
    })
  })

  describe('optimizeBuffer', () => {
    it('should optimize a JPEG buffer and return all variants', async () => {
      const rawNoise = Buffer.alloc(400 * 300 * 3)
      for (let i = 0; i < rawNoise.length; i += 3) {
        rawNoise[i] = Math.floor(Math.random() * 256)
        rawNoise[i + 1] = Math.floor(Math.random() * 256)
        rawNoise[i + 2] = Math.floor(Math.random() * 256)
      }
      const jpegBuffer = await sharp(rawNoise, {
        raw: { width: 400, height: 300, channels: 3 },
      })
        .jpeg({ quality: 90 })
        .toBuffer()

      const result = await imageOptimizer.optimizeBuffer(
        jpegBuffer,
        'test.jpg',
        'image/jpeg',
      )

      expect(result.original.buffer).toBe(jpegBuffer)
      expect(result.original.size).toBe(jpegBuffer.length)
      expect(result.original.mimetype).toBe('image/jpeg')
      expect(result.webp).toBeDefined()
      expect(result.webp?.mimetype).toBe('image/webp')
      expect(result.avif).toBeDefined()
      expect(result.avif?.mimetype).toBe('image/avif')
      expect(result.thumbnail).toBeDefined()
      expect(result.thumbnail?.mimetype).toBe('image/jpeg')
      expect(result.resizeVariants.length).toBeGreaterThan(0)
      expect(result.savings).toBeGreaterThanOrEqual(0)
    }, 30000)

    it('should optimize a PNG buffer', async () => {
      const rawNoise = Buffer.alloc(400 * 300 * 4)
      for (let i = 0; i < rawNoise.length; i += 4) {
        rawNoise[i] = Math.floor(Math.random() * 256)
        rawNoise[i + 1] = Math.floor(Math.random() * 256)
        rawNoise[i + 2] = Math.floor(Math.random() * 256)
        rawNoise[i + 3] = 255
      }
      const pngBuffer = await sharp(rawNoise, {
        raw: { width: 400, height: 300, channels: 4 },
      })
        .png()
        .toBuffer()

      const result = await imageOptimizer.optimizeBuffer(
        pngBuffer,
        'test.png',
        'image/png',
      )

      expect(result.original.mimetype).toBe('image/png')
      expect(result.webp).toBeDefined()
      expect(result.avif).toBeDefined()
    }, 30000)

    it('should skip optimization for buffers below small file threshold', async () => {
      const tinyBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg({ quality: 30 })
        .toBuffer()

      const result = await imageOptimizer.optimizeBuffer(
        tinyBuffer,
        'tiny.jpg',
        'image/jpeg',
      )

      expect(result.savings).toBe(0)
      expect(result.webp).toBeUndefined()
      expect(result.avif).toBeUndefined()
    })

    it('should return optimized original only if smaller than input', async () => {
      const rawNoise = Buffer.alloc(400 * 300 * 3)
      for (let i = 0; i < rawNoise.length; i += 3) {
        rawNoise[i] = Math.floor(Math.random() * 256)
        rawNoise[i + 1] = Math.floor(Math.random() * 256)
        rawNoise[i + 2] = Math.floor(Math.random() * 256)
      }
      const jpegBuffer = await sharp(rawNoise, {
        raw: { width: 400, height: 300, channels: 3 },
      })
        .jpeg({ quality: 90 })
        .toBuffer()

      const result = await imageOptimizer.optimizeBuffer(
        jpegBuffer,
        'test.jpg',
        'image/jpeg',
      )

      if (result.optimized) {
        expect(result.optimized.size).toBeLessThan(jpegBuffer.length)
      }
    }, 30000)
  })
})
