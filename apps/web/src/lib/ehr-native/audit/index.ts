/**
 * EHR Native — Audit Extension (F2.4)
 *
 * Structured EHR audit logging that extends the existing SHA-256
 * hash-chain audit trail (src/lib/audit/) with EHR-specific event
 * types, actions, resource types, and typed builders.
 *
 * Every EHR write path and sensitive read path should emit an audit
 * event through EHRAuditService, which persists events into the
 * tamper-evident hash chain via AuditLogger.
 *
 * @see docs/adr/ADR-006-audit-chain-ehr.md
 * @see src/lib/audit/logger.ts for AuditLogger hash-chain persistence
 * @see src/lib/audit/events.ts for base AuditEvent, AuditEventType, AuditSeverity
 */

export {
  EHRAuditAction,
  EHRResourceType,
  EHRSeverity,
  ehrActionToEventType,
  type EHRAuditActionType,
  type EHRResourceTypeValue,
  type EHRAuditMetadata,
} from './events'

export {
  EHRAuditService,
  type EHRAuditInput,
  type PatientAuditInput,
  type EncounterAuditInput,
  type AppointmentAuditInput,
  type ObservationAuditInput,
  type NoteAuditInput,
  type ClaimAuditInput,
  type ConsentAuditInput,
  type MedicationAuditInput,
  type IntegrationAuditInput,
  type BreakGlassAuditInput,
  type TelehealthAuditInput,
} from './ehr-audit-service'
