/**
 * EHR Audit Bridge — barrel export.
 *
 * Connects FHIR R4 write operations to the existing HIPAA audit system.
 * Every FHIR write (create, update, delete) and read emits audit events
 * through both the HIPAA-compliant audit log and the tamper-evident chain.
 */

// Types
export type {
  BreakGlassAuditEntry,
  EhrAuditAction,
  EhrAuditContext,
  EhrAuditResult,
} from './types.js'

// Bridge functions
export {
  auditBreakGlassFHIR,
  auditFHIRCreate,
  auditFHIRDelete,
  auditFHIRFailure,
  auditFHIRRead,
  auditFHIRUpdate,
  auditFHIREvent,
  verifyEhrAuditChain,
} from './ehr-audit-bridge.js'

// Middleware hooks
export {
  buildEhrAuditContext,
  postWriteAudit,
  postWriteFailureAudit,
  preWriteAudit,
  readAudit,
} from './middleware.js'
