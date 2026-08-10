'use strict'

// ESM compatibility for ReactDOM
// This is a manually created ESM shim for ReactDOM

// Handle production vs development builds
const ReactDOM =
  process.env.NODE_ENV === 'production'
    ? require('./cjs/react-dom.production.min.js')
    : require('./cjs/react-dom.development.js')

// We need to specify React dependency
const React = require('react')

// Some versions expect ReactDOM to know about the React object
if (typeof ReactDOM.setCurrentlyValidatingElement === 'function') {
  ReactDOM.setCurrentlyValidatingElement = React.setCurrentlyValidatingElement
}

// Export ReactDOM as default
export default ReactDOM

// Re-export all ReactDOM properties
export const {
  createPortal,
  findDOMNode,
  flushSync,
  hydrate,
  render,
  unmountComponentAtNode,
  unstable_batchedUpdates,
  unstable_createPortal,
  unstable_renderSubtreeIntoContainer,
  version,
} = ReactDOM

// Also export client methods if they exist
export const { createRoot } = ReactDOM
export const { hydrateRoot } = ReactDOM
