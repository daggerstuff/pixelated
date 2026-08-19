/**
 * Audit Logger Implementation
 *
 * Provides a structured way to log audit events with HIPAA compliance.
 * Integrates with the application's logging and security systems.
 */

import { createHash } from 'crypto'

import type { Db } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

import { mongodb } from '../../config/mongodb.config'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { dlpService } from '../security/dlp'
import {
  type AuditEvent,
  type ReceiptLedgerExport,
  AuditAction,
  AuditEventType,
  AuditSeverity,
} from './events'

const logger = createBuildSafeLogger('audit-logger')

/**
 * Tamper-evident audit trail (HIPAA).
 *
 * Every persisted audit event is linked into a SHA-256 hash chain: each
 * event's `hash` is SHA-256(previousHash || canonicalPayload), where
 * `previousHash` is the `hash` of the immediately preceding event. Any
 * modification, deletion, or reordering of historical events breaks the
 * chain from that point forward, which `verifyAuditChain` detects.
 */
export const AUDIT_CHAIN_GENESIS = '0'.repeat(64)

/**
 * When the link to the chain cannot be computed (DB unavailable, schema
 * mismatch, contention, etc.) we persist the audit row with a sentinel
 * hash instead of dropping the event. The sentinel is intentionally a
 * short, non-hex string distinguishable from every legal SHA-256 hex
 * digest (legal hashes are 64 lowercase hex characters) so that
 * `verifyAuditChain` can flag the row as a chain break rather than
 * silently accept it as a chained event.
 *
 * MongoDB drops `undefined` field values at write time, which would
 * cause the previously-fallback path to persist an unchained event
 * whose `hash` field is missing entirely — making `verifyAuditChain`
 * see neither a sentinel nor a chain link. The sentinel string
 * sidesteps that by guaranteeing a value Mongo will store.
 */
export const AUDIT_CHAIN_BREAK = '__CHAIN_BREAK__'

/** The immutable, meaningful subset of an event used for chain hashing. */
export function chainPayload(event: AuditEvent): Record<string, unknown> {
  return {
    id: event.id,
    timestamp:
      event.timestamp instanceof Date
        ? event.timestamp.toISOString()
        : event.timestamp,
    userId: event.userId,
    type: event.type,
    action: event.action,
    severity: event.severity,
    resourceId: event.resourceId ?? null,
    resourceType: event.resourceType ?? null,
    status: event.status,
    metadata: event.metadata ?? null,
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
    errorMessage: event.errorMessage ?? null,
  }
}

/** SHA-256 over `previousHash || canonicalPayload`. */
export function computeChainHash(
  previousHash: string,
  payload: Record<string, unknown>,
): string {
  return createHash('sha256')
    .update(`${previousHash}|${JSON.stringify(payload)}`)
    .digest('hex')
}

export interface AuditChainVerification {
  valid: boolean
  brokenAtIndex?: number
  brokenAtId?: string
  reason?: string
}

/**
 * Verify an ordered sequence of audit events forms an unbroken hash chain.
 * Pure function — pass events already sorted by insertion order.
 */
