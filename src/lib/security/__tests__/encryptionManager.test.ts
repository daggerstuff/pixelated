/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EncryptionManager } from '../encryptionManager'
import type { EncryptionConfig, EncryptedData } from '../encryptionManager'

vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('EncryptionManager', () => {
  let manager: EncryptionManager
  let config: EncryptionConfig

  beforeEach(() => {
    config = {
      algorithm: 'AES-GCM',
      keySize: 256,
      keyRotationDays: 90,
      enableHSM: false,
    }
    manager = new EncryptionManager(config)
  })

  describe('constructor', () => {
    it('should apply default values for optional config', () => {
      const minimalConfig: EncryptionConfig = {
        algorithm: 'AES-GCM',
        keySize: 256,
        keyRotationDays: 30,
      }
      const mgr = new EncryptionManager(minimalConfig)
      expect(mgr).toBeDefined()
    })
  })

  describe('initialize', () => {
    it('should initialize with software keys when HSM disabled', async () => {
      await expect(manager.initialize()).resolves.not.toThrow()
    })

    it('should throw when HSM enabled without config', async () => {
      const hsmConfig: EncryptionConfig = {
        algorithm: 'AES-GCM',
        keySize: 256,
        keyRotationDays: 90,
        enableHSM: true,
      }
      const hsmManager = new EncryptionManager(hsmConfig)
      await expect(hsmManager.initialize()).rejects.toThrow(
        'HSM configuration required',
      )
    })

    it('should initialize with HSM when properly configured', async () => {
      const hsmConfig: EncryptionConfig = {
        algorithm: 'AES-GCM',
        keySize: 256,
        keyRotationDays: 90,
        enableHSM: true,
        hsmConfig: {
          provider: 'mock-hsm',
          keyLabel: 'test-key',
        },
      }
      const hsmManager = new EncryptionManager(hsmConfig)
      await expect(hsmManager.initialize()).resolves.not.toThrow()
    })
  })

  describe('encrypt', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should encrypt data and return EncryptedData structure', async () => {
      const plaintext = 'sensitive patient data'
      const result = await manager.encrypt(plaintext)

      expect(result).toHaveProperty('ciphertext')
      expect(result).toHaveProperty('iv')
      expect(result).toHaveProperty('keyId')
      expect(result).toHaveProperty('algorithm', 'AES-GCM')
      expect(result).toHaveProperty('timestamp')
      expect(typeof result.ciphertext).toBe('string')
      expect(result.ciphertext.length).toBeGreaterThan(0)
    })

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'same data'
      const result1 = await manager.encrypt(plaintext)
      const result2 = await manager.encrypt(plaintext)

      expect(result1.iv).not.toBe(result2.iv)
    })

    it('should throw when no key is available', async () => {
      const uninitializedManager = new EncryptionManager(config)
      await expect(uninitializedManager.encrypt('data')).rejects.toThrow(
        'No encryption key available',
      )
    })

    it('should throw when specified keyId not found', async () => {
      await expect(manager.encrypt('data', 'nonexistent-key')).rejects.toThrow(
        'Key not found',
      )
    })
  })

  describe('decrypt', () => {
    let encryptedData: EncryptedData

    beforeEach(async () => {
      await manager.initialize()
      encryptedData = await manager.encrypt('test data for decryption')
    })

    it('should decrypt data encrypted with same manager', async () => {
      const decrypted = await manager.decrypt(encryptedData)
      expect(decrypted).toBe('test data for decryption')
    })

    it('should throw for unknown key ID', async () => {
      const tamperedData: EncryptedData = {
        ...encryptedData,
        keyId: 'unknown-key-id',
      }
      await expect(manager.decrypt(tamperedData)).rejects.toThrow(
        'Unknown key ID',
      )
    })

    it('should throw for inactive key', async () => {
      const originalKey = manager.getCurrentKeyInfo()
      expect(originalKey).not.toBeNull()

      await manager.rotateKeys()

      const tamperedData: EncryptedData = {
        ...encryptedData,
        keyId: originalKey!.id,
      }
      await expect(manager.decrypt(tamperedData)).rejects.toThrow('not active')
    })
  })

  describe('AES-CBC algorithm', () => {
    let cbcManager: EncryptionManager

    beforeEach(async () => {
      cbcManager = new EncryptionManager({
        algorithm: 'AES-CBC',
        keySize: 256,
        keyRotationDays: 90,
      })
      await cbcManager.initialize()
    })

    it('should encrypt with AES-CBC', async () => {
      const result = await cbcManager.encrypt('cbc test data')
      expect(result.algorithm).toBe('AES-CBC')
      expect(result.tag).toBeUndefined()
    })

    it('should decrypt AES-CBC encrypted data', async () => {
      const encrypted = await cbcManager.encrypt('cbc roundtrip')
      const decrypted = await cbcManager.decrypt(encrypted)
      expect(decrypted).toBe('cbc roundtrip')
    })
  })

  describe('key metadata', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should track key metadata after initialization', async () => {
      const keys = manager.listKeys()
      expect(keys.length).toBeGreaterThan(0)
      expect(keys[0]).toHaveProperty('id')
      expect(keys[0]).toHaveProperty('status', 'active')
    })

    it('should return current key info', async () => {
      const currentKey = manager.getCurrentKeyInfo()
      expect(currentKey).not.toBeNull()
      expect(currentKey?.status).toBe('active')
    })

    it('should update usage count after encryption', async () => {
      const initialKeys = manager.listKeys()
      const initialUsage = initialKeys[0].usage.length
      
      await manager.encrypt('data 1')
      await manager.encrypt('data 2')
      
      const updatedKeys = manager.listKeys()
      expect(updatedKeys[0].usage.length).toBeGreaterThan(initialUsage)
    })
  })

  describe('key rotation', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should rotate keys and mark old key as inactive', async () => {
      const originalKeys = manager.listKeys()
      const originalKeyId = originalKeys[0].id

      await manager.rotateKeys()

      const allKeys = manager.listKeys()
      const oldKey = allKeys.find((m) => m.id === originalKeyId)
      expect(oldKey?.status).toBe('inactive')

      const newActiveKey = manager.getCurrentKeyInfo()
      expect(newActiveKey?.id).not.toBe(originalKeyId)
    })

    it('should return old and new key IDs from rotation', async () => {
      const currentKey = manager.getCurrentKeyInfo()
      const result = await manager.rotateKeys()

      expect(result.oldKeyId).toBe(currentKey?.id)
      expect(result.newKeyId).not.toBe(currentKey?.id)
    })
  })

  describe('key revocation', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should revoke a key and mark as compromised', async () => {
      const currentKey = manager.getCurrentKeyInfo()
      expect(currentKey).not.toBeNull()

      const result = manager.revokeKey(currentKey!.id, 'test revocation')
      expect(result).toBe(true)

      const revokedKey = manager.listKeys().find((m) => m.id === currentKey!.id)
      expect(revokedKey?.status).toBe('compromised')
    })

    it('should return false for non-existent key', () => {
      const result = manager.revokeKey('nonexistent', 'test')
      expect(result).toBe(false)
    })
  })

  describe('ECDH key exchange', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should generate ECDH key pair', async () => {
      const keyPair = await (manager as any).generateEcdhKeyPair()
      expect(keyPair).toHaveProperty('publicKey')
      expect(keyPair).toHaveProperty('privateKey')
    })

    it('should derive shared secret between two parties', async () => {
      const aliceKeyPair = await (manager as any).generateEcdhKeyPair()
      const bobKeyPair = await (manager as any).generateEcdhKeyPair()

      const aliceSecret = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: bobKeyPair.publicKey,
        },
        aliceKeyPair.privateKey,
        256,
      )

      const bobSecret = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: aliceKeyPair.publicKey,
        },
        bobKeyPair.privateKey,
        256,
      )

      expect(new Uint8Array(aliceSecret)).toEqual(new Uint8Array(bobSecret))
    })
  })
})