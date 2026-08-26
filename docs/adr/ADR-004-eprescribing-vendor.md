# ADR-004: Vendor Integration for E-Prescribing — No Custom Build

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The EHR module build plan (Phase 3, F3.4) calls for HIE and e-prescribing
integrations. The adversarial review's skeptic killed building e-prescribing
from scratch (plan risk R-EHR-EPIC-01): e-prescribing requires DEA
certification, EPCS (Electronic Prescribing of Controlled Substances)
compliance, state pharmacy board integrations, and controlled substance
scheduling rules. Building in-house would require DEA registration, EPCS
certification audits, and per-state pharmacy board integrations — none of which
the platform has infrastructure for.

HIE integration via Carequality or DirectTrust requires certificate management,
trust framework onboarding, and conformance testing — a product in itself. The
plan defers both to Phase 3 and explicitly states "NOT custom." The existing
`src/lib/ehr/` integration layer (Epic, Cerner, athenahealth, Allscripts FHIR
clients) already demonstrates the integrate-don't-build pattern.

## Decision 1: Vendor Integration for E-Prescribing

**Chosen**: Integrate DoseSpot or DrFirst for e-prescribing (Phase 3, F3.4)  
**Rejected**: Building e-prescribing from scratch; deferring entirely

### Rationale

- E-prescribing is a regulated domain; vendor's certification and compliance
  infrastructure is the value proposition
- Vendor holds DEA certification, EPCS compliance, state pharmacy board
  integrations — we would have to obtain and maintain all of these
- F3.4 is an 8-day integration vs. months to years for custom build
- We handle integration (FHIR `MedicationRequest` per ADR-002, audit per
  ADR-006, RBAC per ADR-005); vendor handles regulated transmission

### Implementation

- `src/lib/ehr-native/integrations/` (Phase 3) implements vendor client behind
  an `EPrescribingProvider` interface
- Vendor selection (DoseSpot vs. DrFirst) deferred to Phase 3 kickoff; both have
  REST APIs and support FHIR `MedicationRequest`
- Prescriptions authored as FHIR R4 `MedicationRequest` per ADR-002; vendor
  transmits them
- BAA required with chosen vendor before any PHI flows
- Every prescription write emits audit event (ADR-006)
- RBAC: only `ehr:clinician` with prescriptive authority creates
  `MedicationRequest` (ADR-005)

## Decision 2: Vendor Integration for HIE

**Chosen**: Integrate a vendor for HIE connectivity (Carequality or DirectTrust)
rather than direct trust framework onboarding  
**Rejected**: Direct Carequality/DirectTrust onboarding; custom HIE gateway

### Rationale

- Carequality and DirectTrust require CA enrollment, trust framework agreements,
  conformance testing — multi-month onboarding per framework
- A vendor (HIE aggregator) provides both via a single API, absorbing trust
  framework overhead
- Consistent with `src/lib/ehr/` integrate-don't-build pattern

### Implementation

- `src/lib/ehr-native/integrations/` (Phase 3) implements HIE client behind
  `HIEProvider` interface
- Clinical documents exchanged via FHIR R4 `DocumentReference` and `Bundle` per
  ADR-002
- Vendor selection deferred to Phase 3 kickoff
- BAA required before any PHI flows

## Decision 3: No Custom EPCS or Controlled Substance Logic

**Chosen**: All controlled substance prescribing, EPCS authentication, DEA
scheduling logic delegated to the vendor  
**Rejected**: Building EPCS two-factor auth, DEA number validation, or
controlled substance scheduling in-house

### Rationale

- EPCS requires two-factor auth per DEA regulations, identity proofing, and
  controlled-substance-specific audit logging — vendor is certified
- DEA scheduling (Schedule II-V) varies by state and changes with regulation;
  vendor maintains rules
- Building this makes the platform a regulated e-prescribing entity, outside the
  clinical AI platform scope

### Implementation

- `EPrescribingProvider` interface exposes `transmitPrescription()`,
  `checkDrugInteractions()`, `getPharmacyDirectory()` — all delegated
- Controlled substance flags on `MedicationRequest` route to vendor's EPCS
  workflow; we do not implement EPCS auth
- Audit events for controlled substance prescriptions include vendor transaction
  ID for cross-referencing (ADR-006)

## Consequences

### Positive

- E-prescribing and HIE available in Phase 3 without regulatory burden
- Vendor absorbs DEA certification, EPCS compliance, pharmacy board maintenance
- Consistent with existing integrate-don't-build pattern
- Scope creep risk (R-EHR-EPIC-01) mitigated

### Negative

- Dependency on vendor availability and API stability
- Vendor selection deferred to Phase 3 — no Phase 1/2 e-prescribing
- Vendor API latency varies; no direct control over transmission speed
- One-vendor lock-in per integration

### Mitigations

- Abstract both behind interfaces (`EPrescribingProvider`, `HIEProvider`) for
  vendor swap
- Timeouts on vendor calls; surface failures as "retry" with audit trail
- Evaluate DoseSpot and DrFirst at Phase 3 kickoff on API quality, FHIR support,
  BAA terms
- For HIE, evaluate Carequality vs. DirectTrust connectivity needs before vendor
  selection

## Related Decisions

- ADR-001: BAA pattern, encryption, audit foundation
- ADR-002: `MedicationRequest` and `DocumentReference` as FHIR R4 JSONB
- ADR-005: `ehr:clinician` role for prescription writes
- ADR-006: Every prescription and HIE exchange audited
