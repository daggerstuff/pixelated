import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { AuditLogger } from './logger'
import { AuditAction } from './events'

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
    
    // TODO: Implement retrieval in AuditLogger
    // For now, return empty array as the underlying persistence is not yet complete
    return []
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
  const auditLogger = AuditLogger.getInstance()
  
  await auditLogger.logEvent({
    userId,
    action,
    resourceId,
    resourceType,
    metadata,
    severity: 'info' as any, // Default to info for legacy calls
    type: 'therapeutic' as any, // Default for legacy therapeutic logs
    status: 'success'
  })
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
