/**
 * Audit Event Types and Severities
 *
 * This file defines the core enums and interfaces for the HIPAA-compliant
 * audit trail system.
 */

/**
 * High-level categories for audit events
 */
export enum AuditEventType {
  ACCESS = 'access',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SECURITY = 'security',
  THERAPEUTIC = 'therapeutic',
  SYSTEM = 'system',
  GOVERNANCE_ALLOW = 'governance_allow',
  GOVERNANCE_DENY = 'governance_deny',
  RECEIPT_LEDGER = 'receipt_ledger',
}

/**
 * Severity levels for audit events
 */
export enum AuditSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Actions performed by users or the system
 */
export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  VIEW_PATIENT = 'view_patient',
  UPDATE_PATIENT = 'update_patient',
  START_SESSION = 'start_session',
  END_SESSION = 'end_session',
  DELETE_DATA = 'delete_data',
  PASSWORD_CHANGE = 'password_change',
  PERMISSIONS_MODIFIED = 'permissions_modified',
  BACKUP_CREATED = 'backup_created',
  RESTORE_INITIATED = 'restore_initiated',
  THREAT_DETECTED = 'threat_detected',
}

/**
 * Standard interface for an audit event
 */
export interface AuditEvent {
  id: string
  timestamp: Date
  userId: string
  type: AuditEventType
  action: AuditAction | string
  severity: AuditSeverity
  resourceId?: string
  resourceType?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure'
  errorMessage?: string
  /**
   * SHA-256 hash-chain linkage.
   *
   * `previousHash` is the `hash` of the immediately preceding audit event
   * written to the chain; `hash` is the SHA-256 over the **exact** string
   * `previousHash || "|" || JSON.stringify(chainPayload(event))`.
   *
   * The contract — explicitly documenting the delimiter and serialization:
   *
   * - Delimiter: a single `"|"` byte between `previousHash` and the payload.
   * - Payload serialization: `JSON.stringify(chainPayload(event))` —
   *   the `chainPayload` helper returns a canonical subset (id, timestamp,
   *   userId, type, action, severity, resourceId, resourceType, status,
   *   metadata, ipAddress, userAgent, errorMessage).
   * - Hash algorithm: SHA-256, hex digest.
   *
   * Independent verifiers MUST replicate this exact serialization to
   * reproduce our chain hashes; see `verifyAuditChain` in `logger.ts`.
   *
   * Absent (undefined) for pre-chain legacy events or events that failed
   * to link atomically. `verifyAuditChain` reports these as
   * `reason: 'missing hash'` so the chain break is detectable.
   */
  previousHash?: string
  hash?: string
}

/**
 * Receipt ledger export.
 *
 * A structured export of audit events from the hash-chain audit trail,
 * including chain validity verification, patient identification, and
 * event count for HIPAA-compliant data portability.
 */
export interface ReceiptLedgerExport {
  exportId: string
  patientId: string
  exportedAt: Date
  totalEvents: number
  chainValid: boolean
  events: AuditEvent[]
}
