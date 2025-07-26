import { createAuditLog } from '../../audit'
import { initializeAITables } from './schema'

/**
 * Initialize the AI database tables
 * This should be called during application startup
 */
export async function initializeAIDatabase() {
  try {
    console.log('Initializing AI database tables...')

    // Initialize tables
    await initializeAITables()

    // Log successful initialization
    await createAuditLog('system', 'system.ai.database.initialize', 'ai', {
      timestamp: new Date().toISOString(),
    })

    console.log('AI database tables initialized successfully')
    return true
  } catch (error) {
    console.error(
      'Failed to initialize AI database:',
      error instanceof Error ? error : new Error(String(error)),
    )

    // Log initialization failure
    await createAuditLog(
      'system',
      'system.ai.database.initialize.error',
      'ai',
      {
        error: error instanceof Error ? error?.message : String(error),
        timestamp: new Date().toISOString(),
      },
    )

    throw error instanceof Error ? error : new Error(String(error))
  }
}
