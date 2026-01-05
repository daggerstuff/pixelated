// Universal Demo Analytics System
import {
  DEMO_PAGES_CONFIG,
  ANALYTICS_EVENTS,
  ANALYTICS_CONFIG,
  SCROLL_DEPTH_THRESHOLDS,
  TIME_THRESHOLDS,
  type DemoPageName,
} from './demo-analytics-config'

interface AnalyticsEventData {
  event: string
  timestamp: number
  session_id: string
  page_name: string
  ab_variant: string
  url: string
  referrer: string
  user_agent: string
  viewport_width: number
  viewport_height: number
  [key: string]: unknown
}

interface PageConfig {
  abTestVariants: {
    headline: Record<string, string>
    cta: Record<string, string>
    urgency: Record<string, string>
  }
  // Add other page config properties as needed
}

export class UniversalDemoAnalytics {
  private pageName: DemoPageName
  private pageConfig: PageConfig
  private sessionId: string
  private startTime: number
  private abTestVariant: string
  private scrollDepths: Set<number>
  private sectionViews: Set<string>
  private eventQueue: AnalyticsEventData[]
  private isInitialized: boolean

  constructor(pageName: DemoPageName) {
    this.pageName = pageName
    this.pageConfig = DEMO_PAGES_CONFIG[pageName]
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()
    this.scrollDepths = new Set()
    this.sectionViews = new Set()
    this.eventQueue = []
    this.isInitialized = false
    this.abTestVariant = this.getOrSetABTestVariant()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Apply A/B test variant
      this.applyABTestVariant()

      // Track initial page view
      await this.trackPageView()

      // Set up event listeners
      this.setupScrollTracking()
      this.setupSectionTracking()
      this.setupCTATracking()
      this.setupDemoInteractionTracking()
      this.setupTimeTracking()
      this.setupErrorTracking()
      this.setupPerformanceTracking()

      // Set up periodic event flushing
      this.setupEventFlushing()

      this.isInitialized = true

      console.log(`Universal Demo Analytics initialized for ${this.pageName}`, {
        sessionId: this.sessionId,
        variant: this.abTestVariant,
        pageConfig: this.pageConfig,
      })
    } catch (error: unknown) {
      console.error('Failed to initialize analytics:', error)
    }
  }

  private generateSessionId(): string {
    const stored = sessionStorage.getItem(
      ANALYTICS_CONFIG.STORAGE_KEYS.SESSION_ID,
    )
    if (stored) {
      return stored
    }

    const newId = `demo_${this.pageName}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    sessionStorage.setItem(ANALYTICS_CONFIG.STORAGE_KEYS.SESSION_ID, newId)
    return newId
  }

  private getOrSetABTestVariant(): string {
    let variant = sessionStorage.getItem(
      ANALYTICS_CONFIG.STORAGE_KEYS.AB_VARIANT,
    )

    if (!variant) {
      const variants = Object.keys(this.pageConfig.abTestVariants.headline)
      variant = variants[Math.floor(Math.random() * variants.length)]
      sessionStorage.setItem(ANALYTICS_CONFIG.STORAGE_KEYS.AB_VARIANT, variant)

      // Track variant assignment
      this.queueEvent(ANALYTICS_EVENTS.AB_TEST_VARIANT, {
        variant: variant,
        page_name: this.pageName,
      })
    }

    return variant
  }

  private applyABTestVariant() {
    const variant = this.abTestVariant
    const config = this.pageConfig.abTestVariants

    // Update headline
    const headlineElement = document.getElementById(
      'headline-text',
    ) as HTMLElement
    if (headlineElement && config.headline[variant]) {
      headlineElement.textContent = config.headline[variant]
    }

    // Update CTA
    const ctaElement = document.getElementById('cta-text') as HTMLElement
    if (ctaElement && config.cta[variant]) {
      ctaElement.textContent = config.cta[variant]
    }

    // Update urgency badge
    const urgencyElement = document.getElementById(
      'urgency-text',
    ) as HTMLElement
    if (urgencyElement && config.urgency[variant]) {
      urgencyElement.textContent = config.urgency[variant]
    }

    // Add variant class to body
    document.body.classList.add(`variant-${variant.toLowerCase()}`)
    document.body.classList.add(`page-${this.pageName}`)
  }

  private async trackPageView(): Promise<void> {
    await this.trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, {
      title: document.title,
      page_name: this.pageName,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: screen.width,
      screen_height: screen.height,
      user_agent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }

  private setupScrollTracking() {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollPercent = Math.round(
            (window.scrollY /
              (document.documentElement.scrollHeight - window.innerHeight)) *
              100,
          )

          SCROLL_DEPTH_THRESHOLDS.forEach((threshold) => {
            if (
              scrollPercent >= threshold &&
              !this.scrollDepths.has(threshold)
            ) {
              this.scrollDepths.add(threshold)
              this.trackEvent(ANALYTICS_EVENTS.SCROLL_DEPTH, {
                depth_percent: threshold,
                scroll_position: window.scrollY,
                page_height: document.documentElement.scrollHeight,
              })
            }
          })

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  private setupSectionTracking() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const sectionId =
              entry.target.id || entry.target.className || 'unknown-section'
            if (!this.sectionViews.has(sectionId)) {
              this.sectionViews.add(sectionId)
              this.trackEvent(ANALYTICS_EVENTS.SECTION_VIEW, {
                section: sectionId,
                time_to_section: Date.now() - this.startTime,
                section_position: entry.boundingClientRect.top,
              })
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    // Observe all major sections
    document
      .querySelectorAll('section, .hero-section, [data-section]')
      .forEach((section) => {
        observer.observe(section)
      })
  }

  private setupCTATracking() {
    document
      .querySelectorAll('[data-event="cta_click"], button, a[href]')
      .forEach((element) => {
        element.addEventListener('click', (e) => {
          const target = e.target as HTMLElement
          const location = target.getAttribute('data-location') || 'unknown'
          const text = target.textContent?.trim() || 'unknown'
          const href = target.getAttribute('href')

          this.trackEvent(ANALYTICS_EVENTS.CTA_CLICK, {
            cta_location: location,
            cta_text: text,
            cta_href: href,
            time_to_click: Date.now() - this.startTime,
            element_type: target.tagName.toLowerCase(),
          })
        })
      })
  }

  private setupDemoInteractionTracking() {
    // Track demo component interactions
    const demoContainers = document.querySelectorAll(
      '.bg-slate-900\\/50, [data-demo], .demo-container',
    )
    demoContainers.forEach((container) => {
      container.addEventListener('click', (e) => {
        this.trackEvent(ANALYTICS_EVENTS.DEMO_INTERACTION, {
          interaction_type: 'demo_click',
          demo_section: container.className,
          time_to_interaction: Date.now() - this.startTime,
          target_element: (e.target as HTMLElement).tagName,
        })
      })
    })

    // Track input focus in demos
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement
      if (target.matches('input, textarea, select')) {
        this.trackEvent(ANALYTICS_EVENTS.DEMO_INTERACTION, {
          interaction_type: 'input_focus',
          element_type: target.tagName.toLowerCase(),
          input_name: target.getAttribute('name') || 'unknown',
        })
      }
    })
  }

  private setupTimeTracking() {
    TIME_THRESHOLDS.forEach((threshold) => {
      setTimeout(() => {
        this.trackEvent(ANALYTICS_EVENTS.TIME_ON_PAGE, {
          time_threshold: threshold,
          total_time: threshold,
          page_name: this.pageName,
        })
      }, threshold * 1000)
    })

    // Track page exit
    window.addEventListener('beforeunload', () => {
      const totalTime = Math.round((Date.now() - this.startTime) / 1000)
      this.trackEvent(ANALYTICS_EVENTS.PAGE_EXIT, {
        total_time: totalTime,
        max_scroll_depth: Math.max(...Array.from(this.scrollDepths), 0),
        sections_viewed: this.sectionViews.size,
      })

      // Flush remaining events
      this.flushEvents()
    })
  }

  private setupErrorTracking() {
    window.addEventListener('error', (e) => {
      this.trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error_message: e.message,
        error_filename: e.filename,
        error_line: e.lineno,
        error_column: e.colno,
        error_stack: e.error?.stack,
      })
    })

    window.addEventListener('unhandledrejection', (e) => {
      this.trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error_type: 'unhandled_promise_rejection',
        error_reason: e.reason?.toString(),
      })
    })
  }

  private setupPerformanceTracking() {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming
        if (perfData) {
          this.trackEvent(ANALYTICS_EVENTS.PERFORMANCE_METRIC, {
            metric_type: 'page_load',
            dom_content_loaded:
              perfData.domContentLoadedEventEnd -
              perfData.domContentLoadedEventStart,
            load_complete: perfData.loadEventEnd - perfData.loadEventStart,
            first_byte: perfData.responseStart - perfData.requestStart,
            dns_lookup: perfData.domainLookupEnd - perfData.domainLookupStart,
          })
        }
      }, 1000)
    })
  }

  private setupEventFlushing() {
    // Flush events every 30 seconds
    setInterval(() => {
      this.flushEvents()
    }, 30000)
  }

  private queueEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
  ): void {
    const eventData: AnalyticsEventData = {
      event: eventName,
      timestamp: Date.now(),
      session_id: this.sessionId,
      page_name: this.pageName,
      ab_variant: this.abTestVariant,
      url: window.location.href,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      ...properties,
    }

    this.eventQueue.push(eventData)

    // Auto-flush if queue is full
    if (this.eventQueue.length >= ANALYTICS_CONFIG.BATCH_SIZE) {
      this.flushEvents()
    }
  }

  public async trackEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    this.queueEvent(eventName, properties)
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return
    }

    const eventsToSend = [...this.eventQueue]
    this.eventQueue = []

    try {
      await this.sendEvents(eventsToSend)
    } catch (error: unknown) {
      console.warn('Failed to send analytics events:', error)
      // Re-queue events for retry
      this.eventQueue.unshift(...eventsToSend)
    }
  }

  private async sendEvents(events: AnalyticsEventData[]): Promise<void> {
    const promises = events.map((event) => this.sendSingleEvent(event))
    await Promise.allSettled(promises)
  }

  private async sendSingleEvent(eventData: AnalyticsEventData): Promise<void> {
    // Send to Google Analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', eventData.event, {
        custom_parameter_1: eventData.session_id,
        custom_parameter_2: eventData.ab_variant,
        custom_parameter_3: eventData.page_name,
        ...eventData,
      })
    }

    // Send to custom analytics endpoint
    try {
      const response = await fetch('/api/analytics/demo-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`)
      }
    } catch (error: unknown) {
      console.warn('Failed to send to custom analytics:', error)
      throw error
    }
  }

  // Public methods for manual tracking
  public trackConversion(conversionType: string, value?: number): void {
    this.trackEvent(ANALYTICS_EVENTS.AB_TEST_CONVERSION, {
      conversion_type: conversionType,
      conversion_value: value,
      time_to_conversion: Date.now() - this.startTime,
    })
  }

  public trackCustomEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
  ): void {
    this.trackEvent(eventName, properties)
  }

  // Getters for debugging
  public getSessionId(): string {
    return this.sessionId
  }

  public getABVariant(): string {
    return this.abTestVariant
  }

  public getPageConfig(): PageConfig {
    return this.pageConfig
  }
}

declare global {
  interface Window {
    demoAnalytics?: UniversalDemoAnalytics
    gtag?: (
      command: string,
      event: string,
      params: Record<string, unknown>,
    ) => void
  }
}

// Global initialization function
export function initializeDemoAnalytics(
  pageName: DemoPageName,
): UniversalDemoAnalytics {
  const analytics = new UniversalDemoAnalytics(pageName)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => analytics.initialize())
  } else {
    analytics.initialize()
  }

  // Make available globally for debugging
  window.demoAnalytics = analytics

  return analytics
}
