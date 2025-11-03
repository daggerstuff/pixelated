// Re-export logger from TypeScript implementation for compatibility
// This ensures the .js file exports what TypeScript files expect
// Note: Import from .ts is handled by the build system
import { createBuildSafeLogger } from './logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export { createBuildSafeLogger, logger }
export default logger
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = '7c5eef4f-e867-5ad3-ac5d-261ee88df62b'))
  } catch (e) {}
})()
//# debugId=7c5eef4f-e867-5ad3-ac5d-261ee88df62b
