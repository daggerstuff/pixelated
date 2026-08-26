// Patched version of ReactDOM for ESM compatibility
import * as ReactDOM from 'react-dom'

// Default export
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
