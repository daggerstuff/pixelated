import { getStartupLogger } from './logging/build-safe-logger'

const startupLogger = getStartupLogger()
import { LogRotationService } from './logging/rotation'
import { initializeSecurity } from './security'
import { initializeTracing } from './tracing'

const logger = startupLogger

/**
 * Initialize the application
 * This should be called when the application starts
 */
export async function initializeApplication(): Promise<void> {
  try {
    logger.info('Starting application initialization...')

    // Initialize tracing first (before other modules that might use it)
    initializeTracing()

    // Initialize log rotation
    const logRotation = new LogRotationService()
    await logRotation.ensureLogDir()

    // Initialize security module
    await initializeSecurity()

    logger.info('Application initialization complete')
  } catch (error: unknown) {
    logger.error(
      'Failed to initialize application',
      error as Record<string, unknown>,
    )
    throw error
  }
}

/**
 * Shutdown the application gracefully
 */
export async function shutdownApplication(): Promise<void> {
  try {
    logger.info('Starting application shutdown...')

    // Shutdown tracing (export any pending spans)
    const { shutdownTracing } = await import('./tracing')
    await shutdownTracing()

    // TODO: Add proper shutdown logic for:
    // - Close database connections
    // - Stop background services
    // - Save any pending data
    // - Clean up resources

    logger.info('Application shutdown complete')
  } catch (error: unknown) {
    logger.error(
      'Error during application shutdown',
      error as Record<string, unknown>,
    )
    throw error
  }
}
