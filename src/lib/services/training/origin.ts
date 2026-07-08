/**
 * Origin allow-list parser for WebSocket origin validation.
 *
 * PIX-3935 — Parses the ALLOWED_ORIGINS env var and provides
 * a checker function that rejects handshakes from non-listed origins.
 *
 * Env format: comma-separated list of origins (no trailing slash):
 *   ALLOWED_ORIGINS=https://app.pixelatedempathy.com
 *
 * A missing or empty variable allows ALL origins (backward compat).
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('training-origin')

/**
 * Parse the ALLOWED_ORIGINS env var into a Set of normalised origins.
 */
export function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw || raw.trim().length === 0) {
    logger.warn(
      'ALLOWED_ORIGINS not set — all origins will be accepted (insecure).',
    )
    return new Set()
  }

  const origins = new Set<string>()
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (trimmed.length > 0) {
      // Normalise: remove trailing slash if present
      origins.add(trimmed.replace(/\/+$/, ''))
    }
  }
  return origins
}

/**
 * Check whether an Origin header value is in the allowed set.
 *
 * Returns true when:
 *   - allowed set is empty (no restriction configured)
 *   - origin exactly matches an entry
 *   - origin matches after normalisation (trailing slash stripped)
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
): boolean {
  if (allowedOrigins.size === 0) return true // No restriction
  if (!origin) return false // Required when restriction is active

  const normalised = origin.replace(/\/+$/, '')
  return allowedOrigins.has(normalised)
}

/**
 * Convenience: build the allow-list from env and check an origin in one call.
 */
export function checkOrigin(origin: string | undefined): boolean {
  const raw =
    typeof process !== 'undefined' ? process.env['ALLOWED_ORIGINS'] : undefined
  const allowed = parseAllowedOrigins(raw)
  return isOriginAllowed(origin, allowed)
}
