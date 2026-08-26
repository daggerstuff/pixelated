# ADR-006: Audit Chain Extension for EHR Events

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The platform has a production hash-chain audit log at `src/lib/audit/`. The
`AuditLogger` class (`src/lib/audit/logger.ts`) links every event into a SHA-256
hash chain via an atomic cursor upsert (`chain_audit_cursor`), with
`verifyAuditChain()` detecting any modification, deletion, or reordering. The
`AuditEvent` interface (`src/lib/audit/events.ts`) carries `id`, `timestamp`,
`userId`, `type`, `action`, `severity`, `resourceId`, `resourceType`,
`metadata`, `ipAddress`, `userAgent`, `status`, `previousHash`, `hash`. DLP
sanitization runs on metadata before persistence.

ADR-001 established this as the compliance foundation (Decision 6). The EHR
module must extend this to cover all EHR write events — HIPAA requires audit
trails for all access to and modifications of PHI. F1.3 (Audit bridge) is the
implementation track; risk R-AUDIT-01 flags incomplete audit trails as High
severity. A separate audit system would break the single chain of custody.

## Decision 1: Extend Existing Audit Log to Cover All EHR Write Events

**Chosen**: Every EHR write path emits an audit event through the existing
`AuditLogger.logEvent()` in `src/lib/audit/logger.ts`  
**Rejected**: Separate audit system for EHR; DB trigger only; middleware only

### Rationale

- Single chain — `verifyAuditChain` covers EHR and non-EHR in one pass
- Reuses `AuditLogger`, `verifyAuditChain`, DLP sanitization — no new
  infrastructure
- Validation pipeline from ADR-002
  (`validateResource() -> persist() -> audit.log() -> index.update()`) ensures
  every write is audited with full user context
- DB trigger only misses app context (user, session); middleware only misses
  non-HTTP writes

### Implementation

- `src/lib/ehr-native/audit/` (F1.3) implements a bridge calling
  `AuditLogger.getInstance().logEvent()` with EHR-specific event data
- Every EHR write event includes: `resourceType`, `resourceId`, `action`
  (create/read/update/delete), `userId`, `tenant`, `timestamp`, `metadata`
  (version, changeset), `ipAddress`, `userAgent`, `sessionId`
- Uses existing `AuditEventType` values (`CREATE`, `UPDATE`, `DELETE`, `ACCESS`)
  from `src/lib/audit/events.ts`
- DLP sanitization runs automatically — no PHI in audit logs (ADR-001)
- `verifyAuditChain()` covers EHR events in the same chain

## Decision 2: Audit Events for All EHR Resource Operations

**Chosen**: Audit events for create, read, update, and delete on all EHR
resource types: patients, encounters, notes, claims, consents, appointments,
observations  
**Rejected**: Audit writes only; audit only PHI-bearing resources

### Rationale

- HIPAA requires audit trails for both access (read) and modification (write) of
  PHI
- Read auditing detects unauthorized access (e.g., clinician reading unassigned
  patient)
- All EHR resources are PHI-bearing; excluding any creates a compliance gap

### Implementation

- Audit events for each resource type and action (create, read, update, delete)
- Read events: `AuditEventType.ACCESS`, `AuditSeverity.INFO`; write events:
  `CREATE` / `UPDATE` / `DELETE`, `AuditSeverity.HIGH` for deletions
- Bridge called from validation pipeline (ADR-002) after `persist()` succeeds

## Decision 3: Consent Changes Get Double-Audit

**Chosen**: Consent changes emit two audit events — one for the consent resource
itself, and one for the clinical action it authorizes  
**Rejected**: Single audit event for consent changes

### Rationale

- A consent change is both a clinical event (record changed) and an
  authorization event (enables/blocks future clinical actions)
- If consent is revoked, the trail must show both the revocation and clinical
  actions blocked by it
- Single-audit loses the link between consent state and governed actions

### Implementation

- On `Consent` create/update/revoke:
  1. Event 1: `resourceType: 'Consent'`, `action: 'create'/'update'`,
     `metadata: { consentLevel, treatmentType, expiryDate }`
  2. Event 2: `action: 'governance_allow'` or `'governance_deny'` (existing
     `AuditEventType.GOVERNANCE_ALLOW` / `GOVERNANCE_DENY`),
     `metadata: { clinicalAction, authorizedBy }`
- Clinical action attempts include `consentId` in metadata; denied actions get
  `status: 'failure'`, `AuditSeverity.HIGH`

## Decision 4: Chain Verification Extended to EHR Events

**Chosen**: `verifyAuditChain()` and `AuditLogger.verifyChain()` cover EHR
events in the same chain — no separate verification  
**Rejected**: Separate chain verification for EHR

### Rationale

- `verifyAuditChain()` is a pure function over any ordered `AuditEvent`
  sequence; does not distinguish EHR from non-EHR
- Single chain means one verification covers all events — no reconciliation
- `chain_audit_cursor` atomic upsert ensures EHR events link without races

### Implementation

- No changes to `verifyAuditChain()` or `computeChainHash()`
- Gate G1.5 runs `verifyChain()` in CI to confirm every EHR write produces a
  chain-verified entry
- Phase 3 F3.6 exports EHR audit events via `exportReceiptLedger()`, filtered by
  `resourceType`

## Consequences

### Positive

- Single chain of custody for all audit events with one verification path
- Reuses production-tested `AuditLogger`, `verifyAuditChain`, DLP sanitization
- HIPAA audit trail requirement met (risk R-AUDIT-01 mitigated)
- Consent double-audit links consent state to clinical actions for malpractice
  defense
- Gate G1.5 blocks ship on audit gaps — structural enforcement

### Negative

- Read auditing increases log volume; every chart review produces an event
- Double-audit for consent adds bridge complexity
- DLP may redact clinically relevant fields matching PHI patterns

### Mitigations

- Partition audit logs by month (ADR-001); archive older than 7 years
- Read events use `AuditSeverity.INFO`; filterable in compliance reports
- DLP allowlist for clinical terms; `verifyChain()` runs on sampled partition

## Related Decisions

- ADR-001: Hash-chain audit log foundation (Decision 6), zero-PHI guards
- ADR-002: Validation pipeline includes `audit.log()` step
- ADR-005: Authorization denials audited; `ehr:read-only-auditor` role
- ADR-007: Consent changes trigger double-audit per this ADR
