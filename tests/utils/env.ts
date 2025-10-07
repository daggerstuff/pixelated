/**
 * Utility functions for safely accessing environment variables in tests
 */
import { getEnv } from '../../src/lib/utils/env'

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return getEnv('CI') === 'true'
}

/**
 * Get the base URL for tests
 */
export function getBaseUrl(): string {
  return getEnv('BASE_URL') || (isCI() ? 'http://localhost:3000' : 'http://localhost:4321')
}

/**
 * Get the command to run the development server
 */
export function getDevCommand(): string {
  return isCI() ? 'pnpm preview' : 'pnpm dev'
}

/**
 * Get the port for the development server
 */
export function getDevPort(): number {
  return isCI() ? 3000 : 4321
}

/**
 * Should reuse existing server
 */
export function shouldReuseServer(): boolean {
  return !isCI()
}
