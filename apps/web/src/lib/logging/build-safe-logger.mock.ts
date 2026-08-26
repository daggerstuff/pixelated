/**
 * A logger that's safe to use during build time
 */

export interface Logger {
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
}

/**
 * Create a logger that's safe to use during build time
 */
export function createBuildSafeLogger(component: string): Logger {
  return {
    info: (message: string, ...args: unknown[]) => {
      console.log(`[${component}] INFO: ${message}`, ...args)
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[${component}] WARN: ${message}`, ...args)
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[${component}] ERROR: ${message}`, ...args)
    },
    debug: (message: string, ...args: unknown[]) => {
      console.debug(`[${component}] DEBUG: ${message}`, ...args)
    },
  }
}
