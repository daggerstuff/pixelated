// ESM compatibility wrapper for React DOM
import ReactDOM from 'react-dom'
export default ReactDOM
export const {
  render,
  hydrate,
  unmountComponentAtNode,
  findDOMNode,
  createPortal,
  flushSync,
  unstable_batchedUpdates,
  version,
} = ReactDOM
