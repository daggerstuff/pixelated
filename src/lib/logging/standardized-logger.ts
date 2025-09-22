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

export type Logger = {
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string | Error, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
}

// Factory functions for named loggers - delegate to canonical getLogger so tests can mock
export function getBiasDetectionLogger(scope: string): Logger {
  return getLogger(`bias-detection:${scope}`) as unknown as Logger
}

export function getClinicalAnalysisLogger(scope: string): Logger {
  return getLogger(`clinical-analysis:${scope}`) as unknown as Logger
}

export function getAiServiceLogger(scope: string): Logger {
  return getLogger(`ai-service:${scope}`) as unknown as Logger
}

export function getApiEndpointLogger(scope: string): Logger {
  return getLogger(`api-endpoint:${scope}`) as unknown as Logger
}

export function getComponentLogger(scope: string): Logger {
  return getLogger(`component:${scope}`) as unknown as Logger
}

export function getServiceLogger(scope: string): Logger {
  return getLogger(`service:${scope}`) as unknown as Logger
}

export function getSecurityLogger(scope: string): Logger {
  return getLogger(`security:${scope}`) as unknown as Logger
}

export function getAdvancedPHILogger(config: { enableLogCollection?: boolean } = {}): Logger {
  return getLogger(`advanced-phi${config.enableLogCollection ? ':collect' : ''}`) as unknown as Logger
}

export function getHipaaCompliantLogger(scope: string): Logger {
  return getLogger(`hipaa:${scope}`) as unknown as Logger
}

// Default/general loggers - provide thin runtime proxies to getLogger
const makeProxy = (name: string) : Logger => ({
  info: (message: string, ...args: unknown[]) => {
    const target: any = getLogger(name) as any;
    const fn = target && typeof target.info === 'function' ? target.info.bind(target) : console.info.bind(console);
    fn(message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    const target: any = getLogger(name) as any;
    const fn = target && typeof target.warn === 'function' ? target.warn.bind(target) : console.warn.bind(console);
    fn(message, ...args);
  },
  error: (message: string | Error, ...args: unknown[]) => {
    const target: any = getLogger(name) as any;
    const fn = target && typeof target.error === 'function' ? target.error.bind(target) : console.error.bind(console);
    fn(message, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    const target: any = getLogger(name) as any;
    const fn = target && typeof target.debug === 'function' ? target.debug.bind(target) : console.debug.bind(console);
    fn(message, ...args);
  },
})

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
