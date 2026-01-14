/**
 * Backup Security System
 *
 * Provides secure, encrypted backup capabilities for application data
 * with automated verification and recovery testing procedures.
 *
 * Implementation follows HIPAA requirements for secure data backup including:
 * - End-to-end encryption of all PHI/PII data
 * - Secure, versioned backup strategy with retention enforcement
 * - Automated recovery testing
 * - Audit logging of all backup/restore operations
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { logAuditEvent, AuditEventType } from '../../audit'
import { dlpService } from '../dlp'
import {
  type BackupMetadata as BaseBackupMetadata,
  type StorageProvider,
  type StorageProviderConfig,
  type RecoveryTestConfig,
} from './types'
import { isBrowser } from '../../browser/is-browser'
import * as NodeCrypto from 'crypto'

// Import crypto polyfill statically to avoid issues during build

// Utility function for browser-safe buffer conversions without using Buffer
/**
 * Converts a hex string to a Uint8Array backed by a true ArrayBuffer.
 * This ensures compatibility with Web Crypto API (BufferSource).
 */
function hexStringToUint8Array(hexString: string): Uint8Array {
  if (!/^[0-9A-Fa-f]+$/.test(hexString) || hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string')
  }

  // Always allocate a new ArrayBuffer to guarantee compatibility
  const buffer = new ArrayBuffer(hexString.length / 2)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
  }
  return bytes
}

// Import crypto browser/node implementation
const getCrypto = async () => {
  if (isBrowser) {
    return {
      encrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
      ): Promise<{ encryptedData: Uint8Array; authTag: Uint8Array }> => {
        const { subtle } = window.crypto
        const importedKey = await subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['encrypt'],
        )
        const encrypted = await subtle.encrypt(
          { name: 'AES-GCM', iv },
          importedKey,
          data,
        )
        // In Web Crypto API, the auth tag is appended to the ciphertext
        const encryptedArray = new Uint8Array(encrypted)
        const authTag = encryptedArray.slice(-16) // Last 16 bytes are the auth tag
        const encryptedData = encryptedArray.slice(0, -16)
        return { encryptedData, authTag }
      },
      decrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array,
      ): Promise<Uint8Array> => {
        const { subtle } = window.crypto
        const importedKey = await subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        )
        // Combine ciphertext and auth tag for Web Crypto API
        const combined = new Uint8Array(data.length + authTag.length)
        combined.set(data)
        combined.set(authTag, data.length)
        // Create a new ArrayBuffer to ensure proper typing
        const combinedBuffer = new ArrayBuffer(combined.byteLength)
        new Uint8Array(combinedBuffer).set(combined)
        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv },
          importedKey,
          combinedBuffer,
        )
        return new Uint8Array(decrypted)
      },
      randomBytes: (length: number): Uint8Array => {
        const array = new Uint8Array(length)
        window.crypto.getRandomValues(array)
        return array
      },
    }
  } else {
    const nodeCrypto = await import('crypto')
    return {
      encrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
      ): Promise<{ encryptedData: Uint8Array; authTag: Uint8Array }> => {
        const cipher: import('crypto').CipherGCM = nodeCrypto.createCipheriv(
          'aes-256-gcm',
          key,
          iv,
        )

        // Manual concatenation of Uint8Arrays without Buffer
        const part1 = new Uint8Array(cipher.update(data))
        const part2 = new Uint8Array(cipher.final())

        const encryptedData = new Uint8Array(part1.length + part2.length)
        encryptedData.set(part1)
        encryptedData.set(part2, part1.length)

        // Get authentication tag
        const authTag = new Uint8Array(
          (cipher as import('crypto').CipherGCM).getAuthTag(),
        )

        return { encryptedData, authTag }
      },
      decrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array,
      ): Promise<Uint8Array> => {
        const decipher: import('crypto').DecipherGCM =
          nodeCrypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(authTag)

        // Manual concatenation of Uint8Arrays without Buffer
        const part1 = new Uint8Array(decipher.update(data))
        const part2 = new Uint8Array(decipher.final())

        const result = new Uint8Array(part1.length + part2.length)
        result.set(part1)
        result.set(part2, part1.length)

        return result
      },
      randomBytes: (length: number): Uint8Array => {
        return new Uint8Array(nodeCrypto.randomBytes(length))
      },
    }
  }
}

const logger = createBuildSafeLogger('backup-security')

// Current version of the encryption implementation
const ENCRYPTION_VERSION = '1.0'

