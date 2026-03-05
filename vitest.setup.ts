import { vi } from 'vitest'

// Mock TextEncoder/TextDecoder if not present (Node environment)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Mock fetch if not present
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn()
}

// Set required environment variables for tests
process.env['PUBLIC_URL'] = 'http://localhost:3000'
process.env['NODE_ENV'] = 'test'
process.env['ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-long-!!!'
process.env['SENTRY_DSN'] = 'https://example.com'
process.env['AUTH0_SECRET'] = 'test-secret'
process.env['AUTH0_BASE_URL'] = 'http://localhost:3000'
process.env['AUTH0_ISSUER_BASE_URL'] = 'https://test.auth0.com'
process.env['AUTH0_CLIENT_ID'] = 'test-client-id'
process.env['AUTH0_CLIENT_SECRET'] = 'test-client-secret'
