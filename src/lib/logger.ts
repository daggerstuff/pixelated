/**
 * Re-export logger from utils/logger for backward compatibility
 */
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export { createBuildSafeLogger, logger }
export default logger
