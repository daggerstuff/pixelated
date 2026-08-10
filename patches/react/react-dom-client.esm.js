'use strict'

// ESM compatibility for ReactDOM client
// This is a manually created ESM shim for ReactDOM client

// Import ReactDOM with client methods
import ReactDOM from './react-dom.esm.js'

// Re-export createRoot and hydrateRoot
export const { createRoot } = ReactDOM
export const { hydrateRoot } = ReactDOM

// Also export a default if needed
export default {
  createRoot,
  hydrateRoot,
}
void (function () {
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
    if (n) {
      e._sentryDebugIds = e._sentryDebugIds || {}
      e._sentryDebugIds[n] = '62989174-49ef-58df-b11e-a95e4aa4ea6e'
    }
  } catch {}
})()
//# debugId=62989174-49ef-58df-b11e-a95e4aa4ea6e
