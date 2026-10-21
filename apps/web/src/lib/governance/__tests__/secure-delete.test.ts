/**
 * Tests for crypto-shred secure deletion in LifecycleManager
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { LifecycleManager } from '../lifecycle-manager'

/** Minimal fake matching the EncryptionManager surface secureDelete uses. */
function createFakeEncryptionManager() {
  const destroyedKeys: string[] = []
  return {
    destroyedKeys,
    destroyKey(keyId: string): boolean {
      if (destroyedKeys.includes(keyId)) return false
      destroyedKeys.push(keyId)
      return true
    },
  }
}

describe('LifecycleManager secureDelete', () => {
  let manager: LifecycleManager

  beforeEach(() => {
    manager = new LifecycleManager()
  })

  it('crypto-shreds the record key when an encryption key is registered', async () => {
    const recordId = 'test-record-123'
    manager.applyRetention(recordId, '30-day', new Date(), 'key-abc')

    expect(manager.getRetention(recordId)).toBeDefined()

    const encryption = createFakeEncryptionManager()
    const result = await manager.secureDelete(recordId, encryption)

    expect(result).toEqual({
      deleted: true,
      method: 'crypto-shred',
      keyDestroyed: true,
    })
    expect(encryption.destroyedKeys).toEqual(['key-abc'])
    expect(manager.getRetention(recordId)).toBeUndefined()
  })

  it('removes an unencrypted record but honestly reports no shred', async () => {
    const recordId = 'test-record-456'
    manager.applyRetention(recordId, '30-day', new Date())

    const result = await manager.secureDelete(recordId)

    // No key on record means nothing was shredded — method must not claim it.
    expect(result).toEqual({
      deleted: true,
      method: 'none',
    })
    expect(manager.getRetention(recordId)).toBeUndefined()
  })

  it('removes an encrypted record without a manager but does not claim a shred', async () => {
    const recordId = 'test-record-457'
    manager.applyRetention(recordId, '30-day', new Date(), 'key-def')

    const result = await manager.secureDelete(recordId)

    expect(result).toEqual({
      deleted: true,
      method: 'none',
    })
    expect(manager.getRetention(recordId)).toBeUndefined()
  })

  it('reports keyDestroyed false when the key was already destroyed', async () => {
    const recordId = 'test-record-458'
    manager.applyRetention(recordId, '30-day', new Date(), 'key-xyz')

    const encryption = createFakeEncryptionManager()
    await manager.secureDelete(recordId, encryption)
    // Second delete of the same id: record is already gone.
    const second = await manager.secureDelete(recordId, encryption)
    expect(second.deleted).toBe(false)
  })

  it('returns deleted: false and method: none when record not found', async () => {
    const result = await manager.secureDelete('non-existent-record')

    expect(result).toEqual({
      deleted: false,
      method: 'none',
    })
  })
})
