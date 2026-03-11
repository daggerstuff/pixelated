import { vi } from 'vitest'

// Global mocks
global.fetch = vi.fn()

// Environment variables
process.env.PUBLIC_SITE_URL = 'http://localhost:3000'
