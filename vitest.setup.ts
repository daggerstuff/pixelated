import * as React from 'react'
import { vi } from 'vitest'

const reactCompat = React as typeof React & {
  act?: (callback: () => void | Promise<void>) => Promise<void>
}

// React 19 compatibility: polyfill React.act for react-dom-test-utils
if (!reactCompat.act || typeof reactCompat.act !== 'function') {
  const act = (callback: () => void | Promise<void>): Promise<void> => {
    const result = callback()
    if (result && typeof result === 'object' && 'then' in result) {
      return Promise.resolve(result).then(() => {
        if (typeof queueMicrotask !== 'undefined') {
          return new Promise<void>((resolve) => {
            queueMicrotask(() => resolve())
          })
        }
        return Promise.resolve()
      })
    }
    if (typeof queueMicrotask !== 'undefined') {
      return new Promise<void>((resolve) => {
        queueMicrotask(() => resolve())
      })
    }
    return Promise.resolve()
  }
  try {
    Object.defineProperty(reactCompat, 'act', {
      value: act,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    // React.act may already be defined in React 19.2.4 - safe to skip
  }
}
