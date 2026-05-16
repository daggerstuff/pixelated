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
}
