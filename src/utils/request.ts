/**
 * Safely get the language from the browser on the client-side
 * This avoids using Astro.request.headers which causes issues with prerendered pages
 *
 * @returns {string} The browser language or fallback to 'en-US'
 */
export function getBrowserLanguage(): string {
  // This function will only run on the client side
  if (typeof window !== 'undefined') {
    return window.navigator.language || 'en-US'
  }

  // Return default for SSR environment
  return 'en-US'
}

/**
 * Safely determine if the current page is being viewed in dark mode
 * This avoids using Astro.request.headers which causes issues with prerendered pages
 *
 * @returns {boolean} True if the user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // Default for SSR environment
  return false
}

/**
 * Safely get the user's preferred languages array
 * This avoids using Astro.request.headers which causes issues with prerendered pages
 *
 * @returns {readonly string[]} Array of language preference strings
 */
export function getUserLanguages(): readonly string[] {
  if (typeof window !== 'undefined') {
    return window.navigator.languages || [window.navigator.language || 'en-US']
  }

  // Default for SSR environment
  return ['en-US']
}
