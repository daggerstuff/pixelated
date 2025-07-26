// Patched version of ReactDOM Client for ESM compatibility

import * as ReactDOMClient from 'react-dom/client'

export default ReactDOMClient

// Re-export client specific methods
export const { createRoot, hydrateRoot } = ReactDOMClient
