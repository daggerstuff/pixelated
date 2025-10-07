/**
 * Utility to detect if code is running in a browser environment
 */

/**
 * Checks if code is running in a browser environment
 * This is useful for conditionally running code that requires browser APIs
 */
export const isBrowser =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'

/**
 * Checks if code is running in a Node.js environment
 */
export const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null

/**
 * Checks if code is running in a server-side environment (e.g., Node.js)
 * This is the inverse of isBrowser
 */
export const isServer = !isBrowser
