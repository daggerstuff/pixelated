/**
 * Node.js polyfills for browser compatibility
 * This file ensures that Node.js-specific APIs like Buffer are
 * properly polyfilled in browser environments.
 */

// Import the Buffer class from the buffer package
import { Buffer as BufferClass } from 'buffer'

// Make Buffer available globally
if (typeof globalThis.Buffer === 'undefined') {
  interface GlobalThisWithBuffer {
    Buffer: typeof BufferClass
  }
  ;(globalThis as unknown as GlobalThisWithBuffer).Buffer = BufferClass
}

// Export the Buffer for use in other modules
export const Buffer = BufferClass

// Ensure process is available
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    version: '',
    versions: {
      node: '0.0.0',
      v8: '0.0.0',
      uv: '0.0.0',
      zlib: '0.0.0',
      brotli: '0.0.0',
      ares: '0.0.0',
      modules: '0',
      nghttp2: '0.0.0',
      napi: '0',
      llhttp: '0.0.0',
      openssl: '0.0.0',
      cldr: '0.0',
      icu: '0.0',
      tz: '0000',
      unicode: '0.0',
      http_parser: '0.0.0',
    } as NodeJS.ProcessVersions,
    platform: 'browser' as NodeJS.Platform,
    argv: [],
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
      setTimeout(() => fn(...args), 0)
    },
  } as unknown as NodeJS.Process
}

// Add other Node.js APIs as needed
export default {
  Buffer: BufferClass,
  // Export other polyfilled APIs if needed
}
