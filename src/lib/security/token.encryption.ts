import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
} from 'node:crypto'
import { promisify } from 'node:util'

import { SecurityError } from './errors/security.error'

const scryptAsync = promisify(scrypt)

export interface TokenEncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  salt: string
  authTagLength?: number
  password?: string
}

export class TokenEncryptionService {
  private readonly config: TokenEncryptionConfig
  private readonly logger: Console
  private encryptionKey: Buffer | null = null
  private initializationPromise: Promise<void> | null = null

  constructor(
    config: TokenEncryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      salt: process.env['TOKEN_ENCRYPTION_SALT'] || '',
      password: process.env['TOKEN_ENCRYPTION_PASSWORD'],
    },
    logger: Console = console,
  ) {
    this.config = config
    this.logger = logger

    if (!this.config.salt || this.config.salt.length < 16) {
      throw new SecurityError('Token encryption salt is required and must be at least 16 characters long')
    }

    // Try to auto-initialize if password is provided
    if (this.config.password) {
      this.initializationPromise = this.initialize(this.config.password)
    }
  }

  async initialize(password: string): Promise<void> {
    try {
      this.encryptionKey = (await scryptAsync(
        password,
        this.config.salt,
        this.config.keyLength,
      )) as Buffer
      this.logger.info('Token encryption service initialized successfully')
    } catch (error: unknown) {
      this.logger.error('Failed to initialize token encryption service:', error)
      throw new SecurityError('Failed to initialize token encryption service')
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.encryptionKey) return

    if (!this.initializationPromise) {
      const password = this.config.password || process.env['TOKEN_ENCRYPTION_PASSWORD']
      if (password) {
        this.initializationPromise = this.initialize(password)
      } else {
        throw new SecurityError('Token encryption service not initialized and no password available')
      }
    }

    await this.initializationPromise
  }

  async encrypt(data: any): Promise<{ encryptedToken: string; iv: string; authTag: string }> {
    this.logger.debug('Encrypting data')
    await this.ensureInitialized()
    const serializedData = typeof data === 'string' ? data : JSON.stringify(data)
    return await this.encryptToken(serializedData)
  }

  async decrypt<T>(result: { encryptedToken: string; iv: string; authTag: string }): Promise<T> {
    this.logger.debug('Decrypting token')
    await this.ensureInitialized()
    const decrypted = await this.decryptToken(
      result.encryptedToken,
      result.iv,
      result.authTag,
    )
    try {
      return JSON.parse(decrypted) as T
    } catch {
      return decrypted as unknown as T
    }
  }

  async encryptToken(
    token: string,
  ): Promise<{ encryptedToken: string; iv: string; authTag: string }> {
    await this.ensureInitialized()

    try {
      const iv = randomBytes(this.config.ivLength)
      const cipher = createCipheriv(
        this.config.algorithm,
        this.encryptionKey!,
        iv,
      )

      const encryptedBuffer = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final(),
      ])

      const authTag = (
        cipher as unknown as { getAuthTag(): Buffer }
      ).getAuthTag()

      const configuredTagLength = this.config.authTagLength || 16
      if (authTag.length !== configuredTagLength) {
        throw new SecurityError(`Authentication tag length mismatch: expected ${configuredTagLength}, got ${authTag.length}`)
      }

      return {
        encryptedToken: encryptedBuffer.toString('base64'),
        authTag: authTag.toString('base64'),
        iv: iv.toString('base64'),
      }
    } catch (error: unknown) {
      this.logger.error('Failed to encrypt token:', error)
      throw new SecurityError('Failed to encrypt token')
    }
  }

  async decryptToken(encryptedToken: string, iv: string, authTag: string): Promise<string> {
    await this.ensureInitialized()

    try {
      const decipher = createDecipheriv(
        this.config.algorithm,
        this.encryptionKey!,
        Buffer.from(iv, 'base64'),
      )

      const authTagBuffer = Buffer.from(authTag, 'base64')
      const tagLength = this.config.authTagLength || 16
      
      if (authTagBuffer.length !== tagLength) {
        throw new SecurityError(`Invalid authentication tag length: expected ${tagLength}, got ${authTagBuffer.length}`)
      }

      ;(decipher as unknown as { setAuthTag(tag: Buffer): void }).setAuthTag(
        authTagBuffer,
      )

      const decryptedToken = Buffer.concat([
        decipher.update(Buffer.from(encryptedToken, 'base64')),
        decipher.final(),
      ])

      return decryptedToken.toString('utf8')
    } catch (error: unknown) {
      this.logger.error('Failed to decrypt token:', error)
      if (error instanceof SecurityError) throw error
      throw new SecurityError('Failed to decrypt token')
    }
  }

  async rotateKey(newPassword: string): Promise<void> {
    await this.ensureInitialized()

    try {
      const newKey = await scryptAsync(
        newPassword,
        this.config.salt,
        this.config.keyLength,
      )

      this.encryptionKey = Buffer.from(newKey as Buffer)
      this.initializationPromise = Promise.resolve()

      this.logger.info('Encryption key rotated successfully')
    } catch (error: unknown) {
      this.logger.error('Failed to rotate encryption key:', error)
      throw new SecurityError('Failed to rotate encryption key')
    }
  }

  cleanup() {
    this.encryptionKey = null
    this.initializationPromise = null
    this.logger.info('Token encryption service cleaned up')
  }
}
