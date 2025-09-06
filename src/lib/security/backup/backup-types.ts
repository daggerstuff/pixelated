// Shared backup types and enums for both client and server

export enum BackupType {
  FULL = 'full',
  DIFFERENTIAL = 'differential',
  TRANSACTION = 'transaction',
  INCREMENTAL = 'incremental',
}

export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VERIFIED = 'verified',
  VERIFICATION_FAILED = 'verification_failed',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

export enum RecoveryTestStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
}

export enum BackupEventType {
  BACKUP_SYSTEM_INITIALIZED = 'BACKUP_SYSTEM_INITIALIZED',
  BACKUP_SYSTEM_CONFIGURATION_CHANGED = 'BACKUP_SYSTEM_CONFIGURATION_CHANGED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  BACKUP_VERIFIED = 'BACKUP_VERIFIED',
  BACKUP_VERIFICATION_FAILED = 'BACKUP_VERIFICATION_FAILED',
  BACKUP_RESTORE_STARTED = 'BACKUP_RESTORE_STARTED',
  BACKUP_RESTORE_COMPLETED = 'BACKUP_RESTORE_COMPLETED',
  BACKUP_RESTORE_FAILED = 'BACKUP_RESTORE_FAILED',
  BACKUP_RECOVERY_TEST = 'BACKUP_RECOVERY_TEST',
  BACKUP_RECOVERY_TEST_FAILED = 'BACKUP_RECOVERY_TEST_FAILED',
  BACKUP_RETENTION_ENFORCED = 'BACKUP_RETENTION_ENFORCED',
  BACKUP_RETENTION_ENFORCEMENT_FAILED = 'BACKUP_RETENTION_ENFORCEMENT_FAILED',
  BACKUP_DELETED = 'BACKUP_DELETED',
  BACKUP_ARCHIVED = 'BACKUP_ARCHIVED',
}

export enum StorageLocation {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
}

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

export interface StorageProviderConfig {
  type: string
  credentials?: { [key: string]: string }
  region?: string
  bucket?: string
  container?: string
  endpoint?: string
  path?: string
  options?: Record<string, unknown>
}

export interface RecoveryTestConfig {
  enabled?: boolean
  schedule: string
  environment: {
    type: 'docker' | 'vm' | 'kubernetes' | 'sandbox'
    config: Record<string, unknown>
  }
  testCases: Array<{
    name: string
    description: string
    backupType: string
    dataVerification: Array<{
      type: 'hash' | 'query' | 'content'
      target: string
      expected?: string | number | boolean
    }>
  }>
  notifyOnFailure: boolean
  generateReport: boolean
}

export interface RecoveryTestResult {
  id: string
  testDate: string
  backupId: string
  environment: string
  status: RecoveryTestStatus
  timeTaken: number
  verificationResults: Array<{
    testCase: string
    passed: boolean
    details: Record<string, unknown>
  }>
  issues?: Array<{
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
  report?: string
}

export enum TestEnvironmentType {
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  VM = 'vm',
  SANDBOX = 'sandbox',
}

export enum VerificationMethod {
  HASH = 'hash',
  QUERY = 'query',
  CONTENT = 'content',
  API = 'api',
}

export interface TestCase {
  id: string
  name: string
  description: string
  backupType: string
  verificationSteps: VerificationStep[]
}

export interface VerificationStep {
  id: string
  type: VerificationMethod
  target: string
  expected?: string | number | boolean
  query?: string
  threshold?: number
}
