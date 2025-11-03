/**
 * Common types for backup and recovery systems
 */

// export type StorageProvider = typeof StorageProvider

/**
 * Type of backup being performed
 */
export enum BackupType {
  FULL = 'full',
  DIFFERENTIAL = 'differential',
  INCREMENTAL = 'incremental',
  TRANSACTION = 'transaction',
}

/**
 * Status of a backup
 */
export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELETED = 'deleted',
}

/**
 * Location where a backup is stored
 */
export enum StorageLocation {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
}

/**
 * Events related to backups
 */
export enum BackupEventType {
  BACKUP_CREATED = 'backup_created',
  BACKUP_DELETED = 'backup_deleted',
  BACKUP_RESTORED = 'backup_restored',
  BACKUP_VERIFIED = 'backup_verified',
}

/**
 * Status of a recovery test
 */
export enum RecoveryTestStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Types of environments for recovery testing
 */
export enum TestEnvironmentType {
  SANDBOX = 'sandbox',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  VM = 'vm',
}

/**
 * Type of verification method for data integrity
 */
export enum VerificationMethod {
  HASH = 'hash',
  QUERY = 'query',
  CONTENT = 'content',
  API = 'api',
}

/**
 * Metadata for a single backup
 */
export interface BackupMetadata {
  id: string
  type: BackupType
  timestamp: string
  size: number
  contentHash: string
  encryptionVersion: string
  location: StorageLocation
  path: string
  status: BackupStatus
  retentionDays: number
  iv: string
  containsSensitiveData: boolean
  verificationStatus: 'pending' | 'verified' | 'failed'
  verificationDate?: string
}

/**
 * Configuration for a storage provider
 */
export interface StorageProviderConfig {
  type: string
  [key: string]: unknown
}

/**
 * Interface for storage providers
 */
export interface IStorageProvider {
  initialize(): Promise<void>
  listFiles(pattern?: string): Promise<string[]>
  storeFile(key: string, data: Uint8Array): Promise<void>
  getFile(key: string): Promise<Uint8Array>
  deleteFile(key: string): Promise<void>
}
export { type IStorageProvider as StorageProvider }

/**
 * Configuration for recovery testing
 */
export interface RecoveryTestConfig {
  enabled: boolean
  schedule: string
  testCases: unknown[]
  environment: {
    type: TestEnvironmentType
    config: Record<string, unknown>
  }
  notifyOnFailure: boolean
  generateReport: boolean
}

/**
 * Result of a single recovery test
 */
export interface RecoveryTestResult {
  id: string
  testDate: string
  backupId: string
  environment: TestEnvironmentType
  status: RecoveryTestStatus
  timeTaken: number // in milliseconds
  verificationResults: Array<{
    testCase: string
    passed: boolean
    details: Record<string, unknown>
  }>
  report?: string
  issues?: Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
}

/**
 * Verification step for a test case
 */
export interface VerificationStep {
  id: string
  type: VerificationMethod
  target: string
  expected?: string | number | boolean
  query?: string
  threshold?: number
}

/**
 * Test case for data verification
 */
export interface TestCase {
  id: string
  name: string
  description: string
  backupType: string
  verificationSteps: VerificationStep[]
}
