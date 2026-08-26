// Custom React loader to handle CommonJS vs ESM issues
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'

// Re-export everything
export { React, ReactDOM, ReactDOMClient }

// Default export React
export default React
