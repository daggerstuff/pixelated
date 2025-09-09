// Ensure TypeScript loads the project-level three type shims.
/// <reference path="../../types/three-addons.d.ts" />

// Minimal global module declarations for Three.js and OrbitControls used in the app.
// These declarations are intentionally minimal to silence TS "could not find a declaration file" errors.

declare module 'three'
declare module 'three/build/three.module.js'
declare module 'three/addons/controls/OrbitControls.js'
declare module 'three/examples/jsm/controls/OrbitControls.js'
// Global DOM augmentations for project-wide window helpers
export {}

declare global {
  interface Window {
    /**
     * Global helper used by DLP components to show a transient alert in the admin UI.
     * @param type - one of 'success' | 'error' | 'warning'
     * @param message - message body displayed in the alert
     */
    showDLPAlert?: (type: 'success' | 'error' | 'warning', message: string) => void
  }
}
/// <reference types="vitest/globals" />
/// <reference types="vite/client" />

/**
 * Global type definitions to resolve conflicts between testing libraries
 */

// Declare global testing variables with correct types
// This helps resolve conflicts between Vitest and Mocha
declare global {
  // Use Vitest's types for these globals
  const describe: vi.Describe
  const test: vi.It
  const it: vi.It
  const expect: vi.Expect
  const beforeEach: vi.Lifecycle
  const afterEach: vi.Lifecycle
  const beforeAll: vi.Lifecycle
  const afterAll: vi.Lifecycle
  const xdescribe: vi.Describe
  const xit: vi.It

  // Add any other globals that might have conflicts
  namespace NodeJS {
    interface Global {
      document: Document
      window: Window
      navigator: Navigator
    }

    interface ProcessEnv {
      // Bias Detection Environment Variables
      BIAS_DETECTION_SERVICE_URL?: string
      BIAS_ALERT_SLACK_WEBHOOK?: string
      BIAS_WARNING_THRESHOLD?: string
      BIAS_HIGH_THRESHOLD?: string
      BIAS_CRITICAL_THRESHOLD?: string
      BIAS_SERVICE_TIMEOUT?: string
      BIAS_WEIGHT_PREPROCESSING?: string
      BIAS_WEIGHT_MODEL_LEVEL?: string
      BIAS_WEIGHT_INTERACTIVE?: string
      BIAS_WEIGHT_EVALUATION?: string
      BIAS_EVALUATION_METRICS?: string
      ENABLE_HIPAA_COMPLIANCE?: string
      ENABLE_AUDIT_LOGGING?: string
      ENABLE_DATA_MASKING?: string
      BIAS_ALERT_EMAIL_RECIPIENTS?: string
      BIAS_ALERT_COOLDOWN_MINUTES?: string
      BIAS_METRICS_RETENTION_DAYS?: string
      BIAS_DASHBOARD_REFRESH_RATE?: string
      BIAS_ENABLE_REAL_TIME_MONITORING?: string
    }
  }

  namespace Vi {
    interface Assertion<T = unknown> {
      toHaveNoViolations(): Promise<void>
      // DOM testing matchers
      toBeInTheDocument(): void
      toHaveAttribute(attr: string, value?: string): void
      toHaveClass(...classNames: string[]): void
    }
  }

  interface Window {
    ResizeObserver: typeof ResizeObserver
    IntersectionObserver: typeof IntersectionObserver
    LiveRegionSystem?: {
      announceStatus: (message: string, clearDelay?: number) => void
      announceAlert: (message: string, clearDelay?: number) => void
      log: (message: string, clear?: boolean) => void
      announceProgress: (
        value: string | number,
        max: string | number,
        label: string,
      ) => void
    }
  }

  // Add any other global types needed

  type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
  }

  // Enhanced global type utilities for strict typing
  type StrictNonNullable<T> = T extends null | undefined ? never : T
  type Exact<T> = T & Record<Exclude<keyof T, keyof T>, never>
  type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>
}

export {}
