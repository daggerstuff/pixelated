/**
 * Stub for createBuildSafeLogger and getStartupLogger.
 * Replace with real logger implementation as needed.
 */
export function createBuildSafeLogger(prefix: string = 'app') {
  const tag = `[build-safe-logger][${prefix}]`
  // Ensure we always return functions for each expected method. Tests may
  // mock this module and provide partial shapes; defensive defaults prevent
  // "logger.error is not a function" runtime errors.
  const safeFn = (
    fn: ((...a: unknown[]) => void) | undefined,
    fallback: (...a: unknown[]) => void,
  ) => {
    if (typeof fn === 'function') {
      return fn
    }
    return (...args: unknown[]) => fallback(tag, ...args)
  }

  return {
    info: safeFn(console.info, console.info),
    warn: safeFn(console.warn, console.warn),
    error: safeFn(console.error, console.error),
    debug: safeFn(console.debug, console.debug),
  }
}

/**
 * Provides a logger pre-bound to the 'startup' prefix for application startup routines.
 */
export function getStartupLogger() {
  return createBuildSafeLogger('startup')
}
