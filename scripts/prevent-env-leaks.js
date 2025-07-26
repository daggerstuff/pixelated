#!/usr/bin/env node

/**
 * prevent-env-leaks.js
 *
 * This script helps prevent environment variable leaks during the build process by:
 * 1. Detecting common tools/libraries that might print environment variables
 * 2. Setting environment variables to hide sensitive information
 * 3. Applying patches to common logging methods
 */

// Define sensitive environment variable patterns
const SENSITIVE_ENV_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /conn/i,
]

// Get all environment variables
const allEnvVars = Object.keys(process.env)

// Find potentially sensitive variables
const sensitiveVars = allEnvVars.filter((varName) =>
  SENSITIVE_ENV_PATTERNS.some((pattern) => pattern.test(varName)),
)

console.log(
  `🔍 Detected ${sensitiveVars.length} potentially sensitive environment variables`,
)

// Replace console.log, console.dir, and util.inspect to prevent leaking sensitive values
function patchLoggingFunctions() {
  const origConsoleLog = console.log
  const origConsoleDir = console.dir
  const origConsoleError = console.error

  // Helper function to sanitize strings
  const sanitizeString = (str) => {
    if (typeof str !== 'string') {
      return str
    }

    let sanitized = str
    sensitiveVars.forEach((varName) => {
      if (process.env[varName]) {
        const value = process.env[varName]
        if (value.length > 5) {
          // Only replace non-trivial values
          // Create a regex that escapes special characters
          const escapedValue = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
          const valueRegex = new RegExp(escapedValue, 'g')
          sanitized = sanitized.replace(valueRegex, '[REDACTED]')
        }
      }
    })
    return sanitized
  }

  // Patch console.log
  console.log = function (...args) {
    const sanitizedArgs = args.map((arg) => {
      if (typeof arg === 'string') {
        return sanitizeString(arg)
      } else if (arg && typeof arg === 'object') {
        // Don't try to sanitize Error objects or complex objects with circular references
        if (arg instanceof Error) {
          arg.message = sanitizeString(arg.message)
          return arg
        }
        // For other objects, we do a simple stringify/parse cycle for basic sanitization
        try {
          const json = JSON.stringify(arg)
          const sanitized = sanitizeString(json)
          return JSON.parse(sanitized)
        } catch (e) {
          // If we can't stringify/parse, just return the original
          return arg
        }
      }
      return arg
    })
    return origConsoleLog.apply(console, sanitizedArgs)
  }

  // Also patch console.dir and console.error
  console.dir = function (obj, options) {
    try {
      const json = JSON.stringify(obj)
      const sanitized = sanitizeString(json)
      return origConsoleDir.call(console, JSON.parse(sanitized), options)
    } catch (e) {
      return origConsoleDir.apply(console, arguments)
    }
  }

  console.error = function (...args) {
    const sanitizedArgs = args.map((arg) => {
      if (typeof arg === 'string') {
        return sanitizeString(arg)
      }
      return arg
    })
    return origConsoleError.apply(console, sanitizedArgs)
  }

  // Patch util.inspect if it gets used (common in Node.js debugging)
  try {
    const util = require('util')
    const origInspect = util.inspect

    util.inspect = function (obj, options) {
      const result = origInspect(obj, options)
      return sanitizeString(result)
    }

    console.log('✅ Patched util.inspect to prevent environment leaks')
  } catch (e) {
    // util may not be available - that's fine
  }

  console.log('✅ Patched console methods to prevent environment leaks')
}

// NODE_OPTIONS modification removed - --no-environment is not a valid Node.js flag
// Environment leak prevention is handled by the logging patches below

// Add environment variable to indicate leak prevention is active
process.env.ENV_LEAK_PREVENTION_ACTIVE = 'true'

// Patch logging functions
patchLoggingFunctions()

console.log('✅ Environment leak prevention measures active')

// The script completes, but the patches remain active in the current process
