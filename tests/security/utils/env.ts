/**
 * Utility functions for safely accessing environment variables in security tests
 */
import { getEnv } from '../../../src/lib/utils/env'

/**
 * Get the environment (development, staging, production)
 */
export function getEnvironment(): string {
  return getEnv('NODE_ENV') || 'development'
}

/**
 * Get the base URL for security tests
 */
export function getBaseUrl(): string {
  return getEnv('BASE_URL') || 'http://localhost:4321'
}

/**
 * Get the API key for security tests
 */
export function getApiKey(): string | undefined {
  return getEnv('API_KEY')
}

/**
 * Get the security test timeout
 */
export function getSecurityTestTimeout(): number {
  const timeout = getEnv('SECURITY_TEST_TIMEOUT')
  return timeout ? parseInt(timeout, 10) : 30000
}

/**
 * Get the security test report path
 */
export function getSecurityReportPath(): string {
  return getEnv('SECURITY_REPORT_PATH') || './security-reports'
}
