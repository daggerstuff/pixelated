/* @vitest-environment node */
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { config } from '@/config/env.config'

import { decrypt, encrypt } from '../encryption'

// Test fixture, not a credential — keeps this file independent of .env.
const TEST_ENCRYPTION_KEY = 'a'.repeat(32)

beforeAll(() => {
  vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY)
})

describe('Security Implementation Verification', () => {
  it('should have encryption key configured', () => {
    const key = config.security.encryption.key()
    expect(key).toBeDefined()
    expect(key?.length).toBeGreaterThanOrEqual(32)
  })

  it('should encrypt and decrypt data correctly using the configured key', async () => {
    const sensitiveData = {
      patientId: '12345',
      diagnosis: 'Anxiety',
      notes: 'Patient is responsive to CBT.',
    }

    const encrypted = await encrypt(sensitiveData)
    expect(encrypted).toBeDefined()
    expect(typeof encrypted).toBe('string')

    const parsed = JSON.parse(encrypted)
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('data')
    expect(parsed).toHaveProperty('tag')
    expect(parsed).toHaveProperty('salt')

    const decrypted = await decrypt(encrypted)
    expect(decrypted).toEqual(sensitiveData)
  })

  it('should have audit logging enabled by default based on config', () => {
    expect(config.security.audit.enabled()).toBe(true)
  })

  it('should have correct audit log retention days', () => {
    expect(config.security.audit.retentionDays()).toBe(2555)
  })
})
