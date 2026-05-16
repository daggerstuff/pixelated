/**
 * Mock implementation of the FHE service for testing
 */
import { vi } from 'vitest'

export const mockFHEService = {
  encrypt: vi.fn(async (data: string) => `encrypted-${data}`),
  decrypt: vi.fn(async (data: string) => data.replace('encrypted-', '')),
  verifySender: vi.fn(async () => true),
  processEncrypted: vi.fn(async () => ({
      success: true,
      metadata: { operation: 'test' },
    })),
}

export default mockFHEService
