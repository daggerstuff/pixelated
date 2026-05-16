/**
 * Tests for crypto-shred secure deletion in LifecycleManager
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { LifecycleManager } from '../lifecycle-manager'

describe('LifecycleManager secureDelete', () => {
  let manager: LifecycleManager

  beforeEach(() => {
    manager = new LifecycleManager()
  })

  it('crypto-shreds data on deletion', async () => {
    // Apply a retention policy first
    const recordId = 'test-record-123'
    manager.applyRetention(recordId, '30-day', new Date())

    // Verify record exists
    expect(manager.getRetention(recordId)).toBeDefined()

    // Crypto-shred delete
    const result = await manager.secureDelete(recordId)

    // Verify the record is deleted (crypto-shred = key deletion)
    expect(manager.getRetention(recordId)).toBeUndefined()
  })

  it('returns deleted: true and method: crypto-shred', async () => {
    const recordId = 'test-record-456'
    manager.applyRetention(recordId, '30-day', new Date())

    const result = await manager.secureDelete(recordId)

    expect(result).toEqual({
      deleted: true,
      method: 'crypto-shred',
    })
  })

  it('returns deleted: false and method: none when record not found', async () => {
    const result = await manager.secureDelete('non-existent-record')

    expect(result).toEqual({
      deleted: false,
      method: 'none',
    })
  })
})
