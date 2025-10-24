// Compatibility JS entry for standardized-logger
// Mirror the TypeScript implementation API so modules that import
// `standardized-logger` (TS or JS) get the expected factory functions.

const { getLogger } = require('../utils/logger.ts')

function makeProxy(name) {
  return {
    info: (message, ...args) => {
      const target = getLogger(name)
      const fn =
        target && typeof target.info === 'function'
          ? target.info.bind(target)
          : console.info.bind(console)
      fn(message, ...args)
    },
    warn: (message, ...args) => {
      const target = getLogger(name)
      const fn =
        target && typeof target.warn === 'function'
          ? target.warn.bind(target)
          : console.warn.bind(console)
      fn(message, ...args)
    },
    error: (message, ...args) => {
      const target = getLogger(name)
      const fn =
        target && typeof target.error === 'function'
          ? target.error.bind(target)
          : console.error.bind(console)
      fn(message, ...args)
    },
    debug: (message, ...args) => {
      const target = getLogger(name)
      const fn =
        target && typeof target.debug === 'function'
          ? target.debug.bind(target)
          : console.debug.bind(console)
      fn(message, ...args)
    },
  }
}

function getBiasDetectionLogger(scope) {
  return getLogger(`bias-detection:${scope}`)
}

function getClinicalAnalysisLogger(scope) {
  return getLogger(`clinical-analysis:${scope}`)
}

function getAiServiceLogger(scope) {
  return getLogger(`ai-service:${scope}`)
}

function getApiEndpointLogger(scope) {
  return getLogger(`api-endpoint:${scope}`)
}

function getComponentLogger(scope) {
  return getLogger(`component:${scope}`)
}

function getServiceLogger(scope) {
  return getLogger(`service:${scope}`)
}

function getSecurityLogger(scope) {
  return getLogger(`security:${scope}`)
}

function getAdvancedPHILogger(config) {
  const loggerConfig = config || {}
  return getLogger(
    `advanced-phi${loggerConfig.enableLogCollection ? ':collect' : ''}`,
  )
}

function getHipaaCompliantLogger(scope) {
  return getLogger(`hipaa:${scope}`)
}

const standardizedLogger = makeProxy('general')
const appLogger = makeProxy('app')

module.exports = {
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

// Provide a default property for interoperability with ESM-style default imports
module.exports.default = module.exports
