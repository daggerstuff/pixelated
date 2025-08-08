/**
 * Buffer Polyfill - Browser-compatible implementation
 * This approach uses buffer package as recommended by Vite solutions
 */

// Try to import from buffer package safely
let BufferPolyfill
try {
  // Import Buffer from buffer package
  const bufferPkg = require('buffer/')
  BufferPolyfill = bufferPkg.Buffer
} catch (_error) {
  // Fallback implementation if package import fails
  BufferPolyfill = class BufferShim extends Uint8Array {
    static from(data, _encoding) {
      if (typeof data === 'string') {
        const encoder = new TextEncoder()
        return encoder.encode(data)
      }
      return new Uint8Array(data)
    }

    static alloc(size, fill = 0) {
      const buffer = new Uint8Array(size)
      if (fill !== 0) {
        buffer.fill(fill)
      }
      return buffer
    }

    static isBuffer(obj) {
      return obj instanceof Uint8Array
    }

    toString(_encoding) {
      const decoder = new TextDecoder()
      return decoder.decode(this)
    }
  }
}

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
