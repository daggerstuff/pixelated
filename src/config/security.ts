/**
 * Security configuration for Content Security Policy (CSP)
 * This file defines all allowed sources for different CSP directives
 */

export interface CSPConfig {
  'default-src': string[]
  'script-src': string[]
  'style-src': string[]
  'img-src': string[]
  'connect-src': string[]
  'font-src': string[]
  'object-src': string[]
  'media-src': string[]
  'form-action': string[]
  'frame-ancestors': string[]
  'base-uri': string[]
  'manifest-src': string[]
  'worker-src': string[]
  'child-src': string[]
  'frame-src': string[]
  'upgrade-insecure-requests': boolean
}

/**
 * Production CSP configuration with strict security policies
 * Each domain is specifically allowed based on application needs
 */
export const cspConfig: CSPConfig = {
  'default-src': ["'self'"],

  'script-src': [
    "'self'",
    // Nonce placeholder - will be replaced with actual nonce
    "'nonce-NONCE_PLACEHOLDER'",
    // Removed 'unsafe-inline' and 'unsafe-eval'
    'https://cdn.pixelatedempathy.com',
    'https://www.googletagmanager.com',
    'https://js.sentry-cdn.com',
    'data:',
  ],

  'style-src': [
    "'self'",
    // Nonce placeholder for inline styles
    "'nonce-NONCE_PLACEHOLDER'",
    // Keep 'unsafe-inline' temporarily for styles (can be removed later with more refactoring)
    "'unsafe-inline'",
    'https://cdn.pixelatedempathy.com',
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net',
    'data:',
  ],

  'img-src': [
    "'self'",
    'data:',
    'blob:',
    // Specific trusted image sources
    'https://cdn.pixelatedempathy.com',
    'https://images.unsplash.com',
    'https://upload.wikimedia.org',
    'https://avatars.githubusercontent.com',
    'https://www.gravatar.com',
  ],

  'connect-src': [
    "'self'",
    // AI/ML API endpoints
    'https://api.together.xyz',
    'https://api.nebius.ai',
    'https://api.openai.com',
    'https://api.replicate.com',
    // Communication & notifications
    'https://api.resend.com',
    'https://discord.gg',
    // Analytics & monitoring
    'https://www.googletagmanager.com',
    'https://js.sentry-cdn.com',
    // Authentication
    'https://accounts.google.com',
    // External APIs
    'https://api.github.com',
  ],

  'font-src': [
    "'self'",
    'https://cdn.pixelatedempathy.com',
    'https://fonts.gstatic.com',
    'https://fonts.bunny.net',
    'https://cdn.jsdelivr.net',
    'data:',
  ],

  'object-src': ["'none'"],
  'media-src': ["'self'", 'https://cdn.pixelatedempathy.com'],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'child-src': ["'self'", 'blob:'],
  'frame-src': ["'self'"],
  'upgrade-insecure-requests': true,
}

/**
 * Development CSP configuration with additional localhost endpoints
 */
export const cspConfigDev: Partial<CSPConfig> = {
  'connect-src': [
    ...cspConfig['connect-src'],
    'ws://localhost:*',
    'http://localhost:*',
    'https://localhost:*',
  ],
}

/**
 * Builds a CSP string from the configuration object
 */
export function buildCSP(
  config: CSPConfig,
  isDev = false,
  nonce?: string,
): string {
  const finalConfig = isDev ? { ...config, ...cspConfigDev } : config

  // Replace nonce placeholder with actual nonce if provided
  if (nonce) {
    finalConfig['script-src'] = finalConfig['script-src'].map((src) =>
      src.includes('NONCE_PLACEHOLDER') ? `'nonce-${nonce}'` : src,
    )
    finalConfig['style-src'] = finalConfig['style-src'].map((src) =>
      src.includes('NONCE_PLACEHOLDER') ? `'nonce-${nonce}'` : src,
    )
  }

  const directives = Object.entries(finalConfig)
    .filter(([, value]) => {
      // Handle boolean directives
      if (typeof value === 'boolean') {
        return value
      }
      // Handle array directives
      return Array.isArray(value) && value.length > 0
    })
    .map(([key, value]) => {
      // Handle boolean directives (no value needed)
      if (typeof value === 'boolean' && value) {
        return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      }
      // Handle array directives
      if (Array.isArray(value)) {
        const directiveName = key.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        )
        return `${directiveName} ${value.join(' ')}`
      }
      return ''
    })
    .filter(Boolean)

  return directives.join('; ')
}

/**
 * Get the appropriate CSP for the current environment
 */
export function getCSP(nonce?: string): string {
  const isDev = import.meta.env.DEV
  return buildCSP(cspConfig, isDev, nonce)
}
