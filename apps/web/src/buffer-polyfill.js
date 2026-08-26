/**
 * Buffer Polyfill - Browser-compatible implementation
 * This approach uses buffer package as recommended by Vite solutions
 */

import { Buffer as BufferFromPackage } from 'buffer'

// Try to import from buffer package safely
const BufferPolyfill = BufferFromPackage

// Safely expose Buffer to global scope only if not already defined
if (
  typeof globalThis !== 'undefined' &&
  typeof globalThis.Buffer === 'undefined'
) {
  globalThis.Buffer = BufferPolyfill
}

// Export Buffer for direct imports
export { BufferPolyfill as Buffer }

// Export default for ESM compatibility
export default BufferPolyfill
