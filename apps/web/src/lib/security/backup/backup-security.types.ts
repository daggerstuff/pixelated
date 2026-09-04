/**
 * Backup security types — extracted from backup/index.ts.
 */

import type { BackupType, StorageLocation } from './backup-types'
import type {
  BackupMetadata as BaseBackupMetadata,
  RecoveryTestConfig,
} from './types'

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

export interface EncryptedBackupData {
  encryptedData: Uint8Array
  iv: Uint8Array
  authTag: Uint8Array
}

// Extend the base BackupMetadata type with encryption-specific fields
export interface BackupMetadata extends BaseBackupMetadata {
  authTag: string // Base64-encoded authentication tag
}

export interface RestoreResult {
  modelsProcessed: number
  documentsRestored: number
  models: Record<string, { restored: number; errors: number }>
}

export interface BackupDataPayload {
  timestamp: string
  type: string
  data: Record<string, Record<string, unknown>[]>
}

/**
 * Core class for backup security management
 */
