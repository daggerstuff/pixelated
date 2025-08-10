/// <reference types="astro/client" />

// Re-export types from astro to fix module resolution
declare module 'astro' {
  export * from 'astro/dist/types/public/index.js'
}

interface ImportMetaEnv {
  readonly PUBLIC_MONGODB_CLUSTER: string
  readonly MONGODB_URI: string
  readonly MONGODB_DB_NAME: string
  readonly JWT_SECRET: string
  readonly SSR: boolean

  // Sentry Environment Variables
  readonly PUBLIC_SENTRY_DSN?: string
  readonly PUBLIC_APP_VERSION?: string
  readonly MODE?: string
  readonly DEV?: boolean

  // Bias Detection Environment Variables
  readonly BIAS_DETECTION_SERVICE_URL?: string
  readonly BIAS_ALERT_SLACK_WEBHOOK?: string
  readonly BIAS_WARNING_THRESHOLD?: string
  readonly BIAS_HIGH_THRESHOLD?: string
  readonly BIAS_CRITICAL_THRESHOLD?: string
  readonly BIAS_SERVICE_TIMEOUT?: string
  readonly BIAS_WEIGHT_PREPROCESSING?: string
  readonly BIAS_WEIGHT_MODEL_LEVEL?: string
  readonly BIAS_WEIGHT_INTERACTIVE?: string
  readonly BIAS_WEIGHT_EVALUATION?: string
  readonly BIAS_EVALUATION_METRICS?: string
  readonly ENABLE_HIPAA_COMPLIANCE?: string
  readonly ENABLE_AUDIT_LOGGING?: string
  readonly ENABLE_DATA_MASKING?: string
  readonly BIAS_ALERT_EMAIL_RECIPIENTS?: string
  readonly BIAS_ALERT_COOLDOWN_MINUTES?: string
  readonly BIAS_METRICS_RETENTION_DAYS?: string
  readonly BIAS_DASHBOARD_REFRESH_RATE?: string
  readonly BIAS_ENABLE_REAL_TIME_MONITORING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace App {
  interface Locals {
    requestId: string
    timestamp: string
    user?: {
      id: string
      email: string
      name?: string
    }
    vercelEdge?: {
      country: string
      region: string
      ip: string
      isAuthPage: boolean
      userAgent: string
    }
    cspNonce?: string
  }
}
