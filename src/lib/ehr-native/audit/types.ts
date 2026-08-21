/**
 * EHR-specific audit types for the FHIR R4 audit bridge.
 *
 * Extends the existing HIPAA audit infrastructure in `src/lib/audit/` with
 * FHIR-specific context (resourceType, resourceId, fhirVersion, action).
 *
 * @see src/lib/audit.ts for AuditLogEntry, AuditEventType, AuditEventStatus
 * @see src/lib/audit/events.ts for AuditEvent, AuditEventType (chain), AuditSeverity
 */

import type { FHIRResourceType } from '../fhir/types.js'

/**
 * Context that flows through the FHIR audit pipeline.
 *
 * Derived from FHIRRequestContext plus HTTP request metadata (IP, UA, session)
 * that the FHIR server extracts from incoming headers.
 */
export interface EhrAuditContext {
  userId: string
  tenantId: string
  role: string
  breakGlass: boolean
  breakGlassReason?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/**
 * EHR audit action mapped from FHIR operations.
 *
 * Maps to AuditEventType in both enum systems:
 * - create → AuditEventType.CREATE (both enums)
 * - update → AuditEventType.MODIFY (audit.ts) / AuditEventType.UPDATE (events.ts)
 * - delete → AuditEventType.DELETE (both enums)
 * - read   → AuditEventType.ACCESS (both enums)
 */
export type EhrAuditAction = 'create' | 'update' | 'delete' | 'read' | 'break-glass'

/**
 * Result of an audit operation.
 */
export interface EhrAuditResult {
  success: boolean
  auditLogId?: string
  chainEventId?: string
  error?: string
}

/**
 * Break-glass audit entry for break-glass access events.
 *
 * Extends the RBAC break-glass flow (F1.5) with FHIR-specific context.
 * The RBAC system already logs break-glass activation; this entry adds
 * the FHIR resource context (resourceType, resourceId) to the audit trail.
 */
export interface BreakGlassAuditEntry {
  resourceType: FHIRResourceType
  resourceId: string
  userId: string
  role: string
  tenantId: string
  reason: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}
