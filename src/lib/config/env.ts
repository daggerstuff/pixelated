/**
 * Gets an environment variable with type checking
 * @param key - The environment variable key
 * @param defaultValue - Optional default value if not se
 * @returns The environment variable value
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue
  if (value === undefined) {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * Gets a boolean environment variable
 * @param key - The environment variable key
 * @param defaultValue - Optional default value if not se
 * @returns The boolean value
 */
function getBooleanEnvVar(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`)
    }
    return defaultValue
  }
  return value.toLowerCase() === 'true'
}

/**
 * Gets a number environment variable
 * @param key - The environment variable key
 * @param defaultValue - Optional default value if not se
 * @returns The number value
 */
function getNumberEnvVar(key: string, defaultValue?: number): number {
  const value = process.env[key]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`)
    }
    return defaultValue
  }
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new TypeError(`Environment variable ${key} is not a valid number`)
  }
  return num
}

export const config = {
  env: getEnvVar('NODE_ENV', 'production'),
  port: getNumberEnvVar('PORT', 3000),
  apiUrl: getEnvVar('API_URL', 'https://api.litlyx.com'),
  debug: getBooleanEnvVar('DEBUG', false),
  sentryDsn: getEnvVar('SENTRY_DSN', ''),
  monitoring: {
    sentryDsn: getEnvVar('SENTRY_DSN', ''),
  },
} as const
