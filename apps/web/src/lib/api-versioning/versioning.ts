/**
 * @file src/lib/api-versioning/versioning.ts
 *
 * API versioning constants, types, and helper functions for the
 * Pixelated Empathy platform.
 *
 * Versioning scheme: URL path-based (`/v1/`, `/v2/`, ...) as primary,
 * `X-API-Version` response header as supplementary metadata.
 *
 * @see src/content-store/docs/api/api-versioning.md
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current active API version */
export const API_VERSION = 1

/** Response header carrying the API version that served the request */
export const API_VERSION_HEADER = 'X-API-Version'

/** IETF draft `Deprecation` header — marks endpoints as deprecated */
export const DEPRECATION_HEADER = 'Deprecation'

/** IETF `Sunset` header — date when the deprecated endpoint will be removed */
export const SUNSET_HEADER = 'Sunset'

/** Header for requesting a specific API version (optional, path takes precedence) */
export const ACCEPT_VERSION_HEADER = 'Accept-Version'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle status of an API version */
export type VersionStatus = 'active' | 'deprecated' | 'sunset' | 'retired'

/** Deprecation metadata for a route or version */
export interface DeprecationInfo {
  /** Version that is deprecated */
  version: number
  /** When deprecation was announced (ISO date) */
  deprecatedAt: string
  /** When the endpoint will be removed (ISO date) */
  sunsetAt: string
  /** Replacement version, if any */
  replacementVersion?: number
  /** Human-readable migration guide URL */
  migrationGuide?: string
}

/** Version descriptor returned by `getApiVersion` */
export interface VersionInfo {
  /** Numeric version (1, 2, ...) */
  version: number
  /** How the version was determined */
  source: 'path' | 'header' | 'default'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a pathname is an API route.
 * @example isApiRoute('/api/v1/health') → true
 * @example isApiRoute('/admin/dashboard') → false
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/**
 * Extract the API version from a request pathname.
 * Looks for `/api/v{N}/` pattern.
 * @returns version number or null if not versioned in path
 * @example extractVersionFromPath('/api/v1/health') → 1
 * @example extractVersionFromPath('/api/health') → null
 */
export function extractVersionFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/api\/v(\d+)\//)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * Get the API version from a request, checking path first, then header.
 * Falls back to the current API_VERSION if no version is specified.
 */
export function getApiVersion(
  pathname: string,
  requestHeaders?: Headers,
): VersionInfo {
  // 1. Check URL path: /api/v{N}/...
  const pathVersion = extractVersionFromPath(pathname)
  if (pathVersion !== null) {
    return { version: pathVersion, source: 'path' }
  }

  // 2. Check Accept-Version header
  if (requestHeaders) {
    const headerVersion = requestHeaders.get(ACCEPT_VERSION_HEADER)
    if (headerVersion) {
      const parsed = parseInt(headerVersion, 10)
      if (!Number.isNaN(parsed)) {
        return { version: parsed, source: 'header' }
      }
    }
  }

  // 3. Default to current version
  return { version: API_VERSION, source: 'default' }
}

/**
 * Set the API version header on a Response.
 * Mutates the response in place.
 */
export function setVersionHeader(
  response: Response,
  version = API_VERSION,
): void {
  response.headers.set(API_VERSION_HEADER, String(version))
}

/**
 * Set deprecation headers on a Response.
 * Sets both the `Deprecation` (draft) and `Sunset` headers.
 */
export function setDeprecationHeaders(
  response: Response,
  info: DeprecationInfo,
): void {
  response.headers.set(DEPRECATION_HEADER, info.deprecatedAt)
  response.headers.set(SUNSET_HEADER, info.sunsetAt)
  if (info.replacementVersion) {
    response.headers.set(
      'X-API-Replacement-Version',
      String(info.replacementVersion),
    )
  }
}

/**
 * Create a deprecation info object with computed sunset date.
 * @param version Version being deprecated
 * @param monthsNotice Months until sunset (default 6)
 */
export function createDeprecationInfo(
  version: number,
  monthsNotice = 6,
  replacementVersion?: number,
): DeprecationInfo {
  const now = new Date()
  const sunset = new Date(now)
  sunset.setMonth(sunset.getMonth() + monthsNotice)

  return {
    version,
    deprecatedAt: now.toISOString().split('T')[0],
    sunsetAt: sunset.toISOString().split('T')[0],
    replacementVersion,
  }
}

/**
 * Get the version status for a given version number.
 * The current version is 'active'. Previous versions are 'deprecated'
 * (for one cycle) then 'retired'.
 */
export function getVersionStatus(version: number): VersionStatus {
  if (version === API_VERSION) {
    return 'active'
  }
  if (version < API_VERSION) {
    // Only the immediately previous version is "deprecated" during transition
    return version === API_VERSION - 1 ? 'deprecated' : 'retired'
  }
  // Future versions not yet active
  return 'retired'
}