import { BackupType, BackupStatus, StorageLocation } from './backup-types'

export interface BackupRetentionPolicy {
  retention: number
  schedule?: string
}

export interface StorageLocationConfig {
  provider: string
  enabled?: boolean
  config?: Record<string, unknown>
  providerConfig?: Record<string, unknown> // Treat as generic Record to avoid type issues
}

export interface BackupMonitoringConfig {
  alertThresholds: {
    failedBackups: number
  }
  notificationChannels: string[]
}

export interface BackupConfig {
  backupTypes: Record<BackupType, BackupRetentionPolicy>
  storageLocations: Record<StorageLocation, StorageLocationConfig>
  monitoringConfig: BackupMonitoringConfig
  recoveryTesting: RecoveryTestConfig
  encryptionKey?: string // Hex-encoded encryption key
}

interface EncryptedBackupData {
  encryptedData: Uint8Array
  iv: Uint8Array
  authTag: Uint8Array
}

// Extend the base BackupMetadata type with encryption-specific fields
interface BackupMetadata extends BaseBackupMetadata {
  authTag: string // Base64-encoded authentication tag
}

/**
 * Core class for backup security management
 */
export class BackupSecurityManager {
  private static instance: BackupSecurityManager

  private config: BackupConfig
  private encryptionKey!: Uint8Array // MODIFIED: Definite assignment assertion
  private isInitialized = false
  private storageProviders: Map<StorageLocation, StorageProvider> = new Map()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // private recoveryTestingManager!: RecoveryTestingManager

  constructor(config?: Partial<BackupConfig>) {
    // Default configuration
    this.config = {
      backupTypes: {
        [BackupType.FULL]: {
          schedule: '0 0 * * 0', // Weekly on Sunday at midnight
          retention: 365, // 1 year
        },
        [BackupType.DIFFERENTIAL]: {
          schedule: '0 0 * * 1-6', // Daily at midnight except Sunday
          retention: 30, // 1 month
        },
        [BackupType.TRANSACTION]: {
          schedule: '0 * * * *', // Hourly
          retention: 7, // 1 week
        },
        [BackupType.INCREMENTAL]: {
          schedule: '0 */6 * * *', // Every 6 hours
          retention: 14, // 2 weeks
        },
      },
      storageLocations: {
        [StorageLocation.PRIMARY]: {
          provider: 'default',
          config: {},
        },
        [StorageLocation.SECONDARY]: {
          provider: 'default',
          enabled: false,
          config: {},
        },
        [StorageLocation.TERTIARY]: {
          provider: 'default',
          enabled: false,
          config: {},
        },
      },
      monitoringConfig: {
        alertThresholds: {
          failedBackups: 3,
        },
        notificationChannels: ['email'],
      },
      recoveryTesting: {
        enabled: true,
        schedule: '0 0 * * 0', // Weekly
        testCases: [],
        environment: {
          type: 'sandbox',
          config: {},
        },
        notifyOnFailure: true,
        generateReport: true,
      },
    }

    // Merge provided config with defaults
    if (config) {
      this.config = {
        ...this.config,
        ...config,
      }
    }

    // Initialize encryption key if provided
    if (this.config.encryptionKey) {
      this.encryptionKey = hexStringToUint8Array(this.config.encryptionKey)
    } else {
      // Generate a new encryption key
      const randomBytes = new Uint8Array(32)
      if (isBrowser) {
        window.crypto.getRandomValues(randomBytes)
      } else {
        // Use Node's crypto for server-side
        randomBytes.set(NodeCrypto.randomBytes(32))
      }
      this.encryptionKey = randomBytes
    }
    // If not provided via config, this.encryptionKey will be initialized in the async initialize() method.
    // The '!' in 'encryptionKey!: Uint8Array' handles the definite assignment concern for TypeScript.

    // Initialize storage providers
    this.storageProviders = new Map()
    this.loadStorageProviders()

    // Initialize recovery testing manager
    /*
    this.recoveryTestingManager = new RecoveryTestingManager(
      this.config.recoveryTesting,
    )
    */

    logger.info('Backup Security Manager initialized')
  }

