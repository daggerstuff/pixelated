/// <reference types="astro/client" />

import '../.astro/types.d.ts'

declare global {
  namespace App {
    interface Locals {
      requestId: string
      timestamp: string
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
      vercelEdge?: {
        country: string
        region: string
        ip: string
        isAuthPage: boolean
        userAgent: string
      }
      cspNonce?: string
      isSSR?: boolean
      isPrerendered?: boolean
      headers?: Record<string, string>
      userPreferences?: {
        darkMode: boolean
        language: string
        userAgent: string
        isMobile: boolean
        reducedMotion: boolean
        isIOS: boolean
        isAndroid: boolean
        ip: string
      }
      /**
       * Permissive fallback for ad-hoc keys written by middleware
       * (e.g. `context.locals['admin']` in `adminGuard`).
       *
       * Astro 5.x's `APIContext.locals` is intentionally free-form — declaring
       * new shared keys here gives autocomplete and drift detection. Ad-hoc
       * keys (e.g. middleware-set values) fall through to `unknown`.
       *
       * See `src/__tests__/env-locals-contract.type-test.ts` for the contract.
       */
      [key: string]: unknown
    }
  }
}

// ImportMetaEnv and ImportMeta are declared in .astro-env.d.ts to avoid interface merging issues

interface NetworkInformation extends EventTarget {
  readonly effectiveType: string
  readonly rtt: number
  readonly downlink: number
  readonly saveData: boolean
  onchange: ((this: NetworkInformation, ev: Event) => any) | null
}

interface Navigator {
  readonly connection?: NetworkInformation
}
