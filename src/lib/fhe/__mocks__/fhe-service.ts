/**
 * Mock implementation of the FHE service for testing
 */
import { vi } from 'vitest'

export const mockFHEService = {
  encrypt: vi.fn((data: string) => Promise.resolve(`encrypted-${data}`)),
  decrypt: vi.fn((data: string) =>
    Promise.resolve(data.replace('encrypted-', '')),
  ),
  verifySender: vi.fn(() => Promise.resolve(true)),
  processEncrypted: vi.fn(() =>
    Promise.resolve({
      success: true,
      metadata: { operation: 'test' },
    }),
  ),
}

export default mockFHEService
