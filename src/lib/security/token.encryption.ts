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
}

export class TokenEncryptionService {
  private readonly config: TokenEncryptionConfig
  private readonly logger: Console
  private encryptionKey: Buffer | null = null

  constructor(
    config: TokenEncryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      salt: process.env['TOKEN_ENCRYPTION_SALT'] || '',
    },
    logger: Console = console,
  ) {
    this.config = config
    this.logger = logger

    if (!this.config.salt) {
      throw new SecurityError('Token encryption salt is required')
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

  async encryptToken(
    token: string,
  ): Promise<{ encryptedToken: string; iv: string }> {
    if (!this.encryptionKey) {
      throw new SecurityError('Token encryption service not initialized')
    }

    try {
      const iv = randomBytes(this.config.ivLength)
      const cipher = createCipheriv(
        this.config.algorithm,
        this.encryptionKey,
        iv,
      )

      const encryptedToken = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final(),
      ])

      const authTag = (
        cipher as unknown as { getAuthTag(): Buffer }
      ).getAuthTag()

      return {
        encryptedToken: Buffer.concat([encryptedToken, authTag]).toString(
          'base64',
        ),
        iv: iv.toString('base64'),
      }
    } catch (error: unknown) {
      this.logger.error('Failed to encrypt token:', error)
      throw new SecurityError('Failed to encrypt token')
    }
  }

  async decryptToken(encryptedToken: string, iv: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new SecurityError('Token encryption service not initialized')
    }

    try {
      const decipher = createDecipheriv(
        this.config.algorithm,
        this.encryptionKey,
        Buffer.from(iv, 'base64'),
      )

      const encryptedData = Buffer.from(encryptedToken, 'base64')
      const authTag = encryptedData.slice(-16)
      const encryptedContent = encryptedData.slice(0, -16)

      ;(decipher as unknown as { setAuthTag(tag: Buffer): void }).setAuthTag(
        authTag,
      )

      const decryptedToken = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ])

      return decryptedToken.toString('utf8')
    } catch (error: unknown) {
      this.logger.error('Failed to decrypt token:', error)
      throw new SecurityError('Failed to decrypt token')
    }
  }

  async rotateKey(newPassword: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new SecurityError('Token encryption service not initialized')
    }

    try {
      const newKey = await scryptAsync(
        newPassword,
        this.config.salt,
        this.config.keyLength,
      )

      this.encryptionKey = Buffer.from(newKey as Buffer)

      this.logger.info('Encryption key rotated successfully')
    } catch (error: unknown) {
      this.logger.error('Failed to rotate encryption key:', error)
      throw new SecurityError('Failed to rotate encryption key')
    }
  }

  cleanup() {
    this.encryptionKey = null
    this.logger.info('Token encryption service cleaned up')
  }
}
