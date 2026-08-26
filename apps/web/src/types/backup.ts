/**
 * Shared type definitions for backup and recovery system
 */

// Recovery test status
export type RecoveryTestStatus = 'passed' | 'failed' | 'warning' | 'pending'

// Verification result for recovery tests
export interface VerificationResult {
  testCase: string
  passed: boolean
  details: Record<string, unknown>
  id?: string
  status?: 'critical' | 'high' | 'medium' | 'low'
  description?: string
}

// Recovery test result
export interface RecoveryTestResult {
  backupId: string
  testDate: string
  status: RecoveryTestStatus
  timeTaken: number
  environment: string
  verificationResults?: VerificationResult[]
}

// Backup metadata
export interface BackupMetadata {
  id: string
  name: string
  createdAt: string
  size: number
  type: 'full' | 'incremental' | 'differential'
  status: 'completed' | 'failed' | 'in_progress'
  verified: boolean
  location: string
}
