import type { ComponentType } from 'react'

/**
 * Types related to testing, including browser compatibility testing
 */

/**
 * Represents a browser compatibility issue
 */
export interface CompatibilityIssue {
  /**
   * Unique identifier for the issue
   */
  id?: number | string

  /**
   * Browser where the issue was detected
   */
  browser: string

  /**
   * Component or feature affected by the issue
   */
  component: string

  /**
   * Description of the issue
   */
  description: string

  /**
   * Severity level of the issue
   */
  severity: 'critical' | 'major' | 'minor'

  /**
   * Timestamp when the issue was detected
   */
  timestamp?: string

  /**
   * URL where the issue was detected
   */
  url?: string

  /**
   * The specific version of the browser
   */
  browserVersion?: string

  /**
   * The type of device (desktop, mobile, tablet)
   */
  deviceType?: 'desktop' | 'mobile' | 'tablet'

  /**
   * Operating system where the issue was detected
   */
  os?: string

  /**
   * Screenshots or visual evidence of the issue
   */
  screenshotUrl?: string

  /**
   * Person or system who reported the issue
   */
  reporter?: string

  /**
   * Status of the issue
   */
  status?: 'open' | 'investigating' | 'fixed' | 'wontfix' | 'duplicate'

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents a browser compatibility test result
 */
export interface BrowserCompatibilityTestResult {
  /**
   * Unique identifier for the test result
   */
  id: number | string

  /**
   * Name of the test
   */
  name: string

  /**
   * Browser where the test was run
   */
  browser: string

  /**
   * Browser version
   */
  browserVersion: string

  /**
   * Test status
   */
  status: 'passed' | 'failed' | 'skipped' | 'error'

  /**
   * Description of the failure (if applicable)
   */
  failureReason?: string

  /**
   * Timestamp when the test was run
   */
  timestamp: string

  /**
   * Duration of the test in milliseconds
   */
  duration: number

  /**
   * URL that was tested
   */
  url?: string

  /**
   * Type of test (functional, visual, performance)
   */
  type: 'functional' | 'visual' | 'performance'

  /**
   * Device type used for testing
   */
  deviceType?: 'desktop' | 'mobile' | 'tablet'

  /**
   * Operating system where the test was run
   */
  os?: string

  /**
   * Screenshot URL (for visual tests)
   */
  screenshotUrl?: string

  /**
   * Baseline screenshot URL (for visual comparison)
   */
  baselineScreenshotUrl?: string

  /**
   * Diff screenshot URL (for visual comparison)
   */
  diffScreenshotUrl?: string

  /**
   * Visual difference percentage (for visual tests)
   */
  visualDiffPercentage?: number

  /**
   * Test artifacts (logs, videos, etc.)
   */
  artifacts?: {
    logs?: string
    video?: string
    console?: string[]
    network?: unknown[]
  }

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Configuration for browser compatibility testing
 */
export interface BrowserCompatibilityConfig {
  /**
   * Browsers to test
   */
  browsers: {
    name: string
    version?: string
    deviceType?: 'desktop' | 'mobile' | 'tablet'
  }[]

  /**
   * URLs to test
   */
  urls: string[]

  /**
   * Test types to run
   */
  testTypes: ('functional' | 'visual' | 'performance')[]

  /**
   * Viewport sizes to test
   */
  viewports?: {
    width: number
    height: number
    name: string
  }[]

  /**
   * Visual comparison threshold (percentage)
   */
  visualThreshold?: number

  /**
   * Performance budgets
   */
  performanceBudgets?: {
    firstContentfulPaint?: number
    largestContentfulPaint?: number
    timeToInteractive?: number
    totalBlockingTime?: number
    cumulativeLayoutShift?: number
  }

  /**
   * Notification settings
   */
  notifications?: {
    email?: string[]
    slack?: string
    failureOnly?: boolean
    includeScreenshots?: boolean
  }
}

export interface TestSection<P = unknown> {
  title: string
  component?: ComponentType<P>
  instructions?: string[]
  props?: P
}

export type TestSections = {
  [key: string]: TestSection
}

export interface LoadingSize {
  width: number
  height: number
}

export interface LoadingSizes {
  [key: string]: LoadingSize
}

export interface SeverityStyle {
  backgroundColor: string
  color: string
}

export interface SeverityStyles {
  [key: string]: SeverityStyle
}
