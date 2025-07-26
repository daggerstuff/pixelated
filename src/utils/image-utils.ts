/**
 * Image optimization utility functions for responsive image handling
 */

/**
 * Calculate aspect ratio from width and height
 * @param width Width of the image
 * @param height Height of the image
 * @returns The aspect ratio as a number
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height
}

/**
 * Calculate height from width while preserving aspect ratio
 * @param width Width of the image
 * @param aspectRatio Aspect ratio to maintain
 * @returns The calculated height
 */
export function calculateHeightFromWidth(
  width: number,
  aspectRatio: number,
): number {
  return Math.round(width / aspectRatio)
}

/**
 * Calculate width from height while preserving aspect ratio
 * @param height Height of the image
 * @param aspectRatio Aspect ratio to maintain
 * @returns The calculated width
 */
export function calculateWidthFromHeight(
  height: number,
  aspectRatio: number,
): number {
  return Math.round(height * aspectRatio)
}

/**
 * Parse aspect ratio string into a number (e.g., "16:9" -> 16/9)
 * @param aspectRatio Aspect ratio as a string (e.g., "16:9")
 * @returns The aspect ratio as a number or undefined if invalid
 */
export function parseAspectRatio(aspectRatio: string): number | undefined {
  const parts = aspectRatio.split(':').map(Number)
  if (
    parts.length === 2 &&
    !isNaN(parts[0] as number) &&
    !isNaN(parts[1] as number) &&
    parts[1] !== 0
  ) {
    return parts[0] / parts[1]
  }
  return undefined
}

/**
 * Generate srcset attribute for responsive images
 * @param src Base image URL
 * @param breakpoints Array of width breakpoints
 * @param format Image format
 * @param quality Image quality (1-100)
 * @returns The srcset attribute value
 */
export function generateSrcSet(
  src: string,
  breakpoints: number[],
  format: string = 'webp',
  quality: number = 80,
): string {
  return breakpoints
    .map((bp) => `${src}?w=${bp}&format=${format}&q=${quality} ${bp}w`)
    .join(', ')
}

/**
 * Generate sizes attribute for responsive images
 * @param breakpoints Array of breakpoints in ascending order
 * @returns The sizes attribute value
 */
export function generateSizes(breakpoints: number[]): string {
  if (!breakpoints || !breakpoints.length) {
    return '100vw'
  }

  // Sort breakpoints in descending order for sizes attribute
  const sortedBreakpoints = [...breakpoints].sort((a, b) => b - a)

  // Generate sizes attribute
  const sizesArray = sortedBreakpoints.map(
    (bp) => `(min-width: ${bp}px) ${bp}px`,
  )

  // Add default size at the end
  sizesArray.push('100vw')

  return sizesArray.join(', ')
}

/**
 * Default image configuration
 */
export const defaultImageConfig = {
  defaultQuality: 80,
  defaultFormat: 'webp' as const,
  defaultBreakpoints: [320, 640, 768, 1024, 1280, 1536, 1920],
  allowedDomains: ['images.unsplash.com', 'cdn.example.com'],
  maxDimension: 2500,
  enableBlurUp: true,
  enableLazyLoading: true,
  cacheDuration: 2592000, // 30 days
  useLQIP: true, // Low Quality Image Placeholder
  enableResponsive: true,
}

/**
 * Check if an image is from an allowed domain
 * @param src Image source URL
 * @param allowedDomains Array of allowed domains
 * @returns Whether the domain is allowed
 */
export function isAllowedDomain(
  src: string,
  allowedDomains: string[] = defaultImageConfig.allowedDomains,
): boolean {
  if (!src.startsWith('http')) {
    return true
  } // Local images are always allowed

  try {
    const url = new URL(src)
    return allowedDomains.some((domain) => {
      // Handle wildcard domains (e.g., *.example.com)
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2)
        return url.hostname.endsWith(baseDomain)
      }
      return url.hostname === domain
    })
  } catch (error) {
    console.error('Error validating image domain:', error)
    return false
  }
}

/**
 * Get optimal image format based on browser support
 * This is primarily for client-side detection
 * @returns The best supported format
 */
export function getOptimalFormat(): 'avif' | 'webp' | 'jpg' {
  if (typeof document === 'undefined') {
    return 'webp'
  }

  // Check for AVIF support
  const canUseAvif = () => {
    const canvas = document.createElement('canvas')
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
  }

  // Check for WebP support
  const canUseWebP = () => {
    const canvas = document.createElement('canvas')
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }

  if (canUseAvif()) {
    return 'avif'
  }
  if (canUseWebP()) {
    return 'webp'
  }
  return 'jpg'
}

/**
 * Fix CLS (Cumulative Layout Shift) issues by setting explicit dimensions
 * Use this in client-side scripts
 */
export function preventCLS(): void {
  if (typeof document === 'undefined') {
    return
  }

  // Find images without dimensions
  const images = document.querySelectorAll('img:not([width]):not([height])')
  images.forEach((img) => {
    // Set a default aspect ratio to prevent layout shift
    ;(img as HTMLImageElement).style.aspectRatio = '16/9'
  })
}

/**
 * Determine if an image should be loaded eagerly (above the fold)
 * @param priority Whether the image is high priority
 * @param index Index of the image in a collection
 * @returns Loading strategy ('eager' or 'lazy')
 */
export function getLoadingStrategy(
  priority?: boolean,
  index?: number,
): 'eager' | 'lazy' {
  // If explicitly marked as priority, load eagerly
  if (priority) {
    return 'eager'
  }

  // If it's among the first few images, load eagerly
  if (typeof index === 'number' && index < 3) {
    return 'eager'
  }

  // Otherwise, lazy load
  return 'lazy'
}
