/**
 * Client-side script to optimize existing images in the DOM
 * This runs automatically to enhance images that weren't using our components
 */

import { preventCLS } from '../utils/image-utils'

/**
 * Apply blur-up loading effect to an image
 * @param img The image element
 */
function applyBlurUp(img: HTMLImageElement): void {
  // Skip images that already have optimization classes
  if (
    img.classList.contains('responsive-image') ||
    img.classList.contains('cms-image') ||
    img.classList.contains('blur-up') ||
    img.getAttribute('data-optimized') === 'true'
  ) {
    return
  }

  // Don't process SVGs or data URLs
  if (img.src.startsWith('data:') || img.src.endsWith('.svg')) {
    return
  }

  // Add classes for styling
  img.classList.add('blur-up')
  img.setAttribute('data-optimized', 'true')

  // Create wrapper
  const wrapper = document.createElement('div')
  wrapper.classList.add('img-wrapper')
  wrapper.style.position = 'relative'
  wrapper.style.overflow = 'hidden'
  wrapper.style.display = 'inline-block'

  // Preserve original styles and dimensions
  const computedStyle = window.getComputedStyle(img)
  wrapper.style.width = computedStyle.width

  if (img.height && img.width) {
    wrapper.style.aspectRatio = `${img.width} / ${img.height}`
  }

  // Placeholder setup
  const placeholder = document.createElement('div')
  placeholder.classList.add('blur-placeholder')
  placeholder.style.position = 'absolute'
  placeholder.style.top = '0'
  placeholder.style.left = '0'
  placeholder.style.right = '0'
  placeholder.style.bottom = '0'
  placeholder.style.zIndex = '0'

  // Create low-quality placeholder image
  const placeholderImg = document.createElement('img')

  // Create a tiny version of the original image
  // If it's a remote URL, add parameters for a small blurred version
  let placeholderSrc = img.src
  if (placeholderSrc.includes('?')) {
    placeholderSrc += '&w=20&q=30&blur=20'
  } else {
    placeholderSrc += '?w=20&q=30&blur=20'
  }

  placeholderImg.src = placeholderSrc
  placeholderImg.alt = ''
  placeholderImg.setAttribute('aria-hidden', 'true')
  placeholderImg.style.width = '100%'
  placeholderImg.style.height = '100%'
  placeholderImg.style.objectFit = computedStyle.objectFit || 'cover'
  placeholderImg.style.filter = 'blur(20px)'
  placeholderImg.style.transform = 'scale(1.1)'

  // Set original image to load on top
  img.style.position = 'relative'
  img.style.zIndex = '1'
  img.style.opacity = '0'
  img.style.transition = 'opacity 300ms ease-in'

  // Show the image once loaded
  if (img.complete) {
    img.style.opacity = '1'
  } else {
    img.addEventListener('load', () => {
      img.style.opacity = '1'
    })
  }

  // Add everything to the DOM
  placeholder.appendChild(placeholderImg)

  // Replace the image with our wrapper
  const parent = img.parentNode
  if (parent) {
    parent.insertBefore(wrapper, img)
    wrapper.appendChild(placeholder)
    wrapper.appendChild(img)
  }
}

/**
 * Convert <img> tags to modern picture tags with WebP and AVIF support
 * @param img The image element
 */
function enhanceWithPictureTag(img: HTMLImageElement): void {
  // Skip images that already have optimization or are SVGs
  if (
    img.closest('picture') ||
    img.src.startsWith('data:') ||
    img.src.endsWith('.svg') ||
    img.getAttribute('data-enhanced') === 'true'
  ) {
    return
  }

  // Create picture element
  const picture = document.createElement('picture')

  // Try to determine if the browser supports AVIF and WebP
  const supportsAvif = CSS.supports('image-rendering', 'optimizeSpeed')
  const supportsWebp = CSS.supports('image-rendering', 'optimizequality')

  // Only add source elements for supported formats
  if (supportsAvif) {
    const avifSource = document.createElement('source')
    avifSource.type = 'image/avif'
    // Modify src for AVIF if needed (depends on your image service)
    let avifSrc = img.src
    if (avifSrc.includes('?')) {
      avifSrc += '&format=avif'
    } else {
      avifSrc += '?format=avif'
    }
    avifSource.srcset = avifSrc
    picture.appendChild(avifSource)
  }

  if (supportsWebp) {
    const webpSource = document.createElement('source')
    webpSource.type = 'image/webp'
    // Modify src for WebP if needed
    let webpSrc = img.src
    if (webpSrc.includes('?')) {
      webpSrc += '&format=webp'
    } else {
      webpSrc += '?format=webp'
    }
    webpSource.srcset = webpSrc
    picture.appendChild(webpSource)
  }

  // Mark as enhanced
  img.setAttribute('data-enhanced', 'true')

  // Replace the image with our picture element
  const parent = img.parentNode
  if (parent) {
    parent.insertBefore(picture, img)
    picture.appendChild(img)
  }
}

/**
 * Add loading="lazy" to images below the fold
 * @param img The image element
 */
function addLazyLoading(img: HTMLImageElement): void {
  // Skip if already has loading attribute
  if (img.hasAttribute('loading')) {
    return
  }

  // Check if image is likely below the fold
  const rect = img.getBoundingClientRect()
  const isAboveTheFold = rect.top < window.innerHeight

  // Add appropriate loading attribute
  img.loading = isAboveTheFold ? 'eager' : 'lazy'
}

/**
 * Apply all optimizations to images in the DOM
 */
function optimizeAllImages(): void {
  // Fix CLS (Cumulative Layout Shift) issues
  preventCLS()

  // Find all images on the page
  const images = document.querySelectorAll('img:not([data-no-optimize])')

  images.forEach((img) => {
    if (img instanceof HTMLImageElement) {
      // Apply optimizations
      applyBlurUp(img)
      enhanceWithPictureTag(img)
      addLazyLoading(img)
    }
  })
}

// Run optimization when DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', optimizeAllImages)
  } else {
    optimizeAllImages()
  }
}

// Also run when the window load event fires to catch dynamically added images
window.addEventListener('load', () => {
  optimizeAllImages()
})

// Optional: observe DOM changes to optimize newly added images
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    let hasNewImages = false

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element

            // Check if the added node is an image
            if (element.tagName === 'IMG') {
              hasNewImages = true
            }

            // Check if the added node contains images
            if (element.querySelectorAll) {
              const images = element.querySelectorAll('img')
              if (images.length > 0) {
                hasNewImages = true
              }
            }
          }
        })
      }
    })

    if (hasNewImages) {
      optimizeAllImages()
    }
  })

  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

export { optimizeAllImages }
