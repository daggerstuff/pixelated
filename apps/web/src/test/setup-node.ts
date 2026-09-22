import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

// Ensure JWT signing secret is present for auth-related services in test runs.
process.env['JWT_SECRET'] ??= 'test-jwt-secret'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Isolate process.env per test FILE. The forks pool reuses worker processes
// across files even with isolate:true, so a test file that sets or deletes
// env vars without restoring them leaks its state into every later file that
// shares the worker. Snapshot before the file, restore after it, no matter
// which test mutated.
const envSnapshot = new Map<string, string | undefined>()
beforeAll(() => {
  envSnapshot.clear()
  for (const [key, value] of Object.entries(process.env)) {
    envSnapshot.set(key, value)
  }
})
afterAll(() => {
  // Drop keys added during this file.
  for (const key of Object.keys(process.env)) {
    if (!envSnapshot.has(key)) {
      delete process.env[key]
    }
  }
  // Restore changed or deleted keys from the snapshot.
  for (const [key, original] of envSnapshot) {
    if (process.env[key] !== original) {
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    }
  }
})
