/**
 * EHR Audit Bridge — connects FHIR R4 write operations to the existing
 * HIPAA-compliant audit system.
 *
 * Every FHIR write (create, update, delete) and read emits two audit records:
 * 1. A HIPAA-compliant audit log entry via `createHIPAACompliantAuditLog`
 *    (stored locally + queued for remote persistence).
 * 2. A chain-linked audit event via `AuditLogger.getInstance().logEvent()`
 *    (persisted to MongoDB with SHA-256 tamper-evident chain hashing).
 *
 * The dual-write ensures both the HIPAA audit log and the tamper-evident
 * chain cover EHR events. Chain verification (`verifyAuditChain`) works
 * on the AuditEvent[] from MongoDB, so EHR events must be logged through
 * AuditLogger to be included in chain verification.
 *
 * @see src/lib/audit.ts — createHIPAACompliantAuditLog, AuditEventType (MODIFY), AuditEventStatus
 * @see src/lib/audit/events.ts — AuditEvent, AuditEventType (UPDATE), AuditSeverity
 * @see src/lib/audit/logger.ts — AuditLogger, verifyAuditChain
 */

import {
  createHIPAACompliantAuditLog,
  AuditEventType as HipaaAuditEventType,
  AuditEventStatus,
  type AuditDetails,
  type AuditLogEntry,
} from '@/lib/audit'
import {
  AuditEventType as ChainAuditEventType,
  AuditSeverity,
  type AuditEvent,
} from '@/lib/audit/events'
import { AuditLogger, verifyAuditChain } from '@/lib/audit/logger'

import type { FHIRResourceType } from '../fhir/types.js'
import type {
  BreakGlassAuditEntry,
  EhrAuditAction,
  EhrAuditContext,
  EhrAuditResult,
} from './types.js'

/**
 * FHIR R4 version string for audit metadata.
 */
const FHIR_VERSION = '4.0.1'

/**
 * Map EHR audit action to AuditEventType from audit.ts (uses MODIFY, not UPDATE).
 */
function toHipaaEventType(action: EhrAuditAction): HipaaAuditEventType {
  switch (action) {
    case 'create':
      return HipaaAuditEventType.CREATE
    case 'update':
      return HipaaAuditEventType.MODIFY
    case 'delete':
      return HipaaAuditEventType.DELETE
    case 'read':
      return HipaaAuditEventType.ACCESS
    case 'break-glass':
      return HipaaAuditEventType.ACCESS
    default: {
      const exhaustive: never = action
      void exhaustive
      throw new Error('Unhandled EhrAuditAction')
    }
  }
}

/**
 * Map EHR audit action to AuditEventType from events.ts (uses UPDATE, not MODIFY).
 */
function toChainEventType(action: EhrAuditAction): ChainAuditEventType {
  switch (action) {
    case 'create':
      return ChainAuditEventType.CREATE
    case 'update':
      return ChainAuditEventType.UPDATE
    case 'delete':
      return ChainAuditEventType.DELETE
    case 'read':
      return ChainAuditEventType.ACCESS
    case 'break-glass':
      return ChainAuditEventType.ACCESS
    default: {
      const exhaustive: never = action
      void exhaustive
      throw new Error('Unhandled EhrAuditAction')
    }
  }
}

/**
 * Determine severity based on action and break-glass status.
 */
function getSeverity(
  action: EhrAuditAction,
  breakGlass: boolean,
): AuditSeverity {
  if (breakGlass) return AuditSeverity.HIGH
  if (action === 'delete') return AuditSeverity.MEDIUM
  return AuditSeverity.INFO
}

/**
 * Build AuditDetails for createHIPAACompliantAuditLog.
 *
 * Since createHIPAACompliantAuditLog generates ipAddress/userAgent/sessionId
 * internally (returning 'server-side' on server), we include the actual values
 * from EhrAuditContext in the details field for complete audit context.
 */
function buildDetails(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  version?: string,
): AuditDetails {
  const details: AuditDetails = {
    fhirVersion: FHIR_VERSION,
    resourceType,
    resourceId,
    action,
    tenantId: ctx.tenantId,
  }
  if (ctx.ipAddress !== undefined) {
    details['ipAddress'] = ctx.ipAddress
  }
  if (ctx.userAgent !== undefined) {
    details['userAgent'] = ctx.userAgent
  }
  if (ctx.sessionId !== undefined) {
    details['sessionId'] = ctx.sessionId
  }
  if (ctx.breakGlass) {
    details['breakGlass'] = true
    if (ctx.breakGlassReason !== undefined) {
      details['breakGlassReason'] = ctx.breakGlassReason
    }
  }
  if (version !== undefined) {
    details['version'] = version
  }
  return details
}

/**
 * Build the chain event payload for AuditLogger.logEvent().
 *
 * Uses AuditEventType from events.ts (UPDATE, not MODIFY) and AuditSeverity
 * for chain-linked events.
 */
function buildChainEvent(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  status: 'success' | 'failure',
  errorMessage?: string,
): Omit<AuditEvent, 'id' | 'timestamp'> {
  const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
    userId: ctx.userId,
    type: toChainEventType(action),
    action: `fhir:${action}`,
    severity: getSeverity(action, ctx.breakGlass),
    resourceType,
    status,
    ...(resourceId !== undefined ? { resourceId } : {}),
    ...(ctx.ipAddress !== undefined ? { ipAddress: ctx.ipAddress } : {}),
    ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    metadata: {
      fhirVersion: FHIR_VERSION,
      tenantId: ctx.tenantId,
      role: ctx.role,
      ...(ctx.breakGlass ? { breakGlass: true } : {}),
      ...(ctx.breakGlassReason !== undefined
        ? { breakGlassReason: ctx.breakGlassReason }
        : {}),
      ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
    },
  }
  return event
}

