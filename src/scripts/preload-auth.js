/**
 * Authentication Pages Preload Script
 *
 * This script handles preloading of critical resources for the auth pages
 * to improve performance on Vercel Speed Insights measurements.
 */

/**
 * Preload essential assets for auth pages
 */
export function preloadAuthResources() {
  // Preconnect to auth providers
  const connectDomains = [
    'accounts.google.com',
    'api.supabase.com',
    'identity.supabase.com',
  ]

  connectDomains.forEach((domain) => {
    const preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = `https://${domain}`
    preconnect.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect)
  })

  // Preload critical auth JS
  const authScripts = ['/js/auth-helpers.js']

  authScripts.forEach((src) => {
    const preloadLink = document.createElement('link')
    preloadLink.rel = 'preload'
    preloadLink.as = 'script'
    preloadLink.href = src
    document.head.appendChild(preloadLink)
  })

  // Font optimization for auth pages
  const fontDisplay = document.createElement('style')
  fontDisplay.textContent = `
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400 700;
      font-display: swap;
      src: url('/fonts/inter-regular.woff2') format('woff2');
    }
  `
  document.head.appendChild(fontDisplay)

  // Lazy load non-critical parts
  setupLazyLoading()
}

/**
 * Sets up lazy loading for non-critical components
 */
function setupLazyLoading() {
  // Lazy load remaining elements as they come into view
  if ('IntersectionObserver' in window) {
    const lazyElements = document.querySelectorAll('.auth-lazy-load')

    const lazyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target

            // Handle images
            if (element.tagName === 'IMG') {
              element.src = element.dataset.src
              if (element.dataset.srcset) {
                element.srcset = element.dataset.srcset
              }
            }

            // Handle background images
            if (element.dataset.background) {
              element.style.backgroundImage = `url('${element.dataset.background}')`
            }

            element.classList.add('loaded')
            lazyObserver.unobserve(element)
          }
        })
      },
      {
        rootMargin: '100px',
      },
    )

    lazyElements.forEach((element) => {
      lazyObserver.observe(element)
    })
  } else {
    // Fallback for browsers without intersection observer
    const lazyElements = document.querySelectorAll('.auth-lazy-load')
    lazyElements.forEach((element) => {
      if (element.tagName === 'IMG') {
        element.src = element.dataset.src
      }
      if (element.dataset.background) {
        element.style.backgroundImage = `url('${element.dataset.background}')`
      }
      element.classList.add('loaded')
    })
  }
}

// Add critical CSS optimization for auth pages
export function injectCriticalAuthCSS() {
  const criticalCSS = `
    .card-gradient {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.8), rgba(30, 30, 30, 0.4));
      border: 1px solid rgba(50, 50, 50, 0.3);
    }

    .form-container {
      position: relative;
      padding-bottom: 2rem;
    }

    .fade-in {
      animation: fadeIn 0.5s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Hide clutter until fully loaded */
    .auth-lazy-load {
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .auth-lazy-load.loaded {
      opacity: 1;
    }
  `

  const style = document.createElement('style')
  style.textContent = criticalCSS
  document.head.appendChild(style)
}

// Initialize when used on a page
export function initAuthPageOptimizations() {
  // Only initialize on auth pages
  const isAuthPage = window.location.pathname.match(
    /\/(login|register|signin|signup|reset-password)/,
  )
  if (!isAuthPage) {
    return
  }

  // Apply optimizations
  preloadAuthResources()
  injectCriticalAuthCSS()

  // Report performance metrics
  if ('performance' in window) {
    window.addEventListener('load', () => {
      // Capture key metrics
      setTimeout(() => {
        const perfEntries = performance.getEntriesByType('navigation')
        if (perfEntries.length > 0) {
          const metrics = {
            fcp:
              performance.getEntriesByName('first-contentful-paint')[0]
                ?.startTime || 0,
            lcp: getLargestContentfulPaint(),
            ttfb: perfEntries[0].responseStart - perfEntries[0].requestStart,
            fid: getFirstInputDelay(),
          }

          console.info('Auth page performance metrics:', metrics)

          // Here you could send these metrics to an analytics endpoint
        }
      }, 1000)
    })
  }
}

// Helper to get LCP metric
function getLargestContentfulPaint() {
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
  return lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0
}

// Helper to get FID metric
function getFirstInputDelay() {
  const fidEntries = performance.getEntriesByType('first-input')
  return fidEntries.length > 0
    ? fidEntries[0].processingStart - fidEntries[0].startTime
    : 0
}
