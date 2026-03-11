import { vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock fetch
global.fetch = vi.fn()

// Initialize core environment variables
process.env.NODE_ENV = 'test'
process.env.API_BASE_URL = 'http://localhost:5173'

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { },
      removeListener: () => { },
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => { },
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})