/**
 * Core audit function: emits both HIPAA log entry and chain-linked event.
 *
 * Called by the middleware hooks (preWrite, postWrite, readAudit) which are
 * invoked by the FHIR CRUD operations.
 *
 * @returns EhrAuditResult with IDs from both systems
 */
export async function auditFHIREvent(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  status: AuditEventStatus,
  version?: string,
  errorMessage?: string,
): Promise<EhrAuditResult> {
  try {
    // 1. Create HIPAA-compliant audit log entry (uses audit.ts AuditEventType — MODIFY)
    const hipaaEntry: AuditLogEntry = await createHIPAACompliantAuditLog({
      userId: ctx.userId,
      action: `fhir:${action}`,
      resource: `FHIR/${resourceType}`,
      eventType: toHipaaEventType(action),
      status,
      resourceId,
      details: buildDetails(ctx, resourceType, resourceId, action, version),
      ...(ctx.role !== undefined ? { userRole: ctx.role } : {}),
      ...(ctx.breakGlass && ctx.breakGlassReason !== undefined
        ? { notes: `Break-glass: ${ctx.breakGlassReason}` }
        : {}),
    })

    // 2. Create chain-linked audit event (uses events.ts AuditEventType — UPDATE)
    const chainStatus: 'success' | 'failure' =
      status === AuditEventStatus.FAILURE || status === AuditEventStatus.BLOCKED
        ? 'failure'
        : 'success'
    const chainEvent = buildChainEvent(
      ctx,
      resourceType,
      resourceId,
      action,
      chainStatus,
      errorMessage,
    )
    const chainEventId = await AuditLogger.getInstance().logEvent(chainEvent)

    return {
      success: true,
      ...(hipaaEntry.id !== undefined ? { auditLogId: hipaaEntry.id } : {}),
      ...(chainEventId !== undefined ? { chainEventId } : {}),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audit emission failed'
    console.error(`[EHR-AUDIT] Failed to emit audit event: ${message}`, {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      resourceType,
      resourceId,
      action,
    })
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Audit a FHIR create operation (POST).
 */
export async function auditFHIRCreate(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  version?: string,
): Promise<EhrAuditResult> {
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    'create',
    AuditEventStatus.SUCCESS,
    version,
  )
}

/**
 * Audit a FHIR update operation (PUT).
 */
export async function auditFHIRUpdate(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  version?: string,
): Promise<EhrAuditResult> {
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    'update',
    AuditEventStatus.SUCCESS,
    version,
  )
}

/**
 * Audit a FHIR delete operation (DELETE).
 */
export async function auditFHIRDelete(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<EhrAuditResult> {
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    'delete',
    AuditEventStatus.SUCCESS,
  )
}

/**
 * Audit a FHIR read operation (GET).
 */
export async function auditFHIRRead(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
): Promise<EhrAuditResult> {
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    'read',
    AuditEventStatus.SUCCESS,
  )
}

/**
 * Audit a FHIR write failure (validation error, persist failure, etc.).
 */
export async function auditFHIRFailure(
  ctx: EhrAuditContext,
  resourceType: FHIRResourceType,
  resourceId: string,
  action: EhrAuditAction,
  errorMessage: string,
): Promise<EhrAuditResult> {
  return auditFHIREvent(
    ctx,
    resourceType,
    resourceId,
    action,
    AuditEventStatus.FAILURE,
    undefined,
    errorMessage,
  )
}

/**
 * Audit a break-glass access event with FHIR resource context.
 *
 * The RBAC system (F1.5) already logs break-glass activation. This function
 * adds the FHIR-specific context (resourceType, resourceId) to both the
 * HIPAA audit log and the tamper-evident chain.
 */
export async function auditBreakGlassFHIR(
  entry: BreakGlassAuditEntry,
): Promise<EhrAuditResult> {
  const ctx: EhrAuditContext = {
    userId: entry.userId,
    tenantId: entry.tenantId,
    role: entry.role,
    breakGlass: true,
    ...(entry.reason !== undefined ? { breakGlassReason: entry.reason } : {}),
    ...(entry.ipAddress !== undefined ? { ipAddress: entry.ipAddress } : {}),
    ...(entry.userAgent !== undefined ? { userAgent: entry.userAgent } : {}),
    ...(entry.sessionId !== undefined ? { sessionId: entry.sessionId } : {}),
  }

  return auditFHIREvent(
    ctx,
    entry.resourceType,
    entry.resourceId,
    'break-glass',
    AuditEventStatus.WARNING,
  )
}

/**
 * Verify the tamper-evident audit chain for EHR events.
 *
 * Delegates to `verifyAuditChain` from the audit logger, which checks
 * SHA-256 hash linkage across all AuditEvents in MongoDB. EHR events
 * logged through `auditFHIREvent` are included in this chain.
 *
 * @param events - Array of AuditEvents to verify (typically from AuditLogger.getUserEvents)
 * @returns AuditChainVerification with validity status and break details
 */
export function verifyEhrAuditChain(
  events: AuditEvent[],
): ReturnType<typeof verifyAuditChain> {
  return verifyAuditChain(events)
}
