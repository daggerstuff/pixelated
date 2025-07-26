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
