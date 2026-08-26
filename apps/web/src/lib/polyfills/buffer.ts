// Import the original Buffer from the 'buffer' package
import { Buffer as BufferOriginal } from 'buffer'

// Ensure Buffer is available globally
if (typeof globalThis.Buffer === 'undefined') {
  ;(globalThis as unknown as { Buffer: typeof BufferOriginal }).Buffer =
    BufferOriginal
}

// Export the Buffer for explicit imports
export const Buffer = BufferOriginal
export default BufferOriginal
