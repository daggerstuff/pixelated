/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock getRandomBytes: real impl only checks window.crypto (undefined in Node);
// use globalThis.crypto.getRandomValues instead (available in Node 19+).
vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils')
  return {
    ...actual,
    getRandomBytes: (size: number): Uint8Array => {
      const bytes = new Uint8Array(size)
      globalThis.crypto.getRandomValues(bytes)
      return bytes
    },
  }
})

// Test fixture, not a credential — keeps this file independent of .env.
const TEST_ENCRYPTION_KEY = 'a'.repeat(32)
const TEST_SECRET_KEY = 'test-secret-key-for-hmac-signing'

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.stubEnv('ENCRYPTION_KEY', TEST_ENCRYPTION_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('security.ts facade', () => {
  describe('SecurityError', () => {
    it('should create error with default code and no details', async () => {
      const { SecurityError } = await import('../security')
      const error = new SecurityError('test message')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(SecurityError)
      expect(error.message).toBe('test message')
      expect(error.code).toBe('SECURITY_ERROR')
      expect(error.name).toBe('SecurityError')
      expect(error.details).toBeUndefined()
    })

    it('should create error with custom code and details', async () => {
      const { SecurityError } = await import('../security')
      const details = { reason: 'test', context: { userId: '123' } }
      const error = new SecurityError('test', 'CUSTOM_CODE', details)
      expect(error.code).toBe('CUSTOM_CODE')
      expect(error.details).toEqual(details)
    })
  })

  describe('setSecretKey', () => {
    it('should set secret key in server environment', async () => {
      const { setSecretKey, requireSecretKey } = await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      expect(requireSecretKey()).toBe(TEST_SECRET_KEY)
    })

    it('should trim whitespace from secret key', async () => {
      const { setSecretKey, requireSecretKey } = await import('../security')
      setSecretKey(`  ${TEST_SECRET_KEY}  `)
      expect(requireSecretKey()).toBe(TEST_SECRET_KEY)
    })

    it('should warn and not set key in browser environment', async () => {
      vi.stubGlobal('window', {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      delete process.env['SECRET_KEY']
      delete process.env['JWT_SECRET']

      const { setSecretKey, requireSecretKey } = await import('../security')
      setSecretKey(TEST_SECRET_KEY)

      expect(warnSpy.mock.calls.flat().join(' ')).toContain(
        'Attempted to set secret key in browser',
      )
      // requireSecretKey should throw because key was not set in browser
      expect(() => requireSecretKey()).toThrow(/SECRET_KEY is missing/)

      warnSpy.mockRestore()
    })
  })

  describe('requireSecretKey', () => {
    it('should return secret key from SECRET_KEY environment variable', async () => {
      vi.stubEnv('SECRET_KEY', TEST_SECRET_KEY)
      const { requireSecretKey } = await import('../security')
      expect(requireSecretKey()).toBe(TEST_SECRET_KEY)
    })

    it('should fall back to JWT_SECRET when SECRET_KEY is not set', async () => {
      vi.stubEnv('JWT_SECRET', TEST_SECRET_KEY)
      const { requireSecretKey } = await import('../security')
      expect(requireSecretKey()).toBe(TEST_SECRET_KEY)
    })

    it('should prefer SECRET_KEY over JWT_SECRET', async () => {
      vi.stubEnv('SECRET_KEY', 'primary-key')
      vi.stubEnv('JWT_SECRET', 'fallback-key')
      const { requireSecretKey } = await import('../security')
      expect(requireSecretKey()).toBe('primary-key')
    })

    it('should throw SecurityError with UNINITIALIZED_SECRET_KEY code when no key is available', async () => {
      delete process.env['SECRET_KEY']
      delete process.env['JWT_SECRET']
      const { requireSecretKey, SecurityError } = await import('../security')
      expect(() => requireSecretKey()).toThrow(SecurityError)
      try {
        requireSecretKey()
      } catch (err) {
        expect(err).toBeInstanceOf(SecurityError)
        expect((err as InstanceType<typeof SecurityError>).code).toBe(
          'UNINITIALIZED_SECRET_KEY',
        )
        expect((err as InstanceType<typeof SecurityError>).message).toContain(
          'SECRET_KEY is missing',
        )
      }
    })
  })

  describe('createSignature', () => {
    it('should create HMAC-SHA256 signature for string payload', async () => {
      const { createSignature, setSecretKey } = await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const sig = createSignature('hello world')
      expect(sig).toBeTypeOf('string')
      expect(sig.length).toBeGreaterThan(0)
      // Base64-encoded HMAC-SHA256 is 44 chars
      expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    it('should create deterministic signature for object payload (JSON-serialized)', async () => {
      const { createSignature, setSecretKey } = await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const payload = { userId: '123', role: 'admin' }
      const sig1 = createSignature(payload)
      const sig2 = createSignature({ ...payload })
      expect(sig1).toBe(sig2)
    })

    it('should create different signatures for different payloads', async () => {
      const { createSignature, setSecretKey } = await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      expect(createSignature('a')).not.toBe(createSignature('b'))
    })

    it('should create different signatures with different keys', async () => {
      const { createSignature, setSecretKey } = await import('../security')
      setSecretKey('key-one')
      const sigA = createSignature('payload')
      setSecretKey('key-two')
      const sigB = createSignature('payload')
      expect(sigA).not.toBe(sigB)
    })
  })

  describe('verifySignature', () => {
    it('should return true for valid signature', async () => {
      const { createSignature, verifySignature, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const sig = createSignature('hello')
      expect(verifySignature('hello', sig)).toBe(true)
    })

    it('should return false for invalid signature', async () => {
      const { createSignature, verifySignature, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const sig = createSignature('hello')
      expect(verifySignature('world', sig)).toBe(false)
    })

    it('should return false when no secret key is configured (propagates error)', async () => {
      const { verifySignature } = await import('../security')
      // No setSecretKey, no env var — requireSecretKey will throw inside
      // createSignature, which is caught by verifySignature's try/catch
      expect(verifySignature('hello', 'any-signature')).toBe(false)
    })
  })

  describe('generateSecureSessionKey', () => {
    it('should return a 64-character hex string (32 bytes)', async () => {
      const { generateSecureSessionKey } = await import('../security')
      const key = generateSecureSessionKey()
      expect(key).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should return unique keys on each call', async () => {
      const { generateSecureSessionKey } = await import('../security')
      const key1 = generateSecureSessionKey()
      const key2 = generateSecureSessionKey()
      expect(key1).not.toBe(key2)
    })
  })

  describe('encryptSensitiveData / decryptSensitiveData', () => {
    it('should encrypt and decrypt a string round-trip', async () => {
      const { encryptSensitiveData, decryptSensitiveData } =
        await import('../security')
      const plaintext = 'sensitive patient data'
      const encrypted = await encryptSensitiveData(plaintext)
      expect(encrypted).toBeTypeOf('string')
      expect(encrypted).not.toBe(plaintext)
      const decrypted = await decryptSensitiveData(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce a JSON-serialized envelope with iv, data, tag, salt', async () => {
      const { encryptSensitiveData } = await import('../security')
      const encrypted = await encryptSensitiveData('test')
      const parsed = JSON.parse(encrypted)
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('data')
      expect(parsed).toHaveProperty('tag')
      expect(parsed).toHaveProperty('salt')
    })
  })

  describe('createSecureToken / verifySecureToken', () => {
    it('should create and verify a token with payload', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ userId: '123', role: 'admin' }, 3600)
      const payload = verifySecureToken(result) as {
        userId: string
        role: string
      } | null
      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe('123')
      expect(payload?.role).toBe('admin')
    })

    it('should include iat and exp claims with correct expiration', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ foo: 'bar' }, 120)
      const payload = verifySecureToken(result) as {
        foo: string
        iat: number
        exp: number
      } | null
      expect(payload).not.toBeNull()
      expect(payload).toHaveProperty('iat')
      expect(payload).toHaveProperty('exp')
      expect(payload!.exp - payload!.iat).toBe(120)
    })

    it('should return null for expired token', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ foo: 'bar' }, -10) // already expired
      expect(verifySecureToken(result)).toBeNull()
    })

    it('should return null for malformed token (wrong number of parts)', async () => {
      const { verifySecureToken } = await import('../security')
      expect(verifySecureToken('no-dots-here')).toBeNull()
      expect(verifySecureToken('only.two.parts.extra')).toBeNull()
    })

    it('should return null for tampered signature', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ foo: 'bar' }, 3600)
      // Flip the last character of the signature
      const tampered = result.slice(0, -1) + (result.endsWith('A') ? 'B' : 'A')
      expect(verifySecureToken(tampered)).toBeNull()
    })

    it('should return null for tampered payload', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ foo: 'bar' }, 3600)
      // Flip a character in the payload portion (before the dot)
      const [payload, sig] = result.split('.') as [string, string]
      const tamperedPayload =
        payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A')
      expect(verifySecureToken(`${tamperedPayload}.${sig}`)).toBeNull()
    })

    it('should use default expiration of 3600 seconds when not specified', async () => {
      const { createSecureToken, verifySecureToken, setSecretKey } =
        await import('../security')
      setSecretKey(TEST_SECRET_KEY)
      const result = createSecureToken({ foo: 'bar' })
      const payload = verifySecureToken(result) as {
        foo: string
        iat: number
        exp: number
      } | null
      expect(payload).not.toBeNull()
      expect(payload!.exp - payload!.iat).toBe(3600)
    })
  })
})
