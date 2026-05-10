/**
 * Sentry Configuration for Pixelated Empathy
 *
 * This file contains shared configuration for Sentry error monitoring
 * across both client and server environments.
 *
 * RELEASE HEALTH:
 * This configuration includes automatic session tracking (autoSessionTracking: true)
 * which enables Sentry Release Health metrics:
 * - Crash-free user rate: % of users without crashes
 * - Crash-free session rate: % of sessions without crashes
 * - User adoption: distribution of users across releases
 *
 * See: https://docs.sentry.io/product/releases/health/
 */

import type { Event } from '@sentry/astro'

/**
 * Resolve a Sentry release identifier in a deployment-provider-agnostic way.
 *
 * Priority order:
 * - Explicit public release vars (good for browser/client bundles)
 * - Generic Sentry release vars (good for servers/workers)
 * - Common CI / hosting provider commit SHAs
 * - Fallback version (e.g. local dev)
 *
 * This lets Kubernetes, Render, Netlify, Vercel, Railway, etc. all cooperate
 * by setting whichever env var they support, without changing app code.
 */
export function resolveSentryRelease(fallback: string = '0.0.1'): string {
  const env = import.meta.env as Record<string, any>
  const procEnv = process.env as Record<string, any>

  const candidates: (string | undefined)[] = [
    // Explicit app / Sentry release
    env['PUBLIC_SENTRY_RELEASE'],
    env['PUBLIC_APP_VERSION'],
    env['SENTRY_RELEASE'],

    // Common hosting providers
    env['VERCEL_GIT_COMMIT_SHA'],
    env['RENDER_GIT_COMMIT'],
    env['NETLIFY_COMMIT_REF'],
    env['RAILWAY_GIT_COMMIT_SHA'],

    // Generic CI / git environments
    env['GITHUB_SHA'],
    env['CI_COMMIT_SHA'],
    // Fallback to process.env for Node.js environments (server-side)
    procEnv['SENTRY_RELEASE'],
    procEnv['PUBLIC_SENTRY_RELEASE'],
    procEnv['PUBLIC_APP_VERSION'],
    procEnv['npm_package_version'],
    procEnv['GITHUB_SHA'],
    procEnv['CI_COMMIT_SHA'],
  ]

  const release = candidates.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )

  return release ?? fallback
}

export function resolveSentryDsn(): string | undefined {
  const env = import.meta.env as Record<string, any>
  const procEnv = process.env as Record<string, any>

  const candidates: (string | undefined)[] = [
    env['PUBLIC_SENTRY_DSN'],
    env['SENTRY_DSN'],
    env['SENTRY_PUBLIC_DSN'],
    env['VITE_SENTRY_DSN'],
    // Fallback to process.env for Node.js environments (server-side)
    procEnv['SENTRY_DSN'],
    procEnv['PUBLIC_SENTRY_DSN'],
    procEnv['SENTRY_PUBLIC_DSN'],
    procEnv['VITE_SENTRY_DSN'],
  ]

  const dsn = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  if (import.meta.env.DEV || process.env.NODE_ENV !== 'production' || process.env.SENTRY_DEBUG) {
    console.log(`[Sentry Config] Resolved DSN: ${dsn ? dsn.substring(0, 20) + '...' : 'MISSING'}`)
  }

  return dsn
}

export const SENTRY_CONFIG = {
  dsn: resolveSentryDsn(),

  environment: import.meta.env.MODE,
  release: resolveSentryRelease('0.0.1'),

  // Enable Release Health - automatic session tracking for crash-free metrics
  autoSessionTracking: true,

  tracesSampleRate: Number(
    import.meta.env['PUBLIC_SENTRY_TRACES_SAMPLE_RATE'] ??
      (import.meta.env.DEV ? 1.0 : 0.1),
  ),
  profilesSampleRate: Number(
    import.meta.env['PUBLIC_SENTRY_PROFILES_SAMPLE_RATE'] ??
      (import.meta.env.DEV ? 0.2 : 0.05),
  ),

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: true,

  // Only enable debug logs when explicitly requested
  debug: import.meta.env['PUBLIC_SENTRY_DEBUG'] === '1',

  tags: {
    app: 'pixelated-empathy',
    platform: 'astro',
    deployment: 'azure',
  },
} as const

export function beforeSend(event: Event): Event | null {
  if (import.meta.env.DEV) {
    console.log('Sentry event:', event)
  }

  return event
}

export function initSentry(
  additionalConfig: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...SENTRY_CONFIG,
    beforeSend,
    ...additionalConfig,
  }
}
