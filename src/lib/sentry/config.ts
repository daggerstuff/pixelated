/**
 * Sentry Configuration for Pixelated Empathy
 *
 * This file contains shared configuration for Sentry error monitoring
 * across both client and server environments.
 */

export const SENTRY_CONFIG = {
  dsn: import.meta.env['PUBLIC_SENTRY_DSN'],

  environment: import.meta.env.MODE || 'production',
  release: import.meta.env['PUBLIC_APP_VERSION'] || '0.0.1',

  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
  profilesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,

  debug: import.meta.env.DEV,

  tags: {
    app: 'pixelated-empathy',
    platform: 'astro',
    deployment: 'azure',
  },
} as const

export function beforeSend(event: unknown): unknown | null {
  if (import.meta.env.DEV) {
    console.log('Sentry event:', event)
  }

  return event
}

export function initSentry(additionalConfig: Record<string, unknown> = {}) {
  return {
    ...SENTRY_CONFIG,
    beforeSend,
    ...additionalConfig,
  }
}
