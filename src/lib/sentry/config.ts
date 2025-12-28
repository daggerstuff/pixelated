/**
 * Sentry Configuration for Pixelated Empathy
 *
 * This file contains shared configuration for Sentry error monitoring
 * across both client and server environments.
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
  const candidates = [
    // Explicit app / Sentry release
    import.meta.env['PUBLIC_SENTRY_RELEASE'],
    import.meta.env['PUBLIC_APP_VERSION'],
    import.meta.env['SENTRY_RELEASE'],

    // Common hosting providers
    import.meta.env['VERCEL_GIT_COMMIT_SHA'],
    import.meta.env['RENDER_GIT_COMMIT'],
    import.meta.env['NETLIFY_COMMIT_REF'],
    import.meta.env['RAILWAY_GIT_COMMIT_SHA'],

    // Generic CI / git environments
    import.meta.env['GITHUB_SHA'],
    import.meta.env['CI_COMMIT_SHA'],
  ]

  const release = candidates.find(
    (value) => typeof value === 'string' && value.length > 0,
  )

  return release ?? fallback
}

export const SENTRY_CONFIG = {
  dsn:
    import.meta.env['PUBLIC_SENTRY_DSN'] ||
    'https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032',

  environment: import.meta.env.MODE || 'production',
  release: resolveSentryRelease('0.0.1'),

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
