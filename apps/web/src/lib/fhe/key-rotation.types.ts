/**
 * Key rotation types — extracted from key-rotation.ts.
 */

export interface AuditEvent {
  eventId: string
  timestamp: string
  action: string
  keyId?: string
  userId?: string
  ipAddress?: string
  success: boolean
  details: Record<string, unknown>
  metadata?: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}


export interface SecurityMetrics {
  rotationAttempts: number
  rotationFailures: number
  unauthorizedAccess: number
  keyCompromiseEvents: number
  lastRotation: number
  averageRotationTime: number
}


export interface DistributedLock {
  lockId: string
  nodeId: string
  expiresAt: number
  operation: string
}


export type AwsRequest<T> = {
  promise(): Promise<T>
}


export type AwsKmsClient = {
  generateDataKey: (params: Record<string, unknown>) => AwsRequest<unknown>
  decrypt: (params: Record<string, unknown>) => AwsRequest<unknown>
}


export type AwsSecretsManagerClient = {
  createSecret: (params: Record<string, unknown>) => AwsRequest<unknown>
  rotateSecret: (params: Record<string, unknown>) => AwsRequest<unknown>
  listSecrets: (params: AwsListSecretsRequest) => AwsRequest<unknown>
  getSecretValue: (params: Record<string, unknown>) => AwsRequest<unknown>
}


export type AwsCloudWatchClient = {
  putMetricData: (params: Record<string, unknown>) => AwsRequest<unknown>
}


export type AwsSecretListEntry = {
  Name?: string
  [key: string]: unknown
}


export type AwsListSecretsRequest = {
  Filters?: Array<{
    Key: string
    Values: string[]
  }>
  NextToken?: string
}


export type AwsListSecretsResponse = {
  SecretList?: AwsSecretListEntry[]
  NextToken?: string
}


export type AwsSecretValue = {
  SecretString?: string
}


export interface KeyVersion {
  version: number
  keyId: string
  created: number
  deprecated?: number
  status: 'active' | 'deprecated' | 'compromised' | 'destroyed'
  migrationStatus?: 'pending' | 'in_progress' | 'completed'
}

// Enhanced logging with audit trail
