/**
 * String utilities including escaping, casing, truncation, and URL helpers
 */

// ============================================================================
// String manipulation
// ============================================================================

/**
 * Escapes HTML special characters in a string
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, (s) => entityMap[s] ?? s)
}

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Converts a string to title case
 * @param str - String to convert
 * @returns Title case string
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Converts a string to kebab-case
 * @param str - String to convert
 * @returns Kebab-case string
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/**
 * Converts a string to camelCase
 * @param str - String to convert
 * @returns CamelCase string
 */
export function camelCase(str: string): string {
  return str
    .replace(/(^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase(),
    )
    .replace(/\s+/g, '')
}

/**
 * Truncates a string to a specified length
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) {
    return str
  }
  return str.slice(0, length - suffix.length) + suffix
}

/**
 * Removes all whitespace from a string
 * @param str - String to clean
 * @returns String without whitespace
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s/g, '')
}

// ============================================================================
// URL utilities
// ============================================================================

const isBrowserEnvironment = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * Builds a URL with query parameters
 * @param baseUrl - Base URL
 * @param params - Query parameters object
 * @returns URL with query parameters
 */
export function buildUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean>,
): string {
  const url = new URL(
    baseUrl,
    isBrowserEnvironment() ? window.location.origin : 'http://localhost',
  )

  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

/**
 * Parses query parameters from a URL
 * @param url - URL to parse
 * @returns Object with query parameters
 */
export function parseQueryParams(url: string): Record<string, string> {
  const urlObj = new URL(
    url,
    isBrowserEnvironment() ? window.location.origin : 'http://localhost',
  )
  const params: Record<string, string> = {}

  urlObj.searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}
