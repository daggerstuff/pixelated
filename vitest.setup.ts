import { vi } from 'vitest'

// Initialize global mocks
global.fetch = vi.fn()

// Core environment variables
process.env.NODE_ENV = 'test'
process.env.PUBLIC_SITE_URL = 'http://localhost:3000'
