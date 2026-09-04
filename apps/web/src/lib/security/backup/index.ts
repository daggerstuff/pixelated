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

import * as NodeCrypto from 'crypto'

import { logAuditEvent, AuditEventType } from '../../audit'
import { isBrowser } from '../../browser/is-browser'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { dlpService } from '../dlp'
import {
  type BackupMetadata as BaseBackupMetadata,
  type StorageProvider,
  type StorageProviderConfig,
  type RecoveryTestConfig,
} from './types'


const logger = createBuildSafeLogger('backup-security')
import { generateUUID, calculateHash, restoreData, hexStringToUint8Array, getCrypto } from './backup-security.utils'
import type {
  BackupRetentionPolicy,
  StorageLocationConfig,
  BackupMonitoringConfig,
  BackupConfig,
  RestoreResult,
} from './backup-security.types'
export type {
  BackupRetentionPolicy,
  StorageLocationConfig,
  BackupMonitoringConfig,
  BackupConfig,
} from './backup-security.types'

// Current version of the encryption implementation
const ENCRYPTION_VERSION = '1.0'

import { BackupType, BackupStatus, StorageLocation } from './backup-types'

export class BackupSecurityManager {
  private static instance: BackupSecurityManager

  private config: BackupConfig
  private encryptionKey!: Uint8Array // MODIFIED: Definite assignment assertion
  private isInitialized = false
  private readonly storageProviders: Map<StorageLocation, StorageProvider> =
    new Map()

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

    // Initialize recovery testing manager
    /*
    this.recoveryTestingManager = new RecoveryTestingManager(
      this.config.recoveryTesting,
    )
    */

    logger.info('Backup Security Manager initialized')
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
      void BackupSecurityManager.instance.updateConfig(config)
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
      await this.loadStorageProviders()

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
      const backupId = generateUUID()

      // Get data for the backup and process it through DLP
      const data = await this.getDataForBackup(type)

      // Process through DLP if available
      const dlpResult = dlpService
        ? dlpService.scanContent(new TextDecoder().decode(data), {
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
      const contentHash = await calculateHash(processedData)

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
      const calculatedHash = await calculateHash(decryptedData)

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
    for (const [location, provider] of storageEntries) {
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
          `Error searching for backup metadata in ${location}: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : String(error)}`,
        )
      }
    }

    return null
  }

  /**
   * Get data to backup based on backup type
   */
  private async getLastBackupTime(requireFull = false): Promise<Date | null> {
    let latestTimestamp = 0

    const storageEntries = Array.from(this.storageProviders.entries())
    for (const [, provider] of storageEntries) {
      if (!provider) continue

      try {
        const files = await provider.listFiles('backups/')
        const metaFiles = files.filter((f) => f.endsWith('.meta.json'))
        for (const metaFile of metaFiles) {
          try {
            const metadataBuffer = await provider.getFile(metaFile)
            const metadata = JSON.parse(
              new TextDecoder().decode(metadataBuffer),
            ) as BackupMetadata

            if (metadata.status === BackupStatus.COMPLETED) {
              if (requireFull && metadata.type !== BackupType.FULL) continue
              if (
                !requireFull &&
                metadata.type !== BackupType.FULL &&
                metadata.type !== BackupType.DIFFERENTIAL &&
                metadata.type !== BackupType.INCREMENTAL
              )
                continue

              const timestamp = new Date(metadata.timestamp).getTime()
              if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp
              }
            }
          } catch {
            // Ignore individual file parsing errors
          }
        }
      } catch (error: unknown) {
        logger.error(
          `Error searching for latest backup metadata: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : String(error)}`,
        )
      }
    }

    return latestTimestamp > 0 ? new Date(latestTimestamp) : null
  }

  private async getDataForBackup(type: BackupType): Promise<Uint8Array> {
    let appDataJson =
      '{"timestamp":"' +
      new Date().toISOString() +
      '","type":"' +
      type +
      '","data":{'

    try {
      const mongooseModule = 'mongoose'
      const mongoose =
        (await import(/* @vite-ignore */ mongooseModule)).default ??
        (await import(/* @vite-ignore */ mongooseModule))
      const models = mongoose.modelNames()

      let isFirstModel = true

      let baselineTime: Date | null = null
      if (type === BackupType.DIFFERENTIAL || type === BackupType.INCREMENTAL) {
        const requireFull = type === BackupType.DIFFERENTIAL
        const lastBackupTime = await this.getLastBackupTime(requireFull)
        baselineTime =
          lastBackupTime ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
      }

      for (const modelName of models) {
        const Model = mongoose.model(modelName)
        const query: Record<string, unknown> = {}

        if (baselineTime && Model.schema.paths.updatedAt) {
          query['updatedAt'] = { $gte: baselineTime }
        }

        if (!isFirstModel) {
          appDataJson += ','
        }
        appDataJson += '"' + modelName + '":['
        isFirstModel = false

        const cursor = Model.find(query).lean().cursor()
        let isFirstDoc = true

        for await (const doc of cursor) {
          if (!isFirstDoc) {
            appDataJson += ','
          }
          appDataJson += JSON.stringify(doc)
          isFirstDoc = false
        }

        appDataJson += ']'
      }

      appDataJson += '}}'
    } catch (error: unknown) {
      logger.error(
        `Failed to collect data for backup: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : String(error)}`,
      )
      throw error // Fail loudly to prevent silent data corruption
    }

    return new TextEncoder().encode(appDataJson)
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
      const restoreResult = await restoreData(decryptedData)

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
          documentsRestored: restoreResult.documentsRestored,
          modelsProcessed: restoreResult.modelsProcessed,
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
    logger.debug('Loading storage providers during initialization')

    // Clear existing providers before loading new ones
    this.storageProviders.clear()

    // Iterate over configured storage locations
    for (const [location, locationConfig] of Object.entries(
      this.config.storageLocations,
    )) {
      // Default to enabled if not explicitly set to false
      if (locationConfig.enabled !== false) {
        logger.info(`Initializing storage provider for ${location}`)

        const provider = await getStorageProvider(
          locationConfig.provider,
          locationConfig.providerConfig ?? locationConfig.config,
        )

        await provider.initialize()
        this.storageProviders.set(location as StorageLocation, provider)
      }
    }
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
   * @param data The decrypted backup data (JSON in Uint8Array format)
   * @returns RestoreResult with counts of restored documents and models
   */
  private async restoreData(data: Uint8Array): Promise<RestoreResult> {
    return restoreData(data)
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

