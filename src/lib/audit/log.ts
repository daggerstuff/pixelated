import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { AuditAction, AuditEventType, AuditSeverity } from './events'
import { AuditLogger } from './logger'

const logger = createBuildSafeLogger('audit-log')

// Define the structure for the audit log entry
// (Keeping for backward compatibility with existing imports)
export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: {
    id: string
    type: string | undefined
  }
  metadata: Record<string, unknown>
  timestamp: Date
}

/**
 * Get user audit logs (Forwarding to new system)
 */
export async function getUserAuditLogs(
  userId: string,
  limit = 100,
  offset = 0,
): Promise<AuditLogEntry[]> {
  try {
    logger.info('Getting user audit logs', { userId, limit, offset })

    const events = await AuditLogger.getInstance().getUserEvents(
      userId,
      limit,
      offset,
    )

    return events.map((event) => ({
      id: event.id,
      userId: event.userId,
      action: event.action,
      resource: {
        id: event.resourceId ?? '',
        type: event.resourceType,
      },
      metadata: event.metadata ?? {},
      timestamp: event.timestamp,
    }))
  } catch (error: unknown) {
    logger.error('Error getting user audit logs:', error)
    return []
  }
}

/**
 * Log an audit event (Integrated with AuditLogger)
 *
 * NOTE: This helper delegates to `AuditLogger.logEvent`, which queues
 * persistence through `AuditPersistenceQueue`. The returned promise
 * resolves *as soon as the event is queued*, not when persistence has
 * succeeded or failed. Callers that require a durable write before
 * reporting success (compliance material) should call `AuditLogger` and
 * `AuditPersistenceQueue` directly and await the underlying `insertOne`.
 * For best-effort audit (the common case), this fire-and-forget semantics
 * is acceptable; the queue applies retries with exponential back-off and
 * surfaces final failures as a "volatile fallback" log line.
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceId: string,
  resourceType?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await AuditLogger.getInstance().logEvent(
    toLegacyAuditEvent(userId, action, resourceId, resourceType, metadata),
  )
}

/**
 * Create an audit log entry (alias for logAuditEvent)
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resourceId: string,
  resourceType?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logAuditEvent(userId, action, resourceId, resourceType, metadata)
}

/**
 * Create a resource audit log entry
 */
export async function createResourceAuditLog(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logAuditEvent(userId, action, resourceId, resourceType, metadata)
}

/**
 * Log a governance compliance decision (allow/deny) as an audit event.
 *
 * This makes the data-governance -> audit trail integration real (previously
 * it only existed as a pattern inside the audit-integration test mock). The
 * decision is recorded with an explicit `GOVERNANCE_ALLOW` / `GOVERNANCE_DENY`
 * event type so governance outcomes are distinguishable in the audit log.
 */
export async function logGovernanceDecision(
  userId: string,
  resourceId: string,
  allowed: boolean,
  options?: {
    operation?: string
    reasons?: string[]
    resourceType?: string
  },
): Promise<void> {
  await AuditLogger.getInstance().logEvent({
    userId,
    type: allowed
      ? AuditEventType.GOVERNANCE_ALLOW
      : AuditEventType.GOVERNANCE_DENY,
    action: 'governance_validation',
    severity: AuditSeverity.INFO,
    resourceId,
    resourceType: options?.resourceType ?? 'governance',
    status: allowed ? 'success' : 'failure',
    metadata: {
      operation: options?.operation,
      reasons: options?.reasons ?? [],
    },
  })
}

function toLegacyAuditEvent(
  userId: string,
  action: string,
  resourceId: string,
  resourceType?: string,
  metadata?: Record<string, unknown>,
) {
  return {
    userId,
    action,
    resourceId,
    resourceType,
    metadata,
    severity: AuditSeverity.INFO,
    type: inferAuditEventType(action),
    status: 'success' as const,
  }
}

function inferAuditEventType(action: string): AuditEventType {
  switch (action) {
    case AuditAction.LOGIN:
    case AuditAction.LOGOUT:
    case AuditAction.PASSWORD_CHANGE:
    case AuditAction.PERMISSIONS_MODIFIED:
    case AuditAction.THREAT_DETECTED:
      return AuditEventType.SECURITY
    case AuditAction.BACKUP_CREATED:
    case AuditAction.RESTORE_INITIATED:
      return AuditEventType.SYSTEM
    case AuditAction.VIEW_PATIENT:
    case AuditAction.UPDATE_PATIENT:
    case AuditAction.START_SESSION:
    case AuditAction.END_SESSION:
      return AuditEventType.THERAPEUTIC
    default:
      return AuditEventType.THERAPEUTIC
  }
}