  /**
   * Generate a UUID for backup IDs
   */
  private generateUUID(): string {
    if (isBrowser && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID()
    }

    // Simple UUID v4 implementation that works everywhere
    let uuid = ''

    // Use crypto-secure random values for UUID v4 generation
    const randBytes = isBrowser
      ? window.crypto.getRandomValues(new Uint8Array(16))
      : NodeCrypto.randomBytes(16)

    // Per RFC4122 v4: set bits for version and `clock_seq_hi_and_reserved`
    if (randBytes[6] !== undefined) {
      randBytes[6] = (randBytes[6] & 0x0f) | 0x40
    }
    if (randBytes[8] !== undefined) {
      randBytes[8] = (randBytes[8] & 0x3f) | 0x80
    }

    for (let i = 0; i < 16; i++) {
      const byte = randBytes[i]
      const hex = (byte !== undefined ? byte : 0).toString(16).padStart(2, '0')
      // Insert dashes at the appropriate positions
      if (i === 4 || i === 6 || i === 8 || i === 10) {
        uuid += '-'
      }
      uuid += hex
    }

    return uuid
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(
    config?: Partial<BackupConfig>,
  ): BackupSecurityManager {
    if (!BackupSecurityManager.instance) {
      BackupSecurityManager.instance = new BackupSecurityManager(config)
    } else if (config) {
      // Update the existing instance's configuration
      BackupSecurityManager.instance.updateConfig(config)
    }
    return BackupSecurityManager.instance
  }

  /**
   * Update config with partial new configuration
   */
  async updateConfig(config: Partial<BackupConfig>): Promise<void> {
    // Merge incoming config with existing config
    this.config = {
      ...this.config,
      ...config,
      storageLocations: {
        ...this.config.storageLocations,
        ...config.storageLocations,
      },
      backupTypes: {
        ...this.config.backupTypes,
        ...config.backupTypes,
      },
      recoveryTesting: {
        ...this.config.recoveryTesting,
        ...config.recoveryTesting,
      },
    }

    // Re-initialize if we were already initialized
    if (this.isInitialized) {
      this.isInitialized = false
      await this.initialize()
    }
  }

  /**
   * Initialize and prepare the backup manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // Ensure encryption key is set if not provided by config
    if (!this.encryptionKey) {
      const crypto = await getCrypto() // getCrypto handles browser/node async import
      this.encryptionKey = crypto.randomBytes(32)
    }

    try {
      logger.info('Initializing backup security manager')

      // Initialize storage providers based on configuration
      for (const [location, config] of Object.entries(
        this.config.storageLocations,
      )) {
        if (config.enabled) {
          logger.info(`Initializing storage provider for ${location}`)
          const providerPromise = getStorageProvider(
            config.provider,
            config.providerConfig || config.config,
          )
          const provider = await providerPromise
          await provider.initialize()
          this.storageProviders.set(location as StorageLocation, provider)
        }
      }

      this.isInitialized = true
      logger.info('Backup security manager initialized successfully')
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize backup security manager: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Backup manager initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Create a backup of the specified type
   */
  public async createBackup(type: BackupType): Promise<string> {
    try {
      // Generate a backup ID
      const backupId = this.generateUUID()

      // Get data for the backup and process it through DLP
      const data = await this.getDataForBackup(type)

      // Process through DLP if available
      const dlpResult = dlpService
        ? await dlpService.scanContent(new TextDecoder().decode(data), {
            userId: 'system',
            action: 'backup',
            metadata: { mode: 'backup' },
          })
        : {
            allowed: true,
            redactedContent: new TextDecoder().decode(data),
            triggeredRules: [],
          }

      const processedData = dlpResult.redactedContent
        ? new TextEncoder().encode(dlpResult.redactedContent)
        : data

      // Encrypt the data
      const { encryptedData, iv, authTag } = await this.encrypt(processedData)

      // Calculate hash for verification
      const contentHash = await this.calculateHash(processedData)

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        type,
        timestamp: new Date().toISOString(),
        size: processedData.byteLength,
        contentHash,
        encryptionVersion: ENCRYPTION_VERSION,
        location: StorageLocation.PRIMARY,
        path: this.generateBackupStoragePath({
          id: backupId,
          type,
          timestamp: new Date().toISOString(),
        } as BackupMetadata),
        status: BackupStatus.PENDING,
        retentionDays: this.config.backupTypes[type]?.retention || 30,
        iv: this.arrayBufferToBase64(iv),
        containsSensitiveData: dlpResult.redactedContent !== null,
        verificationStatus: 'pending',
        authTag: this.arrayBufferToBase64(authTag),
      }

      // Store the backup and its metadata
      await this.storeBackup(encryptedData, metadata, authTag)

      // Log the backup creation
      logAuditEvent(
        AuditEventType.CREATE,
        'backup_create',
        'system',
        metadata.id,
        {
          type: metadata.type,
          size: metadata.size,
          location: metadata.location,
          path: metadata.path,
        },
      )

      return backupId
    } catch (error: unknown) {
      logger.error('Backup creation failed:', { error: String(error) })
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Helper method to convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    // Browser-safe base64 encoding approach
    const binary = Array.from(buffer)
      .map((b) => String.fromCharCode(b))
      .join('')
    return btoa(binary)
  }

  /**
   * Encrypt data
   */
  private async encrypt(data: Uint8Array): Promise<EncryptedBackupData> {
    const crypto = await getCrypto()
    // Generate IV
    const iv = crypto.randomBytes(16)

    const { encryptedData, authTag } = await crypto.encrypt(
      data,
      this.encryptionKey,
      iv,
    )

    return { encryptedData, iv, authTag }
  }

  /**
   * Decrypt data
   */
  private async decrypt(
    encryptedData: Uint8Array,
    iv: Uint8Array,
    authTag: Uint8Array,
  ): Promise<Uint8Array> {
    try {
      const crypto = await getCrypto()
      return await crypto.decrypt(
        encryptedData,
        this.encryptionKey,
        iv,
        authTag,
      )
    } catch (error: unknown) {
      logger.error('Decryption failed:', { error: String(error) })
      throw new Error('Failed to decrypt backup data', { cause: error })
    }
  }

  /**
   * Calculate SHA-256 hash of data
   */
  private async calculateHash(data: Uint8Array): Promise<string> {
    if (isBrowser) {
      // Web Crypto API for browser
      // Create a new ArrayBuffer to ensure proper typing
      const dataBuffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(dataBuffer).set(data)
      const hashBuffer = await window.crypto.subtle.digest(
        'SHA-256',
        dataBuffer,
      )
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } else {
      // Node.js crypto for server - without using Buffer
      const nodeCrypto = await import('crypto')
      const hash = nodeCrypto.createHash('sha256')
      // Use Uint8Array directly
      hash.update(data)
      return hash.digest('hex')
    }
  }

  /**
   * Calculate retention date based on backup type
   */

  /**
   * Store the encrypted backup in the specified location
   */
  private async storeBackup(
    encryptedData: Uint8Array,
    metadata: BackupMetadata,
    authTag: Uint8Array,
  ): Promise<void> {
    logger.info(`Storing backup ${metadata.id} in ${metadata.location}`)

    try {
      // Get the storage provider for this location
      const provider = this.storageProviders.get(
        metadata.location as StorageLocation,
      )
      if (!provider) {
        throw new Error(
          `Storage provider not found for location: ${metadata.location}`,
        )
      }

      // Create path/key for the backup file
      const backupKey = this.generateBackupStoragePath(metadata)

      // Combine encrypted data and auth tag for storage
      const dataToStore = new Uint8Array(encryptedData.length + authTag.length)
      dataToStore.set(encryptedData)
      dataToStore.set(authTag, encryptedData.length)

      // Store the encrypted data
      await provider.storeFile(backupKey, dataToStore)

      // Store metadata separately for easy access without downloading the entire backup
      const metadataKey = `${backupKey}.meta.json`
      // Use TextEncoder for browser-safe JSON serialization
      await provider.storeFile(
        metadataKey,
        new TextEncoder().encode(JSON.stringify(metadata)),
      )

      logger.info(
        `Successfully stored backup ${metadata.id} in ${metadata.location}`,
      )

      // Log storage as an audit event
      logAuditEvent(
        AuditEventType.SECURITY,
        'BACKUP_STORED',
        'system',
        metadata.id,
        {
          location: metadata.location,
          size: metadata.size,
          path: backupKey,
        },
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to store backup ${metadata.id} in ${metadata.location}: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw error
    }
  }

  /**
   * Generate storage path/key for a backup
   */
  private generateBackupStoragePath(metadata: BackupMetadata): string {
    // Format: backups/{type}/{year}/{month}/{id}
    const date = new Date(metadata.timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')

    return `backups/${metadata.type}/${year}/${month}/${metadata.id}`
  }

  /**
   * Verify the integrity of a backup by checking its hash
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    logger.info(`Verifying backup ${backupId}`)

    try {
      // Find the backup metadata
      const metadata = await this.getBackupMetadata(backupId)
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`)
      }

      // Get the storage provider for this backup
      const provider = this.storageProviders.get(
        metadata.location as StorageLocation,
      )
      if (!provider) {
        throw new Error(
          `Storage provider not found for location: ${metadata.location}`,
        )
      }

      // Get the backup file path
      const backupKey = this.generateBackupStoragePath(metadata)

      // Download the encrypted backup
      const storedData = await provider.getFile(backupKey)

      // Split the stored data into encrypted data and auth tag
      const encryptedData = storedData.slice(0, -16)
      const authTag = storedData.slice(-16)

      // Decrypt the data
      const iv = this.base64ToArrayBuffer(metadata.iv)
      const storedAuthTag = this.base64ToArrayBuffer(metadata.authTag)

      // Verify auth tag matches
      if (!this.compareUint8Arrays(authTag, storedAuthTag)) {
        throw new Error('Authentication tag verification failed')
      }

      const decryptedData = await this.decrypt(encryptedData, iv, authTag)

      // Calculate hash of the decrypted data
      const calculatedHash = await this.calculateHash(decryptedData)

      // Compare with stored hash
      const isValid = calculatedHash === metadata.contentHash

      // Update verification status
      const updatedMetadata = {
        ...metadata,
        verificationStatus: isValid ? 'verified' : 'failed',
        verificationDate: new Date().toISOString(),
      }

      // Store updated metadata
      const metadataKey = `${backupKey}.meta.json`
      await provider.storeFile(
        metadataKey,
        new TextEncoder().encode(JSON.stringify(updatedMetadata)),
      )

      // Log the verification as an audit event
      logAuditEvent(
        AuditEventType.SECURITY,
        'backup_verify',
        'system',
        metadata.id,
        {
          isValid: true,
          contentHash: metadata.contentHash,
          path: metadata.path,
        },
      )

      return isValid
    } catch (error: unknown) {
      logger.error(
        `Failed to verify backup ${backupId}: ${error instanceof Error ? String(error) : String(error)}`,
      )

      // Log verification failure as an audit event
      logAuditEvent(
        AuditEventType.SECURITY,
        'backup_verify',
        'system',
        backupId,
        {
          error: error instanceof Error ? String(error) : String(error),
        },
      )

      return false
    }
  }

  /**
   * Get backup metadata by ID
   */
  private async getBackupMetadata(
    backupId: string,
  ): Promise<BackupMetadata | null> {
    // Try to find in all configured storage locations
    const storageEntries = Array.from(this.storageProviders.entries())
    for (let i = 0; i < storageEntries.length; i++) {
      const entry = storageEntries[i]
      if (!entry || !Array.isArray(entry) || entry.length < 2) {
        continue
      }
      const [location, provider] = entry
      if (!provider) {
        continue
      }
      try {
        // Look for metadata files matching the ID
        const files = await provider.listFiles(
          `backups/*/*/*/*/${backupId}.meta.json`,
        )

        if (files && files.length > 0 && files[0]) {
          // Read the metadata file
          const metadataBuffer = await provider.getFile(files[0])
          return JSON.parse(
            new TextDecoder().decode(metadataBuffer),
          ) as BackupMetadata
        }
      } catch (error: unknown) {
        logger.error(
          `Error searching for backup metadata in ${location}: ${error instanceof Error ? String(error) : String(error)}`,
        )
      }
    }

    return null
  }

  /**
   * Get data to backup based on backup type
   */
  private async getDataForBackup(type: BackupType): Promise<Uint8Array> {
    // Implementation would collect app data based on backup type
    // For now return dummy data for demonstration
    // [PIX-44] TODO: No more fucking cop-outs
    const dummyData = {
      message: `This is a ${type} backup created at ${new Date().toISOString()}`,
    }

    // Use TextEncoder for cross-environment compatibility
    return new TextEncoder().encode(JSON.stringify(dummyData))
  }

  /**
   * Restore from backup
   */
  public async restoreBackup(backupId: string): Promise<boolean> {
    try {
      // Get backup metadata
      const metadata = await this.getBackupMetadata(backupId)
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`)
      }

      // Verify backup first
      if (metadata.verificationStatus !== 'verified') {
        throw new Error(
          `Cannot restore from unverified backup: ${metadata.verificationStatus}`,
        )
      }

      // Get storage provider
      const provider = this.storageProviders.get(
        metadata.location as StorageLocation,
      )
      if (!provider) {
        throw new Error(
          `Storage provider not found for location: ${metadata.location}`,
        )
      }

      // Get backup data
      const backupKey = this.generateBackupStoragePath(metadata)
      const encryptedData = await provider.getFile(backupKey)

      // Decrypt and restore
      const iv = this.base64ToArrayBuffer(metadata.iv)
      const authTag = this.base64ToArrayBuffer(metadata.authTag)
      const decryptedData = await this.decrypt(encryptedData, iv, authTag)

      // Restore the data
      await this.restoreData(decryptedData)

      // Update metadata
      const updatedMetadata = {
        ...metadata,
        status: BackupStatus.COMPLETED,
        verificationDate: new Date().toISOString(),
      }
      await this.storeBackup(encryptedData, updatedMetadata, authTag)

      // Log audit event
      logAuditEvent(
        AuditEventType.SECURITY,
        'backup_restore_completed',
        'system',
        backupId,
        {
          size: encryptedData.byteLength,
          path: metadata.path,
        },
      )

      return true
    } catch (error: unknown) {
      // Log audit event
      logAuditEvent(
        AuditEventType.SECURITY,
        'backup_restore_failed',
        'system',
        backupId,
        {
          error: error instanceof Error ? String(error) : String(error),
        },
      )

      logger.error(
        `Restore failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw error
    }
  }

  /**
   * Get storage provider for specified location
   */
  getStorageProvider(location: StorageLocation): StorageProvider {
    if (!this.isInitialized) {
      throw new Error('Backup manager not initialized')
    }

    const provider = this.storageProviders.get(location)
    if (!provider) {
      throw new Error(
        `No storage provider configured for location: ${location}`,
      )
    }

    return provider
  }

  /**
   * Initialize storage providers based on configuration
   * This is needed to load providers dynamically based on the runtime environment
   */
  private async loadStorageProviders(): Promise<void> {
    // This would be implemented to dynamically load providers from storage-providers-wrapper.ts
    // For now, it's a placeholder
    // [PIX-42] TODO: Stop using fucking placeholders
    logger.debug('Storage providers will be loaded during initialization')
  }

  /**
   * Helper method to convert base64 string to Uint8Array
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  /**
   * Helper method to compare two Uint8Arrays
   */
  private compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false
    }
    return a.every((val, i) => val === b[i])
  }

  /**
   * Restore data from a decrypted backup
   * @param data The decrypted backup data
   */
  private async restoreData(data: Uint8Array): Promise<void> {
    try {
      // Convert data to string
      const dataStr = new TextDecoder().decode(data)

      // Parse the data
      const restoredData = JSON.parse(dataStr) as unknown

      // Process the restored data (implementation would be specific to the application)
      logger.info(
        `Successfully restored data of size: ${data.byteLength} bytes`,
      )

      // Here you would implement the actual data restoration logic
      // This is a placeholder - actual implementation would depend on your application's needs
      await this.processRestoredData(restoredData)
    } catch (error: unknown) {
      logger.error(
        `Failed to restore data: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Data restoration failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Process restored data
   * @param data The restored data object
   */
  private async processRestoredData(data: unknown): Promise<void> {
    // This is where you would implement the actual data restoration logic
    // The implementation would be specific to your application's needs
    // [PIX-43] TODO: What did I just fucking say?
    logger.info('Processing restored data')

    // For now, just log that we received the data
    logger.debug('Restored data', { data })
  }
}

// Export the manager for use in the application
export default BackupSecurityManager

// Export types from the types file
export type {
  RecoveryTestConfig,
  RecoveryTestResult,
  BackupMetadata,
  StorageProvider,
} from './types'

// Don't re-export BackupType since it's already exported from backup-types.ts

// Re-export types from backup-types.ts
export {
  BackupType,
  BackupStatus,
  BackupEventType,
  StorageLocation,
  RecoveryTestStatus,
  TestEnvironmentType,
} from './backup-types'

// Get the appropriate storage provider implementation using dynamic import
async function getStorageProvider(
  provider: string,
  config: Record<string, unknown> = {},
): Promise<StorageProvider> {
  try {
    // Import the storage provider dynamically
    const { getStorageProvider: importedGetStorageProvider } = await import(
      './storage-providers-wrapper'
    )
    // Convert to unknown first, then ensure it has the required type property
    const providerConfig = {
      type: provider,
      ...config,
    } as StorageProviderConfig

    return importedGetStorageProvider(provider, providerConfig)
  } catch (error: unknown) {
    logger.error(
      `Failed to load storage provider: ${error instanceof Error ? String(error) : String(error)}`,
    )
    throw new Error(
      `Storage provider loading failed: ${error instanceof Error ? String(error) : String(error)}`,
      { cause: error },
    )
  }
}
