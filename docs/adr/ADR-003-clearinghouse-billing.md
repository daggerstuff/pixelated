# ADR-003: Clearinghouse API for Billing — No In-House Billing Engine

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The EHR module build plan (section 0, "What this plan is NOT") explicitly kills
building a billing engine. The adversarial review's skeptic killed this scope:
billing engines are a regulatory and maintenance nightmare (EDI 837/835 parsing,
payer-specific rules, remittance posting, AR aging, patient statements).
TherapyNotes customers complain about error-prone billing; we solve that pain by
integrating a clearinghouse, not by becoming a billing company.

F1.10 defines the scope: eligibility checks, claim status tracking, denial
alerts, one-click resubmission. Claims are authored from encounters (FHIR
`Claim` resources per ADR-002) and submitted via the clearinghouse. We do not
generate claim logic, post payments, age receivables, or send patient
statements. Open Question 1 is resolved: Change Healthcare is the clearinghouse
vendor (confirmed by product). A BAA must be in place before any PHI flows.

## Decision 1: Change Healthcare Clearinghouse for Billing-Adjacent Operations

**Chosen**: Change Healthcare clearinghouse API for eligibility checks, claim
status tracking, denial alerts, and one-click resubmission only  
**Rejected**: In-house billing engine; Availity; multiple clearinghouse
integrations at launch

### Rationale

- Clearinghouse API solves the actual customer pain (billing visibility) without
  the regulatory burden of a billing engine
- Change Healthcare handles EDI, payer rules, remittance parsing — we never own
  that complexity
- F1.10 is a 6-day integration, not a multi-quarter build
- Availity rejected per product resolution (plan Open Question 1)
- Multi-clearinghouse deferred to Phase 2; one vendor for Phase 1

### Implementation

- `src/lib/ehr-native/services/claims.service.ts` (F1.10) implements:
  `checkEligibility()`, `trackClaimStatus()`, `denialAlerts()`,
  `resubmitClaim()`
- Claims are FHIR R4 `Claim` resources stored per ADR-002; clearinghouse reads
  from the stored FHIR resource, not a separate billing schema
- API surface at `/api/ehr/v1/claims` (F1.6) with RBAC enforcement (ADR-005 —
  `ehr:billler` role)
- Every clearinghouse call emits an audit event (ADR-006)

## Decision 2: Explicit Scope Boundary — What We Do NOT Build

**Chosen**: Hard scope line — no claim generation logic, no AR aging, no patient
statements, no payment posting, no remittance auto-posting  
**Rejected**: Any of the above as future Phase 2 scope

### Rationale

- Skeptic's finding (plan risk R-BILLING-01): scope creep into billing is a
  Medium severity risk
- Billing engines require EDI 837/835 parsing, payer-specific rule engines,
  per-payer certification — no infrastructure for this
- Customers want billing visibility and resubmission, not a full billing
  workflow

### Implementation

- Document scope boundary in `docs/architecture/ehr-billing-scope.md`
- Claims authored by clinicians from encounters (FHIR `Claim` with
  `supportingInfo` referencing the Encounter); clearinghouse submits them
- Denial alerts surface in `src/components/ehr/billing/`; resubmission is one
  click with editable fields
- Payment posting, AR aging, patient statements explicitly out of scope; if
  needed later, require a separate ADR

## Decision 3: BAA Required Before Any PHI Flow

**Chosen**: BAA with Change Healthcare executed before any PHI is sent to the
clearinghouse  
**Rejected**: Proceeding without BAA; relying on DPA alone

### Rationale

- HIPAA requires BAA with every subprocessor handling PHI
- Change Healthcare processes eligibility and claim data with PHI (demographics,
  diagnosis codes, procedure codes)
- Extends the BAA pattern from ADR-001

### Implementation

- BAA executed and stored before F1.10 ships to production
- Credentials in existing `.env` / secrets management (no hardcoded credentials
  per AGENTS.md)
- TLS 1.3 minimum for clearinghouse API calls; field-level encryption per
  ADR-001 Decision 4

## Consequences

### Positive

- Bounded scope eliminates regulatory and maintenance burden of a billing engine
- Customer pain solved with a 6-day integration, not multi-quarter build
- Change Healthcare handles EDI, payer rules, remittance parsing
- Scope creep risk (R-BILLING-01) mitigated by explicit boundary

### Negative

- Practices needing full billing workflow must use a separate billing system
- Dependency on Change Healthcare API availability
- Clearinghouse latency (target < 5s) varies with payer response times
- One-vendor lock-in for Phase 1

### Mitigations

- Document scope boundary so customers know billing workflow is out of scope
- Cache eligibility results in Redis to reduce repeated API calls
- 5s timeout on clearinghouse calls; surface timeouts as "retry" not block
- Abstract clearinghouse client behind an interface for Phase 2 multi-vendor

## Related Decisions

- ADR-001: BAA pattern, encryption, audit foundation
- ADR-002: Claim resources are FHIR R4 `Claim` stored as JSONB
- ADR-005: `ehr:billler` role for claims operations
- ADR-006: Every clearinghouse call audited
