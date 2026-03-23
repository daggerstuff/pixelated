import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { AuditLogger } from './logger'
import { AuditAction, AuditEventType, AuditSeverity } from './events'

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
      action: String(event.action),
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
