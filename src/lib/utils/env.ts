/**
 * Real environment variable utilities for browser and Node.js environments.
 */

type EnvSource = Record<string, string | undefined>

// Prefer import.meta.env for Vite/ESM, fallback to process.env for Node
function getEnvSource(): EnvSource {
  if (
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env === 'object'
  ) {
    return import.meta.env as EnvSource
  }
  if (typeof process !== 'undefined' && typeof process.env === 'object') {
    return process.env as EnvSource
  }
  return {}
}

/**
 * Get an environment variable as a string.
 * @param key The environment variable key.
 * @param defaultValue Value to return if key is not set.
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const source = getEnvSource()
  const val = source[key]
  if (val !== undefined && val !== null && val !== '') {
    return val
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  return undefined
}

/**
 * Return true if the environment variable is a truthy value.
 * Accepts: '1', 'true', 'yes', 'on' (case-insensitive).
 * @param key The environment variable key.
 */
export function isEnvTrue(key: string): boolean {
  const val = getEnv(key)
  if (!val) {
    return false
  }
  const normalized = val.toString().trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

/**
 * Legacy env object for compatibility. Prefer getEnv/isEnvTrue.
 */
export const env = new Proxy(
  {},
  {
    get(_target, prop: string): void {
      return getEnv(prop) ?? ''
    },
  },
)