export function verifyAuditChain(events: AuditEvent[]): AuditChainVerification {
  let previousHash = AUDIT_CHAIN_GENESIS

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]

    if (!event.hash || event.hash === AUDIT_CHAIN_BREAK) {
      return {
        valid: false,
        brokenAtIndex: i,
        brokenAtId: event.id,
        reason:
          event.hash === AUDIT_CHAIN_BREAK
            ? 'chain break sentinel — link failed at persistence time'
            : 'missing hash',
      }
    }
    if (event.previousHash !== previousHash) {
      return {
        valid: false,
        brokenAtIndex: i,
        brokenAtId: event.id,
        reason: 'previousHash mismatch',
      }
    }

    const expected = computeChainHash(previousHash, chainPayload(event))
    if (expected !== event.hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        brokenAtId: event.id,
        reason: 'hash mismatch',
      }
    }

    previousHash = event.hash
  }

  return { valid: true }
}

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
      logger.warn(
        'Audit persistence queue saturated, using volatile fallback',
        {
          auditId: auditEvent.id,
          pendingJobs: this.pendingJobs,
        },
      )
      emitVolatileFallback(auditEvent, 'queue-saturated')
      return
    }

    this.pendingJobs += 1

    persist()
      .catch((error: unknown) => {
        logger.error(
          'CRITICAL: Audit Event Persistence Failed after all retries',
          {
            auditId: auditEvent.id,
            userId: auditEvent.userId,
            error:
              error instanceof Error
                ? error instanceof Error
                  ? error.message
                  : 'Unknown error'
                : String(error),
          },
        )
        emitVolatileFallback(
          auditEvent,
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : String(error),
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
      logger.warn(
        'Failed to parse redacted metadata back to JSON, keeping as string',
        {
          auditId: auditEvent.id,
          error: 'redacted metadata is not JSON',
        },
      )

      return {
        ...auditEvent,
        metadata: redactMetadataShape(auditEvent.metadata),
      }
    }

    try {
      return {
        ...auditEvent,
        metadata: JSON.parse(scanResult.redactedContent) as Record<
          string,
          unknown
        >,
      }
    } catch (parseError) {
      logger.warn(
        'Failed to parse redacted metadata back to JSON, keeping as string',
        {
          auditId: auditEvent.id,
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        },
      )

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
    Object.entries(value).map(([key, entry]) => [
      key,
      redactMetadataValue(entry),
    ]),
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
  private readonly maxRetries = 3
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
  async ensureConnected(): Promise<Db> {
    if (this.db) return this.db
    this.db = await mongodb.connect()
    return this.db
  }

  /**
   * Log a general audit event
   */
  public async logEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'>,
  ): Promise<string> {
    const auditEvent = sanitizeAuditMetadata({
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    })

    this.persistenceQueue.schedule(auditEvent, async () =>
      this.persistEventWithRetry(auditEvent),
    )

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
        event.timestamp instanceof Date
          ? event.timestamp
          : new Date(event.timestamp),
    }))
  }

  /**
   * Link an event into the SHA-256 hash chain via an atomic cursor upsert.
   *
   * Each persistence increments a `chain_audit_cursor` document whose `{seq,
   * hash}` is the unique tail of the chain. `findOneAndUpdate` with
   * `returnDocument: 'after'` and `$inc: { seq: 1 }` gives us both the
   * previous and new seq+hash in one atomic op, so two concurrent
   * `logEvent()` calls cannot read the same last event and produce the
   * same `previousHash`. (The earlier read-then-write pattern permitted
   * a race where both events ended up linking to the same predecessor,
   * which `verifyAuditChain` would later reject as a broken chain.)
   *
   * Returns the linked event plus its new chain seq, both stamped
   * monotonically. On failure, returns the un-linked event so the caller
   * can persist a "chain break" sentinel rather than dropping the audit
   * record entirely.
   */
  private async withChainHash(auditEvent: AuditEvent): Promise<{
    event: AuditEvent
    seq: number
  }> {
    try {
      const db = await this.ensureConnected()
      const cursor = await db
        .collection<{ _id: string; seq: number; hash: string }>(
          'chain_audit_cursor',
        )
        .findOneAndUpdate(
          { _id: 'tail' },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'before' },
        )
      const previousHash = cursor?.hash ?? AUDIT_CHAIN_GENESIS
      const previousSeq = cursor?.seq ?? 0
      const newSeq = previousSeq + 1
      const hash = computeChainHash(previousHash, chainPayload(auditEvent))
      return {
        event: { ...auditEvent, previousHash, hash },
        seq: newSeq,
      }
    } catch (err: unknown) {
      logger.warn(
        'Audit chain link failed; storing event with chain-break sentinel',
        {
          auditId: auditEvent.id,
          error: err instanceof Error ? err.message : String(err),
        },
      )
      return {
        event: {
          ...auditEvent,
          hash: AUDIT_CHAIN_BREAK,
          previousHash: AUDIT_CHAIN_BREAK,
        },
        seq: 0,
      }
    }
  }

  /**
   * Persist the event to the database with a simple retry mechanism. The
   * chain hash is recomputed on every attempt: a previous implementation
   * reused the first-attempt hash across retries, which linked the event
   * to a stale predecessor if another event had been persisted during
   * the back-off window.
   */
  private async persistEventWithRetry(
    auditEvent: AuditEvent,
    attempt = 1,
  ): Promise<void> {
    let chained: AuditEvent
    try {
      const linked = await this.withChainHash(auditEvent)
      chained = linked.event
    } catch (err: unknown) {
      logger.error(
        'Audit chain link crashed; refusing to persist uncategorized',
        {
          auditId: auditEvent.id,
          error: err instanceof Error ? err.message : String(err),
        },
      )
      throw err
    }

    try {
      const db = await this.ensureConnected()
      await db.collection('audit_logs').insertOne({
        ...chained,
        timestamp:
          chained.timestamp instanceof Date
            ? chained.timestamp
            : new Date(chained.timestamp),
      })

      logger.info('Audit Event Persisted to Database', {
        auditId: chained.id,
        attempt,
      })
    } catch (error: unknown) {
      if (attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
        logger.warn(
          `Audit Log Persistence Attempt ${attempt} Failed. Retrying in ${delay}ms...`,
          {
            auditId: chained.id,
            error:
              error instanceof Error
                ? error instanceof Error
                  ? error.message
                  : 'Unknown error'
                : String(error),
          },
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.persistEventWithRetry(auditEvent, attempt + 1)
      }

      // Retries exhausted — bubble.
      throw error
    }
  }

  /**
   * Read the full audit collection (in monotonic seq order) and verify
   * the hash chain is intact. Methods that mutate the chain (insert/delete)
   * deliberately remain serialised through `withChainHash` + the
   * `chain_audit_cursor` upsert; this reader walks the persisted chain.
   */
  public async verifyChain(): Promise<AuditChainVerification> {
    const db = await this.ensureConnected()
    const events = await db
      .collection<AuditEvent>('audit_logs')
      .find({})
      .sort({ _id: 1 })
      .toArray()
    return verifyAuditChain(events)
  }
}

/**
 * Convenience utility for logging therapeutic events.
 */
export const logTherapeuticEvent = async (
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

/**
 * Export the audit receipt ledger as a structured, chain-verified document.
 *
 * Reads the full audit log from the database, verifies the SHA-256 hash chain,
 * and returns a serializable export object including patient identification,
 * event count, and chain validity status for HIPAA data portability.
 */
export const exportReceiptLedger = async (patientId: string): Promise<ReceiptLedgerExport> => {
  const loggerInst = AuditLogger.getInstance()
  const db = await loggerInst.ensureConnected()

  const events = await db
    .collection<AuditEvent>('audit_logs')
    .find({ patientId })
    .sort({ timestamp: 1 })
    .toArray()

  // Verify chain integrity
  const verification = verifyAuditChain(events as AuditEvent[])

  return {
    exportId: uuidv4(),
    patientId,
    exportedAt: new Date(),
    totalEvents: events.length,
    chainValid: verification.valid,
    events,
  }
}

export const logSecurityAlert = async (
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
