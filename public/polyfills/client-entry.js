/**
 * Client entry point
 * This file is loaded before all other client-side code to ensure polyfills are available
 */

// Import our custom Buffer polyfill first to prevent redeclaration issues
import './buffer-polyfill.js';

// Now any other client-side code can safely use Buffer
console.log('Buffer polyfill loaded and ready');

// Expose Buffer globally to ensure it's available to all code
if (typeof window !== 'undefined') {
  window.Buffer = globalThis.Buffer;
}
