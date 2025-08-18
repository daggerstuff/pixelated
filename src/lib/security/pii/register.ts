/**
 * PII Detection Registration
 *
 * This module provides functions to register and configure the PII detection service
 * and middleware for use in the application.
 */

import type { PIIDetectionConfig } from './'
import type { PIIMiddlewareConfig } from './middleware'
import process from 'node:process'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { piiDetectionService } from './'
import { createPIIMiddleware } from './middleware'

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * Register and configure the PII detection service
 */
export async function registerPIIDetection(
  config: Partial<PIIDetectionConfig> = {},
): Promise<void> {
  try {
    logger.info('Registering PII detection service')

    // Update configuration if provided
    if (Object.keys(config).length > 0) {
      piiDetectionService.updateConfig(config)
    }

    // Initialize the service
    await piiDetectionService.initialize()

    logger.info('PII detection service registered and initialized')
  } catch (error: unknown) {
    logger.error(
      'Failed to register PII detection service',
      error as Record<string, unknown>,
    )
    throw error
  }
}

/**
 * Create a configured middleware for PII detection
 */
export function createConfiguredPIIMiddleware(
  config: Partial<PIIMiddlewareConfig> = {},
) {
  // Merge with any environment-specific configuration
  const environmentConfig = getEnvironmentConfig()

  return createPIIMiddleware({
    ...environmentConfig,
    ...config,
  })
}

/**
 * Get environment-specific configuration
 */
function getEnvironmentConfig(): Partial<PIIMiddlewareConfig> {
  // Base configuration
  const baseConfig: Partial<PIIMiddlewareConfig> = {
    // Enable PII detection by default in all environments
    enabled: true,
  }

  // Development-specific configuration
  if (process.env['NODE_ENV'] === 'development') {
    return {
      ...baseConfig,
      // Log detections but don't block in development
      blockRequests: false,
      // More verbose logging in development
      auditDetections: true,
    }
  }

  // Production-specific configuration
  if (process.env['NODE_ENV'] === 'production') {
    return {
      ...baseConfig,
      // In HIPAA-compliant mode, block requests with PII in sensitive paths
      blockRequests: process.env['HIPAA_COMPLIANCE_MODE'] === 'true',
      // Always audit in production
      auditDetections: true,
    }
  }

  // Test-specific configuration
  if (process.env['NODE_ENV'] === 'test') {
    return {
      ...baseConfig,
      // Disable blocking in test
      blockRequests: false,
      // Disable auditing in test to avoid test pollution
      auditDetections: false,
    }
  }

  return baseConfig
}

/**
 * Register PII detection middleware with the application
 */
export function registerPIIMiddleware(
  app: unknown,
  config: Partial<PIIMiddlewareConfig> = {},
) {
  try {
    logger.info('Registering PII detection middleware')

    // Create the middleware with the provided configuration
    const middleware = createConfiguredPIIMiddleware(config)

    // Register the middleware with the app
    // Note: This is an example - the actual implementation will depend on your framework
    // @ts-expect-error: We can't type the app object precisely without knowing the framework
    app.use(middleware)

    logger.info('PII detection middleware registered')
  } catch (error: unknown) {
    logger.error(
      'Failed to register PII detection middleware',
      error as Record<string, unknown>,
    )
    throw error
  }
}

/**
 * Register both the PII detection service and middleware
 */
export async function registerPIIDetectionSystem(
  app: unknown,
  serviceConfig: Partial<PIIDetectionConfig> = {},
  middlewareConfig: Partial<PIIMiddlewareConfig> = {},
): Promise<void> {
  try {
    // Register the service firs
    await registerPIIDetection(serviceConfig)

    // Then register the middleware
    registerPIIMiddleware(app, middlewareConfig)

    logger.info('PII detection system registered and initialized')
  } catch (error: unknown) {
    logger.error(
      'Failed to register PII detection system',
      error as Record<string, unknown>,
    )
    throw error
  }
}

// Export the functions
export default {
  registerPIIDetection,
  createConfiguredPIIMiddleware,
  registerPIIMiddleware,
  registerPIIDetectionSystem,
}
