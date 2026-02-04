/**
 * Type definitions for the backup security system
 */

// Import types from backup-types.ts to avoid duplication
import type {
  BackupStatus,
  RecoveryTestStatus,
  VerificationMethod,
} from './backup-types'
import { BackupType } from './backup-types'

// Import MongoDB types for ApplicationBackupData
import type {
  User,
  Session,
  Todo,
  AIMetrics,
  BiasDetection,
  TreatmentPlan,
  CrisisSessionFlag,
  ConsentManagement,
} from '../../../types/mongodb.types'

// Only export types needed by this file, not re-export from backup-types.ts
// to avoid duplicate exports

/**
 * Interface for application backup data
 */
export interface ApplicationBackupData {
  users: User[]
  sessions: Session[]
  todos: Todo[]
  aiMetrics: AIMetrics[]
  biasDetections: BiasDetection[]
  treatmentPlans: TreatmentPlan[]
  crisisSessionFlags: CrisisSessionFlag[]
  consentManagements: ConsentManagement[]
}

/**
 * Interface for backup metadata
 */
export interface BackupMetadata {
  id: string
  type: BackupType
  timestamp: string
  size: number
  contentHash: string
  encryptionVersion: string
  location: string
  path: string
  status: BackupStatus
  retentionDays: number
  iv: string
  containsSensitiveData?: boolean
  verificationStatus?: string
  verificationDate?: string
}

/**
 * Interface for backup reports
 */
export interface BackupReport {
  id: string
  generatedAt: string
  reportPeriod: {
    start: string
    end: string
  }
  summary: {
    totalBackups: number
    successfulBackups: number
    failedBackups: number
    averageBackupSize: number
    totalStorageUsed: number
    backupsByType: Record<string, number>
  }
  verificationSummary: {
    totalVerifications: number
    successfulVerifications: number
    failedVerifications: number
  }
  recoveryTestSummary: {
    totalTests: number
    successfulTests: number
    failedTests: number
    averageRecoveryTime: number
  }
  retentionSummary: {
    backupsExpired: number
    backupsDeleted: number
    storageReclaimed: number
  }
  complianceStatus: {
    compliant: boolean
    issues: Array<{
      issueType: string
      description: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      remediation: string
    }>
  }
}

/**
 * Interface for storage provider configuration
 */
export interface StorageProviderConfig {
  type: string
  credentials?: {
    [key: string]: string
  }
  region?: string
  bucket?: string
  container?: string
  endpoint?: string
  path?: string
  options?: Record<string, unknown>
}

/**
 * Interface for storage provider operations
 */
export interface StorageProvider {
  /**
   * Initialize the storage provider
   */
  initialize(): Promise<void>

  /**
   * List files matching a pattern
   */
  listFiles(pattern?: string): Promise<string[]>

  /**
   * Store a file
   */
  storeFile(key: string, data: Uint8Array): Promise<void>

  /**
   * Get a file
   */
  getFile(key: string): Promise<Uint8Array>

  /**
   * Delete a file
   */
  deleteFile(key: string): Promise<void>
}

/**
 * Recovery testing configuration
 */
export interface RecoveryTestConfig {
  enabled?: boolean
  schedule: string // Cron expression for automatic testing
  environment: {
    type: 'docker' | 'vm' | 'kubernetes' | 'sandbox'
    config: Record<string, unknown>
  }
  testCases: Array<{
    name: string
    description: string
    backupType: string
    dataVerification: Array<{
      type: VerificationMethod
      target: string
      expected?: string | number | boolean
      query?: string
      threshold?: number
    }>
  }>
  notifyOnFailure: boolean
  generateReport: boolean
}

/**
 * Recovery test result
 */
export interface RecoveryTestResult {
  id: string
  testDate: string
  backupId: string
  environment: string
  status: RecoveryTestStatus
  timeTaken: number // milliseconds
  verificationResults: Array<{
    testCase: string
    passed: boolean
    details: Record<string, unknown>
  }>
  issues?: Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
  report?: string // URL or path to detailed report
}

export { BackupType }
