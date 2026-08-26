# ADR-002: FHIR R4 as Canonical Internal Data Model

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The EHR module add-on needs a canonical data model for clinical resources. The
platform already has an outbound FHIR integration layer at `src/lib/ehr/` with
typed clients for Epic, Cerner, athenahealth, and Allscripts, all speaking FHIR
R4 via `src/lib/ehr/services/fhir.client.ts`. The existing
`src/lib/ehr/types.ts` defines `FHIRResource`, `Patient`, `Practitioner`, and a
`FHIRClient` interface — all FHIR R4 shaped.

The architect's structural requirement (plan section 1.2) is that FHIR R4 be the
internal data model, not just the interchange format. ADR-001 established
Postgres with RLS (`tenant_id`) as the system of record and the hash-chain audit
log. This ADR defines what shape the stored clinical data takes.

## Decision 1: FHIR R4 JSONB as the Storage Format

**Chosen**: All clinical resources (Patient, Encounter, Observation,
DocumentReference, Consent, Claim, Appointment, ServiceRequest, Condition,
AllergyIntolerance, MedicationRequest, Practitioner, PractitionerRole) stored as
FHIR R4 JSONB in PostgreSQL  
**Rejected**: Custom proprietary data model; HL7 v2; FHIR STU3

### Rationale

- FHIR R4 is the industry standard (ONC, TEFCA, USCDI v3); no translation layer
  to external EHRs — `src/lib/ehr/` already speaks R4
- HL7 v2 is pipe-delimited legacy with no existing code; STU3 is superseded
- Custom model would double the mapping surface and create divergence
- JSONB GIN indexes + `tsvector` give query flexibility without relational
  column sprawl

### Implementation

- Extend `src/lib/ehr-native/types/` with zod schemas for all R4 resources,
  reusing `FHIRResource` base from `src/lib/ehr/types.ts`
- Each Postgres table (`ehr_patient`, `ehr_encounter`, etc. per F1.1) stores
  full FHIR resource as `resource JSONB` plus indexed search columns via
  generated columns
- RLS policies from ADR-001 apply to every EHR table (`tenant_id`)
- Field-level encryption for SSN, MRN via `src/lib/crypto` / `pgcrypto`

## Decision 2: Internal FHIR R4 REST Endpoint

**Chosen**: Internal FHIR R4 REST endpoint at `/fhir/r4` with
CapabilityStatement at `/fhir/r4/metadata`  
**Rejected**: Proprietary REST only; GraphQL

### Rationale

- Makes the native EHR a first-class FHIR producer — `src/lib/ehr/` can read
  from our own server the same way it reads from Epic/Cerner
- CapabilityStatement required for FHIR conformance validation (gate G1.6:
  Inferno / Touchstone)
- Proprietary REST requires a mapping for every external integration; GraphQL
  has no FHIR conformance path

### Implementation

- `src/lib/ehr-native/fhir/` implements `GET/{id}`, `POST`, `PUT`, `DELETE`,
  `GET?search`, `/{id}/_history` per FHIR R4 REST spec
- Astro API routes at `src/pages/api/fhir/r4/` delegate to
  `src/lib/ehr-native/fhir/`

## Decision 3: Validation Pipeline

**Chosen**: Every write goes through
`validateResource() -> repository.persist() -> audit.log() -> index.update()`  
**Rejected**: Validate-on-read; no validation

### Rationale

- Parse-don't-validate (existing zod convention): invalid resources never enter
  the database
- Audit after persist so the event references the committed resource ID and
  version
- Index update last so search is eventually consistent, never ahead of truth

### Implementation

- `validateResource()` runs zod schema; rejects with 400 + OperationOutcome
- `repository.persist()` writes JSONB + indexed columns in a Postgres
  transaction
- `audit.log()` calls the audit bridge (ADR-006)
- `index.update()` refreshes `tsvector` / `pg_trgm` via Postgres triggers

## Decision 4: FHIR Versioning via meta.versionId and _history Tables

**Chosen**: FHIR `meta.versionId` + `meta.lastUpdated` enforced; Postgres
triggers maintain a `_history` table per resource type  
**Rejected**: No versioning; application-level versioning only

### Rationale

- FHIR R4 requires `meta.versionId` and `meta.lastUpdated`; conformance checkers
  validate this
- `_history` tables give O(1) lookup of any prior version via `/{id}/_history`
- Triggers capture prior version on UPDATE/DELETE so no version is lost

### Implementation

- Every UPDATE increments `meta.versionId` and sets `meta.lastUpdated` to
  `now()`
- BEFORE UPDATE / BEFORE DELETE triggers copy current row to `{table}_history`
- `/{id}/_history` and `/{id}/_history/{versionId}` endpoints read from history
  tables

## Consequences

### Positive

- Zero translation layer between storage and existing FHIR integration clients
- External EHR interoperability is native (Epic, Cerner, athenahealth,
  Allscripts)
- FHIR R4 conformance achievable, unblocking marketplace and HIE (ADR-004)
- zod validation at boundary — invalid resources never persist
- Versioning via `_history` supports clinical audit and undo

### Negative

- JSONB queries less ergonomic; complex joins need `->` path expressions
- Full R4 zod coverage is large upfront effort (F1.0, 5d)
- `_history` tables double storage per resource type
- FHIR R4 is verbose; unused fields increase payload size

### Mitigations

- Extract indexed search columns via Postgres generated columns from JSONB
- Prioritize Phase 1 resources; defer Condition, AllergyIntolerance,
  MedicationRequest to Phase 2
- Partition `_history` by month; archive older than 7-year retention
- Use FHIR profiles to constrain resources to fields we use

## Related Decisions

- ADR-001: RLS, audit log, encryption foundation
- ADR-003: Claim resources are FHIR R4 `Claim` stored per this ADR
- ADR-005: RBAC enforced on FHIR resource endpoints
- ADR-006: Audit bridge for every FHIR write in the validation pipeline
- ADR-007: Consent resources are FHIR R4 `Consent` stored per this ADR
