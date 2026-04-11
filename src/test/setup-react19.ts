/**
 * React 19 compatibility setup for testing environment
 * This provides minimal compatibility fixes without breaking actual component rendering
 */

import * as React from 'react'
import { createRequire } from 'node:module'

// In React 19, act has been moved. We need to create a polyfill
// that works with React Testing Library
const act = (callback: () => void | Promise<void>): Promise<void> => {
  const result = callback()

  // If the callback returns a promise, wait for it
  if (result && typeof result === 'object' && 'then' in result) {
    return Promise.resolve(result).then(() => {
      // Flush any pending updates
      if (typeof queueMicrotask !== 'undefined') {
        return new Promise<void>((resolve) => {
          queueMicrotask(() => resolve())
        })
      }
      return Promise.resolve()
    })
  }

  // For synchronous callbacks, return a resolved promise
  if (typeof queueMicrotask !== 'undefined') {
    return new Promise<void>((resolve) => {
      queueMicrotask(() => resolve())
    })
  }

  return Promise.resolve()
}

// Try to add act to React object for React DOM test utils compatibility
const reactNamespace = React as unknown as object
const actDescriptor = Object.getOwnPropertyDescriptor(reactNamespace, 'act')
const require = createRequire(import.meta.url)
const reactCjs = require('react') as Record<string, unknown>
const reactDomTestUtils = require('react-dom/test-utils') as Record<string, unknown>
const cjsActDescriptor = Object.getOwnPropertyDescriptor(reactCjs, 'act')
const testUtilsActDescriptor = Object.getOwnPropertyDescriptor(
  reactDomTestUtils,
  'act',
)

if (!React.act || typeof React.act !== 'function') {
  if (!actDescriptor || actDescriptor.configurable) {
    try {
      Object.defineProperty(reactNamespace, 'act', {
        value: act,
        writable: true,
        configurable: true,
        enumerable: false,
      })
    } catch {
      // If React exposes a non-configurable act implementation, leave it untouched.
    }
  }
}

if (typeof reactCjs.act !== 'function') {
  if (!cjsActDescriptor || cjsActDescriptor.configurable || cjsActDescriptor.writable) {
    try {
      Object.defineProperty(reactCjs, 'act', {
        value: act,
        writable: true,
        configurable: true,
        enumerable: false,
      })
    } catch {
      // Leave the CommonJS export untouched if the runtime locks it down.
    }
  }
}

if (typeof reactDomTestUtils.act !== 'function') {
  if (
    !testUtilsActDescriptor ||
    testUtilsActDescriptor.configurable ||
    testUtilsActDescriptor.writable
  ) {
    try {
      Object.defineProperty(reactDomTestUtils, 'act', {
        value: act,
        writable: true,
        configurable: true,
        enumerable: false,
      })
    } catch {
      // Leave the test-utils export untouched if the runtime locks it down.
    }
  }
}

// Export act for use in tests
export { act }

// Ensure React Testing Library can work with React 19
if (typeof window !== 'undefined') {
  // Add any React 19 specific polyfills or compatibility fixes here if needed
}
