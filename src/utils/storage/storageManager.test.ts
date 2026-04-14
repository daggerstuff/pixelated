import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { StorageManager } from './storageManager'

describe('StorageManager - Quota Estimation Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should fall back to configured maxStorageSize when navigator.storage is missing', () => {
    // Safely stub navigator to completely remove it from the global scope
    vi.stubGlobal('navigator', undefined)

    const manager = new StorageManager({ maxStorageSize: 2048 })

    // The internal quota state should remain the configured fallback
    expect(manager.getStorageInfo().quota).toBe(2048)
  })

  it('should fall back to configured maxStorageSize when navigator.storage.estimate throws synchronously', () => {
    const mockEstimate = vi.fn().mockImplementation(() => {
      throw new Error('Quota estimation failed synchronously')
    })

    vi.stubGlobal('navigator', {
      storage: {
        estimate: mockEstimate,
      },
    })

    const manager = new StorageManager({ maxStorageSize: 4096 })

    // The mock ensures the internal try/catch triggers the fallback behavior
    expect(manager.getStorageInfo().quota).toBe(4096)
  })

  it('should fall back to configured maxStorageSize when navigator.storage.estimate rejects', async () => {
    const mockEstimate = vi
      .fn()
      .mockRejectedValue(new Error('Quota estimation rejected'))

    vi.stubGlobal('navigator', {
      storage: {
        estimate: mockEstimate,
      },
    })

    // To catch unhandled rejections in Node.js/Vitest during the test
    let unhandledError: any = null
    const listener = (reason: any) => {
      unhandledError = reason
    }
    process.on('unhandledRejection', listener)

    try {
      const manager = new StorageManager({ maxStorageSize: 1024 })

      // Wait for microtasks to flush the promise rejection
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Internal quota should still be the fallback because the promise failed (or hadn't finished updating)
      expect(manager.getStorageInfo().quota).toBe(1024)

      // Verify the rejection occurred
      expect(mockEstimate).toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', listener)
    }
  })
})
