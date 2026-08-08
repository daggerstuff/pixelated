/**
 * Minimal logging surface provided by the build-safe logger.
 */
export interface BuildSafeLogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * Stub for createBuildSafeLogger and getStartupLogger.
 * Replace with real logger implementation as needed.
 */
export function createBuildSafeLogger(prefix: string = 'app'): BuildSafeLogger {
  const tag = `[build-safe-logger][${prefix}]`

  return {
    info: (...args: unknown[]) => console.info(tag, ...args),
    warn: (...args: unknown[]) => console.warn(tag, ...args),
    error: (...args: unknown[]) => console.error(tag, ...args),
    debug: (...args: unknown[]) => console.debug(tag, ...args),
  }
}

/**
 * Provides a logger pre-bound to the 'startup' prefix for application startup routines.
 */
export function getStartupLogger(): BuildSafeLogger {
  return createBuildSafeLogger('startup')
}
