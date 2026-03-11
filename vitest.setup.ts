/**
 * Global Vitest setup file
 */
import { vi, afterEach } from 'vitest'

// Mock global fetch to fail loudly if called without explicit mock
global.fetch = vi.fn().mockRejectedValue(new Error('Unmocked fetch call'))

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api'

// Clean up after each test
afterEach(() => {
  vi.resetAllMocks()
})