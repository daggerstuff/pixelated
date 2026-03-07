/**
 * Stub for createBuildSafeLogger and getStartupLogger.
 * Replace with real logger implementation as needed.
 */
export function createBuildSafeLogger(prefix: string = 'app') {
  const tag = `[build-safe-logger][${prefix}]`

  return {
    info: (...args: unknown[]) => (console.info || console.log)(tag, ...args),
    warn: (...args: unknown[]) => (console.warn || console.log)(tag, ...args),
    error: (...args: unknown[]) => (console.error || console.log)(tag, ...args),
    debug: (...args: unknown[]) => (console.debug || console.log)(tag, ...args),
  }
}

/**
 * Provides a logger pre-bound to the 'startup' prefix for application startup routines.
 */
export function getStartupLogger() {
  return createBuildSafeLogger('startup')
}
