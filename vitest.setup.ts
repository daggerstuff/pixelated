/**
 * Global Vitest setup file
 */
import { vi, afterEach } from 'vitest'

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api'

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
