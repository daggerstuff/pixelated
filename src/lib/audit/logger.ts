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
  AuditEventType, 
  AuditSeverity,
  AuditAction 
} from './events'

const logger = createBuildSafeLogger('audit-logger')

export class AuditLogger {
  private static instance: AuditLogger
  private db: Db | null = null
  private maxRetries = 3

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
    const auditEvent: AuditEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    }

    // Sanitize metadata using DLP service if present
    if (auditEvent.metadata && dlpService) {
      try {
        const metadataStr = JSON.stringify(auditEvent.metadata)
        const scanResult = dlpService.scanContent(metadataStr, {
          userId: auditEvent.userId,
          action: 'audit_log_sanitize',
          metadata: { auditId: auditEvent.id }
        })
        
        if (scanResult.redactedContent) {
          try {
            auditEvent.metadata = JSON.parse(scanResult.redactedContent)
          } catch (parseError) {
            logger.warn('Failed to parse redacted metadata back to JSON, keeping as string', { 
              auditId: auditEvent.id,
              error: parseError instanceof Error ? parseError.message : String(parseError)
            })
            // Fallback: keep metadata as the redacted string if parsing fails
            auditEvent.metadata = { _raw_redacted: scanResult.redactedContent } as any
          }
        }
      } catch (jsonError) {
        logger.error('Failed to stringify metadata for DLP scan', { 
          auditId: auditEvent.id,
          error: jsonError instanceof Error ? jsonError.message : String(jsonError)
        })
      }
    }

    // Persist to MongoDB in the background to avoid latency
    this.persistEventWithRetry(auditEvent).catch(error => {
      // Final catch for the entire retry chain
      logger.error('CRITICAL: Audit Event Persistence Failed after all retries', {
        auditId: auditEvent.id,
        userId: auditEvent.userId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Volatile log fallback
      logger.info('Audit Event (Volatile Fallback)', {
        ...auditEvent,
        metadata: auditEvent.metadata ? '[REDACTED]' : auditEvent.metadata,
      })
    })

    return auditEvent.id
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

  /**
   * Log a therapeutic interaction event
   */
  public async logTherapeuticEvent(
    userId: string,
    action: string,
    resourceId?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logEvent({
      userId,
      type: AuditEventType.THERAPEUTIC,
      action,
      severity: AuditSeverity.INFO,
      resourceId,
      resourceType: 'therapeutic_session',
      metadata,
      status: 'success'
    })
  }

  /**
   * Log a security alert
   */
  public async logSecurityAlert(
    userId: string,
    action: AuditAction | string,
    severity: AuditSeverity,
    metadata?: Record<string, unknown>,
    errorMessage?: string
  ): Promise<string> {
    return this.logEvent({
      userId,
      type: AuditEventType.SECURITY,
      action,
      severity,
      metadata,
      status: 'failure',
      errorMessage
    })
  }
}

/**
 * Convinience utility for logging therapeutic events
 */
export const logTherapeuticEvent = (
  userId: string, 
  action: string, 
  resourceId?: string, 
  metadata?: Record<string, unknown>
) => AuditLogger.getInstance().logTherapeuticEvent(userId, action, resourceId, metadata)
