/**
 * Audit Logger Implementation
 *
 * Provides a structured way to log audit events with HIPAA compliance.
 * Integrates with the application's logging and security systems.
 */

import { v4 as uuidv4 } from 'uuid'
import type { Db } from 'mongodb'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { dlpService } from '../security/dlp'
import { mongodb } from '../../config/mongodb.config'
import {
  type AuditEvent,
  AuditAction,
  AuditEventType,
  AuditSeverity,
} from './events'

const logger = createBuildSafeLogger('audit-logger')

function emitVolatileFallback(auditEvent: AuditEvent, reason: string): void {
  logger.warn('Audit Event using volatile fallback', {
    auditId: auditEvent.id,
    reason,
  })
  logger.info('Audit Event (Volatile Fallback)', {
    id: auditEvent.id,
    userId: auditEvent.userId,
    action: auditEvent.action,
    status: auditEvent.status,
    severity: auditEvent.severity,
    type: auditEvent.type,
    metadata: auditEvent.metadata ? '[REDACTED]' : auditEvent.metadata,
    timestamp: auditEvent.timestamp,
  })
}

class AuditPersistenceQueue {
  private pendingJobs = 0

  constructor(private readonly maxPendingJobs = 100) {}

  schedule(auditEvent: AuditEvent, persist: () => Promise<void>): void {
    if (this.pendingJobs >= this.maxPendingJobs) {
      logger.warn('Audit persistence queue saturated, using volatile fallback', {
        auditId: auditEvent.id,
        pendingJobs: this.pendingJobs,
      })
      emitVolatileFallback(auditEvent, 'queue-saturated')
      return
    }

    this.pendingJobs += 1

    persist()
      .catch((error: unknown) => {
        logger.error('CRITICAL: Audit Event Persistence Failed after all retries', {
          auditId: auditEvent.id,
          userId: auditEvent.userId,
          error: error instanceof Error ? error.message : String(error),
        })
        emitVolatileFallback(
          auditEvent,
          error instanceof Error ? error.message : String(error),
        )
      })
      .finally(() => {
        this.pendingJobs = Math.max(0, this.pendingJobs - 1)
      })
  }
}

function sanitizeAuditMetadata(auditEvent: AuditEvent): AuditEvent {
  if (!auditEvent.metadata || !dlpService) {
    return auditEvent
  }

  try {
    const metadataStr = JSON.stringify(auditEvent.metadata)
    const scanResult = dlpService.scanContent(metadataStr, {
      userId: auditEvent.userId,
      action: 'audit_log_sanitize',
      metadata: { auditId: auditEvent.id },
    })

    if (!scanResult.redactedContent) {
      return auditEvent
    }

    if (!looksLikeJsonObject(scanResult.redactedContent)) {
      logger.warn('Failed to parse redacted metadata back to JSON, keeping as string', {
        auditId: auditEvent.id,
        error: 'redacted metadata is not JSON',
      })

      return {
        ...auditEvent,
        metadata: redactMetadataShape(auditEvent.metadata),
      }
    }

    try {
      return {
        ...auditEvent,
        metadata: JSON.parse(scanResult.redactedContent) as Record<string, unknown>,
      }
    } catch (parseError) {
      logger.warn('Failed to parse redacted metadata back to JSON, keeping as string', {
        auditId: auditEvent.id,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })

      return {
        ...auditEvent,
        metadata: redactMetadataShape(auditEvent.metadata),
      }
    }
  } catch (jsonError) {
    logger.error('Failed to stringify metadata for DLP scan', {
      auditId: auditEvent.id,
      error: jsonError instanceof Error ? jsonError.message : String(jsonError),
    })

    return auditEvent
  }
}

function looksLikeJsonObject(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function redactMetadataShape(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactMetadataValue(entry)]),
  )
}

function redactMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactMetadataValue(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactMetadataValue(entry),
      ]),
    )
  }

  return '[REDACTED]'
}

export class AuditLogger {
  private static instance: AuditLogger
  private db: Db | null = null
  private maxRetries = 3
  private readonly persistenceQueue = new AuditPersistenceQueue()

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  /**
   * Ensure database connection is established
   */
  private async ensureConnected(): Promise<Db> {
    if (this.db) return this.db
    this.db = await mongodb.connect()
    return this.db
  }

  /**
   * Log a general audit event
   */
  public async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditEvent = sanitizeAuditMetadata({
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    })

    this.persistenceQueue.schedule(auditEvent, () => this.persistEventWithRetry(auditEvent))

    return auditEvent.id
  }

  public async getUserEvents(
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditEvent[]> {
    const db = await this.ensureConnected()
    const events = await db
      .collection<AuditEvent>('audit_logs')
      .find({ userId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return events.map((event) => ({
      ...event,
      timestamp:
        event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp),
    }))
  }

  /**
   * Persist the event to the database with a simple retry mechanism
   */
  private async persistEventWithRetry(auditEvent: AuditEvent, attempt = 1): Promise<void> {
    try {
      const db = await this.ensureConnected()
      await db.collection('audit_logs').insertOne({
        ...auditEvent,
        timestamp: auditEvent.timestamp instanceof Date ? auditEvent.timestamp : new Date(auditEvent.timestamp)
      })

      logger.info('Audit Event Persisted to Database', {
        auditId: auditEvent.id,
        attempt
      })
    } catch (error: unknown) {
      if (attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        logger.warn(`Audit Log Persistence Attempt ${attempt} Failed. Retrying in ${delay}ms...`, {
          auditId: auditEvent.id,
          error: error instanceof Error ? error.message : String(error)
        })

        await new Promise(resolve => setTimeout(resolve, delay))
        return this.persistEventWithRetry(auditEvent, attempt + 1)
      }

      // If we reach here, retries are exhausted
      throw error
    }
  }

}

/**
 * Convenience utility for logging therapeutic events.
 */
export const logTherapeuticEvent = (
  userId: string,
  action: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
) =>
  AuditLogger.getInstance().logEvent({
    userId,
    type: AuditEventType.THERAPEUTIC,
    action,
    severity: AuditSeverity.INFO,
    resourceId,
    resourceType: 'therapeutic_session',
    metadata,
    status: 'success',
  })

export const logSecurityAlert = (
  userId: string,
  action: AuditAction | string,
  severity: AuditSeverity,
  metadata?: Record<string, unknown>,
  errorMessage?: string,
) =>
  AuditLogger.getInstance().logEvent({
    userId,
    type: AuditEventType.SECURITY,
    action,
    severity,
    metadata,
    status: 'failure',
    errorMessage,
  })
