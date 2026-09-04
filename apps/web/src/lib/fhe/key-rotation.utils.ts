/**
 * Key rotation helpers — type guards, security constants, and pure/field
 * operations extracted from key-rotation.ts.
 */

import crypto from 'crypto'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { KeyManagementOptions, TFHEKeyPair } from './types'
import type {
  AwsListSecretsResponse,
  AwsSecretValue,
  AwsCloudWatchClient,
  AuditEvent,
  DistributedLock,
  KeyVersion,
} from './key-rotation.types'

const logger = createBuildSafeLogger('hipaa-fhe-rotation')
const auditLogger = createBuildSafeLogger('hipaa-audit')

export const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}


export const isAwsListSecretsResponse = (
  value: unknown,
): value is AwsListSecretsResponse => {
  if (!isObjectRecord(value)) {
    return false
  }

  if (value['SecretList'] !== undefined) {
    if (!Array.isArray(value['SecretList'])) {
      return false
    }
  }

  if (value['NextToken'] !== undefined) {
    return typeof value['NextToken'] === 'string'
  }

  return true
}


export const isAwsSecretValue = (value: unknown): value is AwsSecretValue => {
  if (!isObjectRecord(value)) {
    return false
  }

  if (value['SecretString'] === undefined) {
    return true
  }

  return typeof value['SecretString'] === 'string'
}


export const isProd = (): boolean =>
  process.env['NODE_ENV']?.toLowerCase() === 'production'

/**
 * HIPAA++ Default Configuration
 */
export const HIPAA_DEFAULT_OPTIONS: KeyManagementOptions = {
  rotationPeriodDays: 7, // Weekly rotation for HIPAA++
  persistKeys: true,
  storagePrefix: 'hipaa_fhe_key_',
}

export const SECURITY_CONSTANTS = {
  MAX_KEY_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  LOCK_TIMEOUT_MS: 30 * 1000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  AUDIT_RETENTION_DAYS: 2555, // 7 years for HIPAA
  KEY_DERIVATION_ITERATIONS: 100000,
  SECURE_RANDOM_BYTES: 32,
} as const

export function generateSecureId(): string {
  return crypto
    .randomBytes(SECURITY_CONSTANTS.SECURE_RANDOM_BYTES)
    .toString('hex')
}

export async function deriveEncryptionKey(): Promise<Buffer> {
  const masterSecret = process.env['HIPAA_MASTER_SECRET']
  if (!masterSecret) {
    throw new Error('HIPAA_MASTER_SECRET environment variable is required')
  }

  const salt = crypto.randomBytes(32)
  return crypto.pbkdf2Sync(
    masterSecret,
    salt,
    SECURITY_CONSTANTS.KEY_DERIVATION_ITERATIONS,
    32,
    'sha512',
  )
}

export function exponentialBackoff(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000)
}

export function generateKeyId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `key_${timestamp}_${random}`
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function parseKeyPair(value: string): TFHEKeyPair | null {
  const parsed: unknown = JSON.parse(value)
  if (!isObjectRecord(parsed)) {
    return null
  }

  const id = parsed['id']
  const publicKey = parsed['publicKey']
  const privateKeyEncrypted = parsed['privateKeyEncrypted']
  const created = parsed['created']
  const expires = parsed['expires']
  const version = parsed['version']

  if (
    typeof id !== 'string' ||
    typeof publicKey !== 'string' ||
    typeof privateKeyEncrypted !== 'string' ||
    typeof created !== 'number' ||
    typeof expires !== 'number' ||
    typeof version !== 'string'
  ) {
    return null
  }

  return {
    id,
    publicKey,
    privateKeyEncrypted,
    created,
    expires,
    version,
  }
}

export async function triggerSecurityAlarm(
  cloudWatch: AwsCloudWatchClient | null,
  alarmType: string,
  details: string,
): Promise<void> {
  if (!cloudWatch) {
    return
  }

  try {
    await cloudWatch
      .putMetricData({
        Namespace: 'HIPAA/FHE/Security',
        MetricData: [
          {
            MetricName: alarmType,
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [{ Name: 'Details', Value: details }],
          },
        ],
      })
      .promise()
  } catch (error: unknown) {
    logger.error('Failed to trigger security alarm', { alarmType, error })
  }
}

export function filterAuditEvents(
  auditEvents: AuditEvent[],
  since?: Date,
): AuditEvent[] {
  if (!since) {
    return [...auditEvents]
  }

  const sinceTime = since.getTime()
  return auditEvents.filter(
    (event) => new Date(event.timestamp).getTime() >= sinceTime,
  )
}

export function releaseLock(
  distributedLocks: Map<string, DistributedLock>,
  auditLog: (action: string, details: Partial<AuditEvent>) => void,
  operation: string,
): void {
  distributedLocks.delete(operation)
  auditLog('lock_released', {
    success: true,
    details: { operation },
    riskLevel: 'low',
  })
}

export function scheduleClientRotationCheck(
  keyRotationTimers: Map<string, NodeJS.Timeout>,
  rotateKeys: () => Promise<string>,
  keyId: string,
  expiryTime: number,
): void {
  // In the client, we check daily if the key needs rotation
  const checkInterval = 24 * 60 * 60 * 1000 // 24 hours

  const timer = setInterval(() => {
    const now = Date.now()
    if (now >= expiryTime) {
      rotateKeys().catch((err) => {
        logger.error(`Failed to rotate key ${keyId}`, {
          error: getErrorMessage(err),
        })
      })

      // Clear the interval after rotation
      clearInterval(timer)
      keyRotationTimers.delete(keyId)
    }
  }, checkInterval)

  keyRotationTimers.set(keyId, timer)
}

export async function deprecateOldKeys(
  keyVersions: Map<string, KeyVersion>,
  auditLog: (action: string, details: Partial<AuditEvent>) => void,
  securelyDestroyKey: (keyId: string) => Promise<void>,
  newKeyId: string,
): Promise<void> {
  for (const [keyId, version] of keyVersions.entries()) {
    if (keyId !== newKeyId && version.status === 'active') {
      version.status = 'deprecated'
      version.deprecated = Date.now()

      auditLog('key_deprecated', {
        success: true,
        keyId,
        details: { newKeyId },
        riskLevel: 'medium',
      })

      // Schedule secure destruction after migration period
      setTimeout(
        () => {
          securelyDestroyKey(keyId).catch((err) => {
            logger.error('Failed to destroy deprecated key', {
              keyId,
              error: getErrorMessage(err),
            })
          })
        },
        24 * 60 * 60 * 1000,
      ) // 24 hours
    }
  }
}

export function auditLog(
  auditEvents: AuditEvent[],
  emit: (event: string, payload: AuditEvent) => boolean,
  action: string,
  details: Partial<AuditEvent>,
): void {
  const event: AuditEvent = {
    eventId: generateSecureId(),
    timestamp: new Date().toISOString(),
    action,
    userId: details.userId ?? 'system',
    ipAddress: details.ipAddress ?? 'internal',
    success: details.success ?? true,
    details: details.details ?? {},
    riskLevel: details.riskLevel ?? 'low',
    ...(details.keyId && { keyId: details.keyId }),
  }

  auditEvents.push(event)
  auditLogger.info('HIPAA Audit Event', { ...event })

  // Emit high-risk events immediately
  if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
    emit('security-alert', event)
  }
}
