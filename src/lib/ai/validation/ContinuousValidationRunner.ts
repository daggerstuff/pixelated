import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')

/**
 * Lightweight placeholder for the real ContinuousValidationRunner.
 * Provides the minimal surface API expected by API routes so the project
 * can compile while the full implementation is in development.
 */
class ContinuousValidationRunner {
  private initialised = false
  private history: Array<{ timestamp: string; outcome: string }> = []

  async initialize(): Promise<void> {
    if (!this.initialised) {
      appLogger.info('ContinuousValidationRunner initialised (stub)')
      this.initialised = true
    }
  }

  async getRunHistory(
    limit: number,
  ): Promise<Array<{ timestamp: string; outcome: string }>> {
    // Return the most recent `limit` entries (stub data)
    return this.history.slice(-limit).reverse()
  }

  async scheduleValidationRuns(_schedule: string): Promise<void> {
    appLogger.info('scheduleValidationRuns called (stub)')
  }

  async handleWebhook(_payload: unknown): Promise<{ status: string }> {
    appLogger.info('handleWebhook called (stub)')
    return { status: 'handled' }
  }

  getState() {
    return {
      initialised: this.initialised,
      historyCount: this.history.length,
    }
  }

  stopScheduledRuns() {
    appLogger.info('stopScheduledRuns called (stub)')
  }
}

// Export a singleton instance used by API routes
export const validationRunner = new ContinuousValidationRunner()
