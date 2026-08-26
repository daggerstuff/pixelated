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

import { createBuildSafeLogger } from '../logging/build-safe-logger'
const logger = createBuildSafeLogger('config')

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
  const env = import.meta.env as Record<string, unknown>
  const procEnv = process.env as Record<string, unknown>

  const toOptionalString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined

  const candidates: (string | undefined)[] = [
    // Explicit app / Sentry release
    toOptionalString(env['PUBLIC_SENTRY_RELEASE']),
    toOptionalString(env['PUBLIC_APP_VERSION']),
    toOptionalString(env['SENTRY_RELEASE']),

    // Common hosting providers
    toOptionalString(env['VERCEL_GIT_COMMIT_SHA']),
    toOptionalString(env['RENDER_GIT_COMMIT']),
    toOptionalString(env['NETLIFY_COMMIT_REF']),
    toOptionalString(env['RAILWAY_GIT_COMMIT_SHA']),

    // Generic CI / git environments
    toOptionalString(env['GITHUB_SHA']),
    toOptionalString(env['CI_COMMIT_SHA']),
    // Fallback to process.env for Node.js environments (server-side)
    toOptionalString(procEnv['SENTRY_RELEASE']),
    toOptionalString(procEnv['PUBLIC_SENTRY_RELEASE']),
    toOptionalString(procEnv['PUBLIC_APP_VERSION']),
    toOptionalString(procEnv['npm_package_version']),
    toOptionalString(procEnv['GITHUB_SHA']),
    toOptionalString(procEnv['CI_COMMIT_SHA']),
  ]

  const release = candidates.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )

  return release ?? fallback
}

export function resolveSentryDsn(): string | undefined {
  const env = import.meta.env as Record<string, unknown>
  const procEnv = process.env as Record<string, unknown>

  const toTrimmedString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const candidates: (string | undefined)[] = [
    toTrimmedString(env['PUBLIC_SENTRY_DSN']),
    toTrimmedString(env['SENTRY_DSN']),
    toTrimmedString(env['SENTRY_PUBLIC_DSN']),
    toTrimmedString(env['VITE_SENTRY_DSN']),
    // Fallback to process.env for Node.js environments (server-side)
    toTrimmedString(procEnv['SENTRY_DSN']),
    toTrimmedString(procEnv['PUBLIC_SENTRY_DSN']),
    toTrimmedString(procEnv['SENTRY_PUBLIC_DSN']),
    toTrimmedString(procEnv['VITE_SENTRY_DSN']),
  ]

  const dsn = candidates.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )

  if (
    import.meta.env.DEV ||
    process.env['NODE_ENV'] !== 'production' ||
    process.env['SENTRY_DEBUG']
  ) {
    logger.info(
      `[Sentry Config] Resolved DSN: ${dsn ? dsn.substring(0, 20) + '...' : 'MISSING'}`,
    )
  }

  return dsn
}

export const SENTRY_CONFIG = {
  dsn: resolveSentryDsn(),

  // Use import.meta.env.DEV (Vite's built-in flag) as the authoritative check
  // so that running `astro dev --mode production` still reports 'development',
  // preventing local Vite dev-server errors from being tagged as production.
  environment: import.meta.env.DEV ? 'development' : import.meta.env.MODE,
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
    logger.info('Sentry event:', event)
  }

  // Drop events originating from a local Vite dev server (localhost / 127.0.0.1)
  // so that dev-only errors (e.g. stale Vite dep chunks) never appear in Sentry
  // regardless of which --mode flag was passed to the dev server.
  // Skip this filter if PUBLIC_SENTRY_ALLOW_LOCALHOST is set to '1' for testing.
  const allowLocalhost =
    import.meta.env['PUBLIC_SENTRY_ALLOW_LOCALHOST'] === '1'
  if (!allowLocalhost && typeof window !== 'undefined') {
    const { hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null
    }
  }

  // Drop synthetic test events whose title begins with "Test:" to prevent
  // manually-fired SDK smoke-tests from polluting the production project.
  const title = event.message ?? event.exception?.values?.[0]?.value ?? ''
  if (/^Test:/i.test(title)) {
    return null
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
