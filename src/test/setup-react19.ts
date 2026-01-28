/**
 * React 19 compatibility setup for testing environment
 * This provides minimal compatibility fixes without breaking actual component rendering
 */

import * as React from 'react'

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
try {
  if (!React.act || typeof React.act !== 'function') {
    // @ts-expect-error - Adding act to React for compatibility
    ;(React as unknown as { act?: typeof act }).act = act
  }
} catch {
  // If we can't set it directly, try with Object.defineProperty
  try {
    const reactNamespace = React as unknown as object

    Object.defineProperty(reactNamespace, 'act', {
      value: act,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch (defineError) {
    // If both fail, log the error but continue
    console.warn('Could not set React.act:', defineError)
  }
}

// Export act for use in tests
export { act }

// Ensure React Testing Library can work with React 19
if (typeof window !== 'undefined') {
  // Add any React 19 specific polyfills or compatibility fixes here if needed
}
