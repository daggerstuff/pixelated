/**
 * Image Optimization Script
 *
 * Implements progressive loading and optimization for images across the site
 */

// Optimize all images on the page
export function optimizeAllImages() {
  // Implement lazy loading for all images that don't already have loading attribute
  const images = document.querySelectorAll('img:not([loading])')
  images.forEach((img) => {
    // Add loading="lazy" to images not in viewport
    if (!isInViewport(img)) {
      img.setAttribute('loading', 'lazy')
    }

    // Add decoding="async" for better rendering performance
    if (!img.hasAttribute('decoding')) {
      img.setAttribute('decoding', 'async')
    }
  })

  // Implement responsive image loading
  const responsiveImages = document.querySelectorAll('img:not([srcset])')
  responsiveImages.forEach((img) => {
    if (img.src && !img.src.includes('data:image') && !img.srcset) {
      setupResponsiveImage(img)
    }
  })

  // Add blur-up effect for important images
  const heroImages = document.querySelectorAll(
    '.hero-image, section img:first-of-type',
  )
  heroImages.forEach(setupBlurUpEffect)
}

// Check if element is in viewport
function isInViewport(element) {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

// Set up responsive image loading
function setupResponsiveImage(img) {
  // Skip if image has no src or is SVG
  if (!img.src || img.src.endsWith('.svg')) {
    return
  }

  // Skip images that are part of components or have special handling
  if (img.closest('.no-optimize') || img.classList.contains('no-optimize')) {
    return
  }

  // Get image dimensions
  const imgWidth = img.width || img.clientWidth
  const imgHeight = img.height || img.clientHeight

  // Skip tiny images or those with no dimensions
  if (imgWidth < 50 || imgHeight < 50 || !imgWidth || !imgHeight) {
    return
  }

  // Set width and height attributes if missing to prevent layout shifts
  if (
    !img.getAttribute('width') &&
    !img.getAttribute('height') &&
    imgWidth &&
    imgHeight
  ) {
    img.setAttribute('width', imgWidth.toString())
    img.setAttribute('height', imgHeight.toString())
  }

  // Add intrinsic aspect ratio to prevent layout shifts
  if (imgWidth && imgHeight) {
    img.style.aspectRatio = `${imgWidth} / ${imgHeight}`
  }
}

// Implement blur-up loading effect for hero images
function setupBlurUpEffect(img) {
  // Skip if already processed or has specific classes
  if (
    img.classList.contains('blur-processed') ||
    img.classList.contains('no-blur')
  ) {
    return
  }

  // Create wrapper for blur-up effect
  const wrapper = document.createElement('div')
  wrapper.className = 'img-blur-wrapper'
  wrapper.style.position = 'relative'
  wrapper.style.overflow = 'hidden'
  wrapper.style.display = 'inline-block'
  wrapper.style.width = '100%'

  // Clone the image for placeholder (low quality)
  const placeholder = img.cloneNode(true)
  placeholder.classList.add('blur-placeholder')
  placeholder.style.position = 'absolute'
  placeholder.style.top = '0'
  placeholder.style.left = '0'
  placeholder.style.width = '100%'
  placeholder.style.height = '100%'
  placeholder.style.filter = 'blur(10px)'
  placeholder.style.transform = 'scale(1.05)'
  placeholder.style.opacity = '1'
  placeholder.style.transition = 'opacity 0.3s ease-out'

  // Set low quality source
  if (img.src && !img.src.includes('data:image')) {
    // Create a low quality version URL - you might need to adjust this
    // based on your actual image handling system
    const lowQualitySrc = img.src.replace(/\.(jpe?g|png)$/i, '-low.$1')
    placeholder.src = lowQualitySrc
    placeholder.setAttribute('aria-hidden', 'true')
    placeholder.setAttribute('alt', '')
  }

  // Style the main image
  img.style.position = 'relative'
  img.style.opacity = '0'
  img.style.transition = 'opacity 0.3s ease-in'
  img.classList.add('blur-processed')

  // Handle image load event
  img.onload = function () {
    img.style.opacity = '1'
    placeholder.style.opacity = '0'

    // Remove placeholder after transition
    setTimeout(() => {
      placeholder.remove()
    }, 300)
  }

  // Add to DOM
  img.parentNode.insertBefore(wrapper, img)
  wrapper.appendChild(placeholder)
  wrapper.appendChild(img)
}
