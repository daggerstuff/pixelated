// Re-export logger from TypeScript implementation for compatibility
// This ensures the .js file exports what TypeScript files expect
// Note: Import from .ts is handled by the build system
import { createBuildSafeLogger } from './logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export { createBuildSafeLogger, logger }
export default logger
