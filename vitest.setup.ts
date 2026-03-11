/**
 * Global Vitest setup file
 */
import { vi, afterEach } from 'vitest'

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api'
process.env.ENCRYPTION_KEY = 'test-encryption-key-must-be-32-chars-long-!!!'

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
