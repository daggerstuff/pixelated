/**
 * Standardized logger adapter.
 *
 * This module provides the historical standardized-logger API while delegating
 * to the canonical getLogger implementation in utils/logger at runtime. This
 * allows tests to mock getLogger (e.g., vi.spyOn or mockReturnValue) and have
 * modules that import `standardizedLogger` or factory helpers receive the
 * mocked logger implementation.
 */

import { getLogger } from '../utils/logger'

export type Logger = Pick<
  ReturnType<typeof getLogger>,
  'info' | 'warn' | 'error' | 'debug'
>

// Factory functions for named loggers - delegate to canonical getLogger so tests can mock
export function getBiasDetectionLogger(scope: string): Logger {
  const logger = getLogger(`bias-detection:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getClinicalAnalysisLogger(scope: string): Logger {
  const logger = getLogger(`clinical-analysis:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getAiServiceLogger(scope: string): Logger {
  const logger = getLogger(`ai-service:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getApiEndpointLogger(scope: string): Logger {
  const logger = getLogger(`api-endpoint:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getComponentLogger(scope: string): Logger {
  const logger = getLogger(`component:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getServiceLogger(scope: string): Logger {
  const logger = getLogger(`service:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getSecurityLogger(scope: string): Logger {
  const logger = getLogger(`security:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getAdvancedPHILogger(
  config: { enableLogCollection?: boolean } = {},
): Logger {
  const logger = getLogger(
    `advanced-phi${config.enableLogCollection ? ':collect' : ''}`,
  )
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

export function getHipaaCompliantLogger(scope: string): Logger {
  const logger = getLogger(`hipaa:${scope}`)
  return {
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
  }
}

// Default/general loggers - provide thin runtime proxies to getLogger
const makeProxy = (name: string): Logger => {
  return {
    info: (message: string, ...args: unknown[]) =>
      getLogger(name).info(message, ...args),
    warn: (message: string, ...args: unknown[]) =>
      getLogger(name).warn(message, ...args),
    error: (message: string | Error, ...args: unknown[]) =>
      getLogger(name).error(message, ...args),
    debug: (message: string, ...args: unknown[]) =>
      getLogger(name).debug(message, ...args),
  }
}

export const standardizedLogger: Logger = makeProxy('general')
export const appLogger: Logger = makeProxy('app')

// Provide a default export object to help interoperability between
// ESM named imports and CommonJS consumers or test mocks that replace
// the module with a default object. Some test runners / bundlers
// may resolve this module in a way that expects a default export.
export default {
  getBiasDetectionLogger,
  getClinicalAnalysisLogger,
  getAiServiceLogger,
  getApiEndpointLogger,
  getComponentLogger,
  getServiceLogger,
  getSecurityLogger,
  getAdvancedPHILogger,
  getHipaaCompliantLogger,
  standardizedLogger,
  appLogger,
}
