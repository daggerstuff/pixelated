/**
 * FHIR Audit Middleware — pre/post write hooks for FHIR CRUD operations.
 *
 * These hooks are called by the FHIR CRUD functions (crud.ts) at each
 * operation boundary:
 *
 * - preWriteAudit:  logs access attempt before a write operation
 * - postWriteAudit: logs write success after persistence + history
 * - postWriteFailureAudit: logs write failure with error details
 * - readAudit: logs read access after a successful read
 *
 * Each hook constructs an EhrAuditContext from the FHIRRequestContext
 * and delegates to the audit bridge (ehr-audit-bridge.ts).
 */

import type { FHIRRequestContext, FHIRResourceType } from '../fhir/types.js'
import type { EhrAuditAction, EhrAuditContext, EhrAuditResult } from './types.js'
import {
  auditFHIRCreate,
  auditFHIRDelete,
  auditFHIRFailure,
  auditFHIRRead,
  auditFHIRUpdate,
} from './ehr-audit-bridge.js'

/**
 * Extract EhrAuditContext from FHIRRequestContext.
 *
 * IP, User-Agent, and session ID come from jwtClaims if available,
 * since FHIRRequestContext doesn't carry them directly.
 */
export function buildEhrAuditContext(
  context: FHIRRequestContext,
  ipAddress?: string,
  userAgent?: string,
  sessionId?: string,
): EhrAuditContext {
  const claims = context.jwtClaims
  return {
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    breakGlass: context.breakGlass,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(typeof claims['breakGlassReason'] === 'string'
      ? { breakGlassReason: claims['breakGlassReason'] }
      : {}),
  }
}

/**
 * Pre-write audit hook: logs an access attempt before a write operation.
 *
 * Called before the write pipeline (validation → persist → history) begins.
 * Uses AuditEventStatus.ATTEMPT to indicate an attempted but not-yet-completed
 * operation.
 */
export async function preWriteAudit(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
): Promise<EhrAuditResult> {
  // Import here to avoid circular dependency at module load time
  const { auditFHIREvent } = await import('./ehr-audit-bridge.js')
  const { AuditEventStatus } = await import('@/lib/audit')
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    action,
    AuditEventStatus.ATTEMPT,
  )
}

/**
 * Post-write audit hook: logs write success after persistence + history.
 *
 * Dispatches to the correct audit function based on the action type.
 */
export async function postWriteAudit(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  version?: string,
): Promise<EhrAuditResult> {
  switch (action) {
    case 'create':
      return auditFHIRCreate(ctx, resourceType, resourceId, version)
    case 'update':
      return auditFHIRUpdate(ctx, resourceType, resourceId, version)
    case 'delete':
      return auditFHIRDelete(ctx, resourceType, resourceId)
    case 'read':
      return auditFHIRRead(ctx, resourceType, resourceId)
    case 'break-glass':
      return auditFHIRRead(ctx, resourceType, resourceId)
    default: {
      const exhaustive: never = action
      void exhaustive
      throw new Error('Unhandled EhrAuditAction')
    }
  }
}

/**
 * Post-write failure audit hook: logs write failure with error details.
 */
export async function postWriteFailureAudit(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  errorMessage: string,
): Promise<EhrAuditResult> {
  return auditFHIRFailure(ctx, resourceType, resourceId, action, errorMessage)
}

/**
 * Read audit hook: logs read access after a successful read.
 */
export async function readAudit(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<EhrAuditResult> {
  return auditFHIRRead(ctx, resourceType, resourceId)
}
