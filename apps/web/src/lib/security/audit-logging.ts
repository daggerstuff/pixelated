/**
 * Audit logging wrapper for the threat intelligence network
 * Adapts the object-style auditLog() calls to the centralized AuditLogger API
 */

import { logAuditEvent } from '../audit/log'

export interface AuditLogParams {
  action: string
  resource: string
  details?: Record<string, unknown>
  userId: string
  ip: string
}

/**
 * Log an audit event from the threat intelligence network
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  const { action, resource, details, userId } = params

  await logAuditEvent(userId, action, resource, 'threat_intelligence', details)
}
