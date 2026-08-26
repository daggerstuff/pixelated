# ADR-005: EHR RBAC Role Matrix

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The EHR module build plan (F1.5) requires EHR-specific RBAC roles. The platform
already has an Auth0 RBAC service at `src/lib/auth/auth0-rbac-service.ts` using
the Auth0 `ManagementClient` with a 6-role permission matrix (`admin`,
`therapist`, `patient`, `researcher`, `support`, `guest`), role hierarchy, MFA
requirements, and `logSecurityEvent` hooks. ADR-001 established RBAC with role
hierarchy and Postgres RLS with `tenant_id`.

TherapyNotes customers complain about poor access control. The EHR module needs
granular roles from day one: clinicians, supervisors, billers, clients, admins,
and read-only auditors need different access to clinical resources. The existing
`therapist` and `patient` roles are too coarse — a biller should see claims but
not clinical notes; a read-only auditor should see audit logs but not modify
anything. This ADR extends the existing Auth0 RBAC service rather than creating
a parallel authorization system.

## Decision 1: Extend Auth0 RBAC with EHR-Specific Roles

**Chosen**: Add six EHR-specific roles to the existing Auth0 RBAC service
(`src/lib/auth/auth0-rbac-service.ts`)  
**Rejected**: Separate EHR authorization system; ABAC for EHR; coarse single
"ehr_user" role

### Rationale

- `auth0-rbac-service.ts` ManagementClient pattern, role hierarchy, MFA, and
  `logSecurityEvent` hooks are production-tested — EHR roles are additive
- Separate system duplicates infrastructure and breaks the single authorization
  path; ABAC is too complex for initial version
- F1.5 is a 2-day estimate extending existing code vs. weeks for a new system

### Implementation

- Add EHR roles to `UserRole` type and `AUTH0_ROLE_DEFINITIONS`:
  - `ehr:clinician` — clinical read/write on assigned patients
  - `ehr:supervisor` — clinical read + co-sign + risk-flag review
  - `ehr:billler` — claims and eligibility only; no clinical notes
  - `ehr:client` — client portal: self-schedule, messaging, homework, telehealth
    join, own records
  - `ehr:admin` — tenant-level EHR configuration, user management
  - `ehr:read-only-auditor` — audit log read only; no clinical data write
- Add EHR permissions to `AUTH0_PERMISSION_DEFINITIONS` (e.g.,
  `read:ehr_patients`, `write:ehr_encounters`, `read:ehr_claims`,
  `write:ehr_consents`, `read:ehr_audit_logs`)
- Run `initializeAuth0RolesAndPermissions()` to create roles in Auth0
- Enforce via Auth0 RBAC on API routes + Postgres RLS (`tenant_id` from ADR-001)
  on every EHR table

## Decision 2: Permission Matrix — Role x Resource

**Chosen**: A documented permission matrix mapping each EHR role to allowed
actions on each EHR resource, enforced at Auth0 RBAC + Postgres RLS  
**Rejected**: Implicit permissions via hierarchy alone; per-endpoint hardcoded
checks

### Permission Matrix

| Resource     | ehr:clinician         | ehr:supervisor       | ehr:billler      | ehr:client       | ehr:admin        | ehr:read-only-auditor |
| ------------ | --------------------- | -------------------- | ---------------- | ---------------- | ---------------- | --------------------- |
| Patients     | read/write (assigned) | read (all)           | read (demo only) | read (own)       | read/write (all) | read (metadata)       |
| Encounters   | read/write (assigned) | read/write + co-sign | none             | read (own)       | read (all)       | none                  |
| Notes        | read/write (assigned) | read + co-sign       | none             | none             | read (all)       | none                  |
| Claims       | read (assigned)       | read (all)           | read/write (all) | read (own)       | read (all)       | read (metadata)       |
| Consents     | read (assigned)       | read (all)           | none             | read (own)       | read (all)       | read (metadata)       |
| Appointments | read/write (assigned) | read (all)           | none             | read/write (own) | read (all)       | none                  |
| Observations | read/write (assigned) | read (all)           | none             | read (own)       | read (all)       | none                  |
| Audit logs   | none                  | read (clinical)      | read (billing)   | none             | read (all)       | read (all)            |

### Implementation

- Document full matrix in `docs/architecture/ehr-rbac.md`
- Enforce at API route level via existing `userHasPermission` /
  `roleHasPermission` functions
- Enforce at DB level via Postgres RLS checking both `tenant_id` (ADR-001) and
  role-derived access scope
- `ehr:clinician` limited to assigned patients via `patient_assignments` table
  (clinician_id, patient_id, tenant_id)
- `ehr:client` limited to own records via `user_id = current_user`
- Every authorization denial emits audit event (ADR-006)

## Decision 3: MFA Required for Clinical Write Operations

**Chosen**: MFA required for `ehr:clinician` writes on notes, encounters,
consents; `ehr:billler` writes on claims; `ehr:admin` all operations  
**Rejected**: MFA optional; MFA on all operations including reads

### Rationale

- Existing `AUTH0_PERMISSION_DEFINITIONS` marks write permissions with
  `requiresMFA: true` (e.g., `write:patient_notes`); extends the pattern
- Clinical writes become part of the legal medical record — high risk
- Read operations skip MFA to avoid friction in chart review

### Implementation

- EHR write permissions set `requiresMFA: true` in
  `AUTH0_PERMISSION_DEFINITIONS`
- Existing `requiresMFA()` function enforces via API middleware
- MFA failure emits security audit event via `logSecurityEvent`
- Use step-up auth (MFA once per session) to reduce per-write friction

## Consequences

### Positive

- Granular role-based access from day one, addressing TherapyNotes' gap
- Extends production-tested Auth0 RBAC — no new authorization infrastructure
- Two-layer enforcement (Auth0 RBAC + Postgres RLS) provides defense in depth
- Explicit permission matrix auditable for SOC 2 / HIPAA
- MFA on clinical writes protects the legal medical record

### Negative

- Six new roles increase matrix complexity; onboarding requires correct
  assignment
- `ehr:clinician` assignment scoping needs `patient_assignments` table + RLS
- MFA on writes adds friction for frequent note-writing
- 12 total roles (6 existing + 6 EHR) requires clear documentation

### Mitigations

- Document full matrix in `docs/architecture/ehr-rbac.md` with examples
- Use Auth0 role assignment UI; validate via existing `canAssignRole()` to
  prevent privilege escalation
- Step-up auth (MFA per session, not per write) reduces friction
- `patient_assignments` table RLS-protected; only `ehr:admin` and
  `ehr:supervisor` modify assignments

## Related Decisions

- ADR-001: RLS with `tenant_id`, RBAC with role hierarchy, MFA foundation
- ADR-002: RBAC enforced on FHIR resource endpoints
- ADR-003: `ehr:billler` role for claims operations
- ADR-006: Authorization denials audited
- ADR-007: `ehr:clinician` and `ehr:client` consent access scoped by matrix
