import { afterEach, beforeEach, vi } from 'vitest'

// Ensure JWT signing secret is present for auth-related services in test runs.
process.env['JWT_SECRET'] ??= 'test-jwt-secret'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
