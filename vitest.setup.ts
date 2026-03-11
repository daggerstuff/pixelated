import { vi } from 'vitest'

// Mock global fetch
global.fetch = vi.fn()

// Mock core environment variables
process.env.VITE_AI_SERVICE_URL = 'http://localhost:8002'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.DATABASE_URL = 'mongodb://localhost:27017/test_db'
