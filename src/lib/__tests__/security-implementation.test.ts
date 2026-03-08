
import { describe, it, expect } from 'vitest'
import 'dotenv/config'
import { encrypt, decrypt } from '../encryption'
import { config } from '@/config/env.config'

// Mock the config to ensure we're testing with controlled values if needed,
// but for integration verification we can also check the actual config loader.
// Since we updated .env, the config loader should pick up the values.

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
            notes: 'Patient is responsive to CBT.'
        }

        const encrypted = await encrypt(sensitiveData)
        expect(encrypted).toBeDefined()
        expect(typeof encrypted).toBe('string')

        // It should be a stringified JSON object with iv, data, tag, salt
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
