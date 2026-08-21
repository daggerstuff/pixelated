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
import {
  auditFHIRCreate,
  auditFHIRDelete,
  auditFHIRFailure,
  auditFHIRRead,
  auditFHIRUpdate,
} from './ehr-audit-bridge.js'
import type {
  EhrAuditAction,
  EhrAuditContext,
  EhrAuditResult,
} from './types.js'

/**
 * Log a warning when an audit result indicates failure.
 */
function checkAuditResult(result: EhrAuditResult, operation: string): void {
  if (!result.success) {
    console.warn(
      `[EHR-AUDIT] Audit emission failed for ${operation}: ${result.error ?? 'unknown error'}`,
    )
  }
}

/**
 * Extract EhrAuditContext from FHIRRequestContext.
 *
 * IP, User-Agent, and session ID are passed as optional parameters
 * (sourced from HTTP headers by the FHIR server). The breakGlassReason
 * is extracted from jwtClaims when present.
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
  const { auditFHIREvent } = await import('./ehr-audit-bridge.js')
  const { AuditEventStatus } = await import('@/lib/audit')
  const result = await auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    action,
    AuditEventStatus.ATTEMPT,
  )
  checkAuditResult(result, `pre-write ${action}`)
  return result
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
  let result: EhrAuditResult
  switch (action) {
    case 'create':
      result = await auditFHIRCreate(ctx, resourceType, resourceId, version)
      break
    case 'update':
      result = await auditFHIRUpdate(ctx, resourceType, resourceId, version)
      break
    case 'delete':
      result = await auditFHIRDelete(ctx, resourceType, resourceId)
      break
    case 'read':
      result = await auditFHIRRead(ctx, resourceType, resourceId)
      break
    case 'break-glass':
      result = await auditFHIRRead(ctx, resourceType, resourceId)
      break
    default: {
      const exhaustive: never = action
      void exhaustive
      throw new Error('Unhandled EhrAuditAction')
    }
  }
  checkAuditResult(result, `post-write ${action}`)
  return result
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
  const result = await auditFHIRFailure(
    ctx,
    resourceType,
    resourceId,
    action,
    errorMessage,
  )
  checkAuditResult(result, `failure ${action}`)
  return result
}

/**
 * Read audit hook: logs read access after a successful read.
 */
export async function readAudit(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<EhrAuditResult> {
  const result = await auditFHIRRead(ctx, resourceType, resourceId)
  checkAuditResult(result, 'read')
  return result
}
