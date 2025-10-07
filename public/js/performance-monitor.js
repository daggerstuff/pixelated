// Performance Monitoring Script
// Tracks and reports page load times to identify performance bottlenecks

;(function () {
  'use strict'

  // Performance metrics collection
  const metrics = {
    navigationStart: 0,
    domContentLoaded: 0,
    loadComplete: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
  }

  // Collect navigation timing
  function collectNavigationTiming() {
    if (!window.performance || !window.performance.timing) {
      return
    }

    const {timing} = window.performance
    metrics.navigationStart = timing.navigationStart
    metrics.domContentLoaded =
      timing.domContentLoadedEventEnd - timing.navigationStart
    metrics.loadComplete = timing.loadEventEnd - timing.navigationStart
  }

  // Collect Core Web Vitals
  function collectCoreWebVitals() {
    // First Contentful Paint
    if (window.performance && window.performance.getEntriesByType) {
      const paintEntries = window.performance.getEntriesByType('paint')
      const fcpEntry = paintEntries.find(
        (entry) => entry.name === 'first-contentful-paint',
      )
      if (fcpEntry) {
        metrics.firstContentfulPaint = fcpEntry.startTime
      }
    }

    // Largest Contentful Paint (using PerformanceObserver if available)
    if (window.PerformanceObserver) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          metrics.largestContentfulPaint = lastEntry.startTime
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      } catch (e) {
        console.warn('LCP observation failed:', e)
      }
    }
  }

  // Calculate Time to Interactive (simplified)
  function calculateTTI() {
    if (!window.performance || !window.performance.timing) {
      return
    }

    // Simple TTI approximation: when main thread is quiet for 5 seconds
    const {timing} = window.performance
    const domInteractive = timing.domInteractive - timing.navigationStart
    metrics.timeToInteractive = domInteractive
  }

  // Report performance metrics
  function reportMetrics() {
    const report = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      metrics: metrics,
      // Page-specific context
      pageType: getPageType(),
      blogPostCount: getBlogPostCount(),
      hasImages: document.images.length > 0,
      scriptCount: document.scripts.length,
      stylesheetCount: document.styleSheets.length,
    }

    // Log to console in development
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      console.group('🚀 Page Performance Report')
      console.log('📊 Load Times:')
      console.log(`  DOMContentLoaded: ${metrics.domContentLoaded}ms`)
      console.log(`  Load Complete: ${metrics.loadComplete}ms`)
      console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint}ms`)
      console.log(
        `  Largest Contentful Paint: ${metrics.largestContentfulPaint}ms`,
      )
      console.log(`  Time to Interactive: ${metrics.timeToInteractive}ms`)
      console.log('📋 Page Context:')
      console.log(`  Page Type: ${report.pageType}`)
      console.log(`  Blog Posts: ${report.blogPostCount}`)
      console.log(`  Images: ${report.hasImages ? document.images.length : 0}`)
      console.log(`  Scripts: ${report.scriptCount}`)
      console.log(`  Stylesheets: ${report.stylesheetCount}`)
      console.groupEnd()

      // Performance warnings
      if (metrics.loadComplete > 3000) {
        console.warn(
          '⚠️ Slow page load detected! Consider optimizing resources.',
        )
      }
      if (metrics.largestContentfulPaint > 2500) {
        console.warn('⚠️ Poor LCP score! Optimize largest content element.')
      }
    }

    // Send to analytics in production (if needed)
    if (window.location.hostname !== 'localhost' && window.gtag) {
      window.gtag('event', 'page_performance', {
        page_load_time: metrics.loadComplete,
        dom_content_loaded: metrics.domContentLoaded,
        first_contentful_paint: metrics.firstContentfulPaint,
        page_type: report.pageType,
      })
    }

    return report
  }

  // Helper functions
  function getPageType() {
    const path = window.location.pathname
    if (path === '/') {
      return 'home'
    }
    if (path.startsWith('/blog')) {
      return 'blog'
    }
    if (path.startsWith('/features')) {
      return 'features'
    }
    if (path.startsWith('/dashboard')) {
      return 'dashboard'
    }
    if (path.startsWith('/login')) {
      return 'login'
    }
    return 'other'
  }

  function getBlogPostCount() {
    // Try to detect blog post count from page content
    const blogPosts = document.querySelectorAll(
      '[data-blog-post], .blog-post, li:has(a[href*="/blog/"])',
    )
    return blogPosts.length
  }

  // Initialize performance monitoring
  function init() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 100)
      })
      return
    }

    collectNavigationTiming()
    collectCoreWebVitals()
    calculateTTI()

    // Report metrics after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        reportMetrics()
      }, 1000)
    })
  }

  // Start monitoring
  init()

  // Expose metrics for debugging
  window.performanceMetrics = metrics
  window.getPerformanceReport = reportMetrics
})()
