/// <reference types="astro/client" />

import '../.astro/types.d.ts'

declare global {
  namespace App {
    interface Locals {
      // Core request tracking
      requestId: string
      timestamp: string

      // Authentication & authorization
      user: {
        id: string
        email: string
        emailVerified: boolean
        role: string
        fullName?: string
        avatarUrl?: string
        createdAt?: string
        updatedAt?: string
        lastLogin?: string
        appMetadata?: Record<string, unknown>
        userMetadata?: Record<string, unknown>
      } | null
      session: {
        id: string
        userId: string
        expiresAt: Date
      } | null

      // Rendering context (from astro-locals.d.ts)
      isSSR: boolean
      isPrerendered: boolean
      headers: Record<string, string>

      // User preferences (from astro-locals.d.ts)
      userPreferences: {
        darkMode: boolean
        language: string
        userAgent: string
        isMobile: boolean
        reducedMotion: boolean
        isIOS: boolean
        isAndroid: boolean
        ip: string
      }

      // Edge runtime context
      vercelEdge?: {
        country: string
        region: string
        ip: string
        isAuthPage: boolean
        userAgent: string
      }

      // Security
      cspNonce?: string

      // Admin context (from src/lib/admin/middleware.ts)
      admin?: {
        userId: string
        isAdmin: boolean
        hasPermission: boolean
      }
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_AUTH0_DOMAIN: string;
  readonly PUBLIC_AUTH0_CLIENT_ID: string;
  readonly GRAFANA_URL: string
  readonly GRAFANA_API_KEY: string
  readonly GRAFANA_ORG_ID: string
  readonly SLACK_WEBHOOK: string
  readonly MONITORING_EMAIL_RECIPIENTS: string
  readonly APP_VERSION: string
  readonly PUBLIC_TRAINING_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    faro: {
      init: (config: any) => void
      api: {
        pushMeasurement: (metric: string, data: any) => void
        pushError: (error: Error, data: any) => void
        pushEvent: (name: string, properties?: any) => void
      }
    }
  }
}