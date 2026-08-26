/* @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { SecurityError } from '../errors/security.error'
import {
  TokenEncryptionService,
  type TokenEncryptionConfig,
} from '../token.encryption'

const { mockCrypto } = vi.hoisted(() => {
  const mockSecureCipher = {
    update: vi.fn().mockReturnValue(Buffer.from('updated')),
    final: vi.fn().mockReturnValue(Buffer.from('final')),
    getAuthTag: vi.fn().mockReturnValue(Buffer.from('authTag_16_bytes')),
  }
  const mockSecureDecipher = {
    update: vi.fn().mockReturnValue(Buffer.from('decrypted_update')),
    final: vi.fn().mockReturnValue(Buffer.from('final_decrypted')),
    setAuthTag: vi.fn(),
  }

  return {
    mockCrypto: {
      createCipheriv: vi.fn(() => mockSecureCipher),
      createDecipheriv: vi.fn(() => mockSecureDecipher),
      randomBytes: vi.fn().mockReturnValue(Buffer.from('randomIV')),
      scrypt: vi.fn((_p, _s, _k, callback) =>
        callback(null, Buffer.from('derivedKey')),
      ),
    },
  }
})

describe('token Encryption Service', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }

  const testConfig: TokenEncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    salt: 'test-salt-long-enough-for-security',
  }

  const testPassword = 'test-password'
  const testToken = 'test-token'

  let tokenEncryptionService: TokenEncryptionService

  beforeEach(() => {
    tokenEncryptionService = new TokenEncryptionService(
      testConfig,
      mockLogger as unknown as Console,
      mockCrypto as any,
    )
    vi.clearAllMocks()
  })

  afterEach(() => {
    tokenEncryptionService.cleanup()
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should successfully initialize the service', async () => {
      await expect(
        tokenEncryptionService.initialize(testPassword),
      ).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token encryption service initialized successfully',
      )
    })

    it('should throw error when salt is too short', () => {
      expect(
        () =>
          new TokenEncryptionService({
            ...testConfig,
            salt: 'short',
          }),
      ).toThrow(
        'Token encryption salt is required and must be at least 16 characters long',
      )
    })

    it('should throw error when initialization fails', async () => {
      const error = new Error('Scrypt failed')
      // Use a safer approach to mock the error case without directly referencing crypto methods
      const originalScrypt = mockCrypto.scrypt
      mockCrypto.scrypt.mockImplementationOnce(
        (
          _password: unknown,
          _salt: unknown,
          _keylen: unknown,
          callback: (err: Error | null, derivedKey?: Buffer) => void,
        ) => callback(error),
      )

      await expect(
        tokenEncryptionService.initialize(testPassword),
      ).rejects.toThrow('Failed to initialize token encryption service')
      expect(mockLogger.error).toHaveBeenCalled()

      // Restore the original mock
      mockCrypto.scrypt = originalScrypt
    })
  })

  describe('token encryption', () => {
    beforeEach(async () => {
      await tokenEncryptionService.initialize(testPassword)
    })

    it('should successfully encrypt and decrypt a token', async () => {
      const { encryptedToken, iv, authTag } =
        await tokenEncryptionService.encryptToken(testToken)
      expect(encryptedToken).toBeDefined()
      expect(iv).toBeDefined()
      expect(authTag).toBeDefined()

      const decryptedToken = await tokenEncryptionService.decryptToken(
        encryptedToken,
        iv,
        authTag,
      )
      expect(decryptedToken).toBe('decrypted_updatefinal_decrypted')
    })

    it('should throw error when encrypting without initialization', async () => {
      tokenEncryptionService.cleanup()
      await expect(
        tokenEncryptionService.encryptToken(testToken),
      ).rejects.toThrow('Token encryption service not initialized')
    })

    it('should throw error when decrypting without initialization', async () => {
      tokenEncryptionService.cleanup()
      await expect(
        tokenEncryptionService.decryptToken('encrypted', 'iv', 'authTag'),
      ).rejects.toThrow('Token encryption service not initialized')
    })

    it('should throw error when decrypting with invalid data', async () => {
      await expect(
        tokenEncryptionService.decryptToken(
          'invalid',
          'iv_base64',
          'tag_base64',
        ),
      ).rejects.toThrow('Invalid authentication tag length')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('key rotation', () => {
    beforeEach(async () => {
      await tokenEncryptionService.initialize(testPassword)
    })

    it('should successfully rotate encryption key', async () => {
      const newPassword = 'new-password'

      // Encrypt token with old key
      const { encryptedToken, iv, authTag } =
        await tokenEncryptionService.encryptToken(testToken)

      // Rotate key
      await tokenEncryptionService.rotateKey(newPassword)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Encryption key rotated successfully',
      )

      // Verify we can still decrypt with new key
      const decryptedToken = await tokenEncryptionService.decryptToken(
        encryptedToken,
        iv,
        authTag,
      )
      expect(decryptedToken).toBe('decrypted_updatefinal_decrypted')
    })

    it('should throw error when rotating key without initialization', async () => {
      tokenEncryptionService.cleanup()
      await expect(
        tokenEncryptionService.rotateKey('new-password'),
      ).rejects.toThrow('Token encryption service not initialized')
    })

    it('should throw error when key rotation fails', async () => {
      const error = new Error('Scrypt failed')
      // Use a safer approach to mock the error case
      const originalScrypt = mockCrypto.scrypt
      mockCrypto.scrypt.mockImplementationOnce(
        (
          _password: unknown,
          _salt: unknown,
          _keylen: unknown,
          callback: (err: Error | null, derivedKey?: Buffer) => void,
        ) => callback(error),
      )

      await expect(
        tokenEncryptionService.rotateKey('new-password'),
      ).rejects.toThrow('Failed to rotate encryption key')
      expect(mockLogger.error).toHaveBeenCalled()

      // Restore the original mock
      mockCrypto.scrypt = originalScrypt
    })
  })

  describe('cleanup', () => {
    it('should successfully cleanup the service', async () => {
      await tokenEncryptionService.initialize(testPassword)
      tokenEncryptionService.cleanup()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token encryption service cleaned up',
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Real implementation tests: exercise the actual node:crypto AES-256-GCM provider
// (no mocked crypto). These verify genuine encrypt/decrypt round-trips,
// tamper detection, and object serialization — the behavior the mocks above
// cannot prove.
// ---------------------------------------------------------------------------
describe('TokenEncryptionService (real node:crypto AES-256-GCM)', () => {
  const realConfig: TokenEncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    salt: 'a-long-enough-real-salt-for-tests-1234567890',
    password: 'real-test-password',
  }

  const realLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }

  let realService: TokenEncryptionService

  beforeEach(() => {
    vi.clearAllMocks()
    // No cryptoProvider passed -> uses the real defaultCryptoProvider (node:crypto)
    realService = new TokenEncryptionService(
      realConfig,
      realLogger as unknown as Console,
    )
  })

  afterEach(() => {
    realService.cleanup()
    vi.restoreAllMocks()
  })

  it('auto-initializes from the configured password', async () => {
    // Construction already triggered initialization via password; calling
    // encrypt proves the derived key is present and usable.
    const { encryptedToken, iv, authTag } = await realService.encrypt('payload')
    expect(encryptedToken).toBeDefined()
    expect(iv).toBeDefined()
    expect(authTag).toBeDefined()
    expect(realLogger.info).toHaveBeenCalledWith(
      'Token encryption service initialized successfully',
    )
  })

  it('round-trips a string with real AES-256-GCM', async () => {
    const original = 'super-secret-token-value'
    const enc = await realService.encrypt(original)
    const dec = await realService.decrypt<string>(enc)
    expect(dec).toBe(original)
  })

  it('round-trips structured objects via JSON serialization', async () => {
    const payload = { userId: 'u_1', scope: ['read', 'write'], n: 42 }
    const enc = await realService.encrypt(payload)
    const dec = await realService.decrypt<typeof payload>(enc)
    expect(dec).toEqual(payload)
  })

  it('produces a different ciphertext each time (random IV)', async () => {
    const a = await realService.encrypt('same-input')
    const b = await realService.encrypt('same-input')
    expect(a.encryptedToken).not.toBe(b.encryptedToken)
    expect(a.iv).not.toBe(b.iv)
    // but both decrypt back to the same value
    expect(await realService.decrypt<string>(a)).toBe('same-input')
    expect(await realService.decrypt<string>(b)).toBe('same-input')
  })

  it('throws a SecurityError when the auth tag is tampered', async () => {
    const enc = await realService.encrypt('do-not-tamper')
    const tamperedAuthTag = enc.authTag.split('').reverse().join('')
    await expect(
      realService.decrypt({ ...enc, authTag: tamperedAuthTag }),
    ).rejects.toThrow(SecurityError)
  })

  it('throws a SecurityError when the ciphertext is tampered', async () => {
    const enc = await realService.encrypt('integrity-check')
    const buf = Buffer.from(enc.encryptedToken, 'base64')
    buf[0] ^= 0xff
    await expect(
      realService.decrypt({
        ...enc,
        encryptedToken: buf.toString('base64'),
      }),
    ).rejects.toThrow(SecurityError)
  })

  it('supports key rotation and re-encryption with the new key', async () => {
    const before = await realService.encrypt('before-rotation')
    expect(await realService.decrypt<string>(before)).toBe('before-rotation')

    await realService.rotateKey('new-real-password')
    expect(realLogger.info).toHaveBeenCalledWith(
      'Encryption key rotated successfully',
    )

    const after = await realService.encrypt('after-rotation')
    expect(await realService.decrypt<string>(after)).toBe('after-rotation')
  })
})
