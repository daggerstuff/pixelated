import { createAuthClient } from 'better-auth/react'
import { getEnv } from '@/lib/utils/env'

/**
 * Resolve an absolute base URL for server-side environments.
 * Falls back to localhost when no environment variables are configured.
 */
function resolveServerAuthBaseUrl(): string {
  const candidates = [
    getEnv('PUBLIC_AUTH_URL'),
    getEnv('AUTH_BASE_URL'),
    getEnv('SITE_URL'),
    getEnv('PUBLIC_SITE_URL'),
    getEnv('DEPLOYMENT_URL'),
    getEnv('ORIGIN_URL'),
    getEnv('BASE_URL'),
  ]

  for (const candidate of candidates) {
    const normalized = normalizeAbsoluteUrl(candidate)
    if (normalized) {
      return ensureAuthPath(normalized)
    }
  }

  // Default to local dev server to keep SSR happy during tests
  return 'http://localhost:4321/api/auth'
}

/**
 * Ensure the URL string is absolute and normalized without trailing slash.
 */
function normalizeAbsoluteUrl(value?: string): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    const serialized = url.toString().replace(/\/$/, '')
    return serialized
  } catch {
    return null
  }
}

/**
 * Guarantee the /api/auth path suffix is present exactly once.
 */
function ensureAuthPath(base: string): string {
  return base.endsWith('/api/auth') ? base : `${base.replace(/\/$/, '')}/api/auth`
}

const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

/**
 * Better-Auth React Client
 * Configured to work with the better-auth API routes at /api/auth
 */
export const authClient = createAuthClient({
  baseURL: isBrowser ? '/api/auth' : resolveServerAuthBaseUrl(),
})
