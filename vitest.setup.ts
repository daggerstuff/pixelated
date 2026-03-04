// Minimal vitest setup
import { vi, beforeEach } from 'vitest'

// Mock global fetch
global.fetch = vi.fn()

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode() { return new Uint8Array() }
} as any

global.TextDecoder = class {
  decode() { return '' }
} as any

// Set required env vars for tests
process.env['PUBLIC_URL'] = 'http://localhost:3000'
process.env['NODE_ENV'] = 'test'
process.env['ENCRYPTION_KEY'] = 'test-key-32-chars-long-1234567890'
