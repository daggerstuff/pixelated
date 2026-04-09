// Audit logging types

export enum AuditEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  DATA_ACCESS = 'data_access',
  DATA_MODIFY = 'data_modify',
  DATA_DELETE = 'data_delete',
  BREACH_DETECTED = 'breach_detected',
  BREACH_NOTIFIED = 'breach_notified',
  SYSTEM_ERROR = 'system_error',
  CONFIG_CHANGE = 'config_change',
}

export interface AuditEvent {
  id: string
  eventType: AuditEventType
  timestamp: Date
  userId: string
  resourceId?: string
  resourceType?: string
  action: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

export interface PHIAuditLog {
  id: string
  timestamp: Date
  userId: string
  patientId: string
  action: 'view' | 'create' | 'update' | 'delete' | 'export'
  resourceType: string
  resourceId: string
  ipAddress: string
  sessionDuration?: number
}
