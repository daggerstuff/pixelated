# EHR Module Add-On — Build Plan

**Status:** Implementation Ready **Priority:** P1 **Related:** TherapyNotes
competitive gap analysis (hyperplan distillation 2026-08-19) **Author:**
Sisyphus-Junior (goal-oriented autonomous) **Stack anchor:** Astro 6 + React
19 + TypeScript, Express/FastAPI/Flask, MongoDB/Redis/PostgreSQL

---

## 0. Executive Summary

Build an in-house EHR module add-on for the Pixelated Empathy clinical AI
platform that fills the consensus pain points customers have with TherapyNotes
(Behave Health). The module is a **native first-party EHR** that uses FHIR R4 as
its internal data model (architect's structural requirement) and interoperates
with the existing `src/lib/ehr/` integration layer (Epic, Cerner, athenahealth,
Allscripts FHIR clients) for outbound exchange.

**Phasing (skeptic won):**

- **Phase 1 (MVP, ~12 weeks):** Core EHR — charts, modality templates,
  scheduling, billing-adjacent claims tracking via clearinghouse API, audit,
  consent, FHIR R4 schema, client portal v1, native telehealth join.
- **Phase 2 (~10 weeks):** AI-assisted note drafting from transcripts, risk
  stratification, treatment plan suggestions, outcome-measure trending,
  integration marketplace v1.
- **Phase 3 (~8 weeks):** Customizable dashboards, supervisor tools,
  state-by-state consent engine, HIE/e-prescribing integrations, mobile parity
  hardening.

**What this plan is NOT:** a full billing engine (killed — use clearinghouse
API), AI-first MVP (killed — ship core EHR first), custom e-prescribing from
scratch (killed — integrate a vendor).

---

## 1. Architecture Decisions

### 1.1 Module placement

```
src/lib/ehr-native/          # NEW — in-house EHR domain logic
  ├── types/                 # FHIR R4-typed domain models (zod schemas)
  ├── services/              # Domain services (chart, note, schedule, claim, consent)
  ├── repositories/          # Persistence layer (Postgres + Mongo + Redis)
  ├── fhir/                  # Internal FHIR R4 server + resource validation
  ├── audit/                 # EHR-specific audit bridge to src/lib/audit
  ├── consent/               # Consent engine bridge to src/lib/consent
  ├── api/                   # Express route handlers (mounted under /api/ehr/v1)
  └── __tests__/

src/components/ehr/          # NEW — React 19 + Astro UI surfaces
  ├── charts/
  ├── notes/
  ├── scheduling/
  ├── billing/
  ├── portal/                # Client portal
  ├── telehealth/
  └── __tests__/

src/pages/api/ehr/v1/         # NEW — Astro API routes delegating to src/lib/ehr-native/api

ai/ehr/                      # NEW — Python FastAPI services for Phase 2 AI
  ├── note_drafting/
  ├── risk_stratification/
  └── treatment_plan_suggestions/
```

**Rationale:** Mirror the existing `src/lib/ehr/` (integration) boundary so the
in-house EHR is a sibling module, not a fork. The integration layer remains the
outbound FHIR gateway; the native module is the system of record.

### 1.2 Tech stack decisions (aligned with existing repo)

| Concern            | Decision                                                                          | Rationale / Existing anchor                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model         | FHIR R4 resources as canonical TypeScript types                                   | Architect: structural, not optional. Reuse `src/lib/ehr/types.ts` FHIRResource shape; extend with full R4 coverage via `fhir-kit` or hand-rolled zod schemas. |
| System of record   | PostgreSQL (PHI, charts, notes, claims, consent, audit)                           | Existing Postgres 17 container; RLS already established (ADR-001). Strong transactional guarantees for clinical data.                                         |
| Search & full-text | PostgreSQL `tsvector` + `pg_trgm` for notes; MongoDB for unstructured attachments | Avoid new infra. Mongo already in stack for content.                                                                                                          |
| Cache / locks      | Redis (existing)                                                                  | Note lock lease, schedule availability, session tokens.                                                                                                       |
| Audit              | Extend `src/lib/audit/` (chain-verified, HIPAA-compliant)                         | Already has `verifyAuditChain`, `createHIPAACompliantAuditLog`.                                                                                               |
| Consent            | Extend `src/lib/consent/ConsentExpiryService`                                     | Already tracks expiry; add per-treatment-type + state rules.                                                                                                  |
| Auth               | Auth0 RBAC via existing `src/lib/auth/auth0-rbac-service`                         | Add EHR-specific roles: `ehr:clinician`, `ehr:supervisor`, `ehr:biller`, `ehr:client`, `ehr:admin`.                                                           |
| Validation         | Zod (existing convention)                                                         | All FHIR resources get zod schemas; parse-don't-validate.                                                                                                     |
| API surface        | Astro API routes → Express handlers (existing pattern)                            | OpenAPI 3.1 via existing `codegen.ts` + `.spectral.yaml`.                                                                                                     |
| FHIR server        | Internal FHIR R4 REST endpoint mounted at `/fhir/r4`                              | Exposes resources to the integration layer and external apps; uses same validation pipeline.                                                                  |
| Telehealth         | Embedded WebRTC via existing `src/lib/websocket` + Zoom SDK                       | Native, not bolted-on. One-click start, auto note pre-population.                                                                                             |
| Billing            | Clearinghouse API (Change Healthcare / Availity)                                  | NOT a billing engine. Eligibility checks + claim status + resubmission only.                                                                                  |
| AI (Phase 2)       | FastAPI in `ai/ehr/` calling existing NVIDIA NIM                                  | Reuse `COPILOT_PROVIDER_*` / NIM config; never train on PHI without BAA.                                                                                      |
| Secrets            | Existing `.env` + `src/lib/crypto` + FHE for inference                            | No hardcoded credentials (AGENTS.md strict rule).                                                                                                             |
| Tests              | Vitest (unit/integration), Playwright (e2e), pytest (AI)                          | Existing `config/vitest.config.ts`, `config/playwright.config.ts`.                                                                                            |

### 1.3 FHIR R4 conformance

- [ ] **ADR-002: FHIR R4 as canonical internal data model** — write to
      `docs/adr/ADR-002-fhir-r4-canonical.md`. Decision: all clinical resources
      (Patient, Encounter, Observation, DocumentReference, Consent, Claim,
      Appointment, ServiceRequest) are stored as FHIR R4 JSONB in Postgres,
      validated by zod schemas derived from the FHIR R4 spec.
- [ ] **CapabilityStatement** published at `/fhir/r4/metadata` declaring
      supported resources, interactions, search params, and profiles.
- [ ] **Validation pipeline**: every write goes through
      `validateResource() → repository.persist() → audit.log() → index.update()`.
- [ ] **Versioning**: FHIR `meta.versionId` + `meta.lastUpdated` enforced;
      Postgres triggers maintain a `_history` table per resource type.

### 1.4 HIPAA & security posture

- [ ] All PHI tables encrypted at rest (Postgres TDE or volume encryption).
- [ ] Field-level encryption for the most sensitive fields (SSN, MRN) via
      `src/lib/crypto` / `src/lib/encryption`.
- [ ] BAA in place with every subprocessor (Auth0, Change Healthcare, Zoom,
      NVIDIA NIM) before any PHI flows to them.
- [ ] Minimum-necessary access enforced via Auth0 RBAC + Postgres RLS.
- [ ] No PHI in logs, error messages, Sentry breadcrumbs, or test fixtures
      (AGENTS.md strict rule; existing `src/lib/sanitize`).

---

## 2. Phased Delivery

### Phase 1 — MVP (Core EHR, ~12 weeks)

Ships the minimum a practice needs to leave TherapyNotes: charts, notes,
scheduling, claims tracking, consent, audit, client portal v1, telehealth.

#### 2.1.1 Domain core (serial — everything depends on this)

- [ ] **F1.0 FHIR R4 type system** — `src/lib/ehr-native/types/`
  - zod schemas for: Patient, Practitioner, PractitionerRole, Encounter,
    Appointment, DocumentReference, Observation, Consent, Claim, ServiceRequest,
    Condition, AllergyIntolerance, MedicationRequest.
  - Reuse `src/lib/ehr/types.ts` FHIRResource base; do not duplicate.
  - **Dep:** none. **Blocks:** F1.1, F1.2, F1.3, F1.4, F1.5, F1.6.

- [ ] **F1.1 Postgres schema + RLS** — `db/migrations/ehr_native/`
  - Tables: `ehr_patient`, `ehr_practitioner`, `ehr_encounter`,
    `ehr_appointment`, `ehr_document_reference`, `ehr_observation`,
    `ehr_consent`, `ehr_claim`, `ehr_service_request`, `ehr_audit_history`.
  - Each table stores FHIR JSONB + indexed search columns.
  - RLS policies per tenant + per role (extend ADR-001 pattern).
  - **Dep:** F1.0. **Blocks:** all repositories.

- [ ] **F1.2 FHIR R4 internal server** — `src/lib/ehr-native/fhir/`
  - REST endpoint at `/fhir/r4/{ResourceType}` supporting `GET/{id}`, `POST`,
    `PUT`, `DELETE`, `GET?search`, `/{id}/_history`.
  - CapabilityStatement at `/fhir/r4/metadata`.
  - Validation pipeline (zod → persist → audit → index).
  - **Dep:** F1.0, F1.1.

- [ ] **F1.3 Audit bridge** — `src/lib/ehr-native/audit/`
  - Every FHIR write emits an event to `src/lib/audit/log.ts`
    (`createHIPAACompliantAuditLog`) with resourceType, resourceId, action,
    user, tenant, IP, UA, session.
  - Tamper-evident chain (`verifyAuditChain`) extended to EHR events.
  - **Dep:** F1.2. **Blocks:** every write path.

- [ ] **F1.4 Consent engine v1** — `src/lib/ehr-native/consent/`
  - Per-treatment-type consent records (FHIR Consent resource).
  - Expiry alerts via existing `ConsentExpiryService`.
  - Digital signature capture (FHIR Provenance).
  - **State-by-state rules DEFERRED to Phase 3** (validator flagged; MVP ships a
    single configurable ruleset + per-state override hook).
  - **Dep:** F1.0, F1.2, F1.3.

- [ ] **F1.5 RBAC roles** — extend `src/lib/auth/auth0-rbac-service`
  - Roles: `ehr:clinician`, `ehr:supervisor`, `ehr:biller`, `ehr:client`,
    `ehr:admin`, `ehr:read-only-auditor`.
  - Permission matrix documented in `docs/architecture/ehr-rbac.md`.
  - **Dep:** none (parallel with F1.0). **Blocks:** API routes.

- [ ] **F1.6 API surface v1** — `src/lib/ehr-native/api/` +
      `src/pages/api/ehr/v1/`
  - REST: `/patients`, `/encounters`, `/appointments`, `/notes`, `/claims`,
    `/consents`, `/observations`.
  - OpenAPI 3.1 spec generated via `codegen.ts`; linted by `.spectral.yaml`.
  - **Dep:** F1.2, F1.3, F1.5. **Blocks:** all UI.

#### 2.1.2 Feature tracks (parallel after F1.6)

- [ ] **F1.7 Chart management** — `src/components/ehr/charts/`
  - Patient chart CRUD, demographics, insurance, emergency contact, treatment
    history timeline.
  - **Dep:** F1.6.

- [ ] **F1.8 Modality note templates** — `src/components/ehr/notes/` +
      `src/lib/ehr-native/services/note-template.service.ts`
  - Templates: CBT, DBT, EMDR, Psychodynamic, Somatic, IFS, EFT, Gottman,
    General Intake, Progress, Termination.
  - Each template: configurable fields, smart auto-population from last
    encounter (presenting problem, medications, risk flags).
  - Real-time note capture with autosave (Redis lease + Postgres write).
  - **Dep:** F1.6, F1.7.

- [ ] **F1.9 Scheduling** — `src/components/ehr/scheduling/` +
      `src/lib/ehr-native/services/scheduling.service.ts`
  - Calendar (day/week), recurring appointments, conflict detection,
    room/resource booking, waitlist.
  - FHIR Appointment + Schedule + Slot resources.
  - **Dep:** F1.6, F1.7.

- [ ] **F1.10 Claims tracking (clearinghouse API)** —
      `src/components/ehr/billing/` +
      `src/lib/ehr-native/services/claims.service.ts`
  - Integration: Change Healthcare Real-Time Eligibility API (or Availity).
  - Claim status tracking, denial alerts, one-click resubmission.
  - NOT a billing engine — no claim generation logic; claims are authored from
    encounters and submitted via clearinghouse.
  - **Dep:** F1.6, F1.7.

- [ ] **F1.11 Client portal v1** — `src/components/ehr/portal/`
  - Self-scheduling (available slots only), secure messaging (FHIR
    Communication), homework (DocumentReference), telehealth join link,
    statement view.
  - Auth via Auth0 with `ehr:client` role; separate login realm.
  - **Dep:** F1.6, F1.9.

- [ ] **F1.12 Native telehealth** — `src/components/ehr/telehealth/` +
      `src/lib/ehr-native/services/telehealth.service.ts`
  - Embedded WebRTC via `src/lib/websocket` + Zoom SDK fallback.
  - One-click start from appointment; auto-creates Encounter with pre-populated
    note template.
  - No separate login; session token minted from appointment.
  - **Dep:** F1.6, F1.9.

- [ ] **F1.13 Mobile-responsive shell** — `src/components/ehr/` shared layout
  - Mobile-first for notes, scheduling, messaging; desktop-optimized for chart
    review and billing.
  - Lighthouse mobile target: LCP < 2.5s, INP < 200ms (existing
    `.lighthouserc.json`).
  - **Dep:** F1.7–F1.12 (cross-cutting).

#### 2.1.3 Phase 1 gates (must pass before MVP ships)

- [ ] **G1.1** `pnpm typecheck` clean.
- [ ] **G1.2** `pnpm lint` clean (no suppressions — AGENTS.md strict rule).
- [ ] **G1.3** `pnpm vitest run -c config/vitest.config.ts` — unit + integration
      green; coverage ≥ 70% on `src/lib/ehr-native/`.
- [ ] **G1.4** `pnpm e2e:smoke` green for: login → create patient → write note →
      schedule → submit claim → client portal join.
- [ ] **G1.5** HIPAA audit log review: every write produces a chain-verified
      audit entry.
- [ ] **G1.6** FHIR R4 CapabilityStatement validated against the FHIR
      conformance checker (Inferno or Touchstone).
- [ ] **G1.7** Pen test pass on `/fhir/r4` and `/api/ehr/v1` endpoints.

### Phase 2 — AI-Assisted Tools + Marketplace (~10 weeks)

- [ ] **F2.1 AI note drafting from transcripts** — `ai/ehr/note_drafting/`
  - FastAPI service consuming telehealth transcript (with BAA in place).
  - Drafts SOAP/DAP note in the active modality template; clinician must review
    and sign. Never auto-saves as signed.
  - **Dep:** F1.8, F1.12 (transcript source).

- [ ] **F2.2 Risk stratification** — `ai/ehr/risk_stratification/`
  - Scores encounters against PHQ-9, GAD-7, C-SSRS inputs; flags high-risk for
    supervisor review.
  - **Dep:** F1.8, F2.4.

- [ ] **F2.3 Treatment plan suggestions** — `ai/ehr/treatment_plan_suggestions/`
  - Suggests goals + objectives based on diagnosis + outcome measures; clinician
    approves.
  - **Dep:** F2.4.

- [ ] **F2.4 Outcome measure trending** — `src/components/ehr/portal/` +
      `src/lib/ehr-native/services/outcomes.service.ts`
  - Client-facing visualization of PHQ-9, GAD-7, OQ-45 trending over time
    (creative's key differentiation).
  - FHIR Questionnaire + QuestionnaireResponse + Observation.
  - **Dep:** F1.6, F1.11.

- [ ] **F2.5 Integration marketplace v1** — `src/lib/ehr-native/integrations/`
  - Calendly (scheduling sync), Zoom (telehealth fallback), Stripe (client
    payments), Twilio (SMS reminders).
  - Each integration: OAuth + webhook + audit bridge.
  - **Dep:** F1.6.

- [ ] **F2.6 Open API + developer docs** — `docs/developers/ehr-api.md`
  - Public OpenAPI 3.1 + FHIR CapabilityStatement; sandbox tenant.
  - **Dep:** F1.6.

#### Phase 2 gates

- [ ] **G2.1** AI drafts never auto-sign; clinician signature is a separate
      audited action (validator requirement).
- [ ] **G2.2** Risk stratification has a documented false-negative rate;
      supervisor review queue exists for every high-risk flag.
- [ ] **G2.3** All AI services run with BAA + no PHI leaves the tenant boundary
      without one.

### Phase 3 — Analytics, Compliance Hardening, Mobile Parity (~8 weeks)

- [ ] **F3.1 Customizable dashboards** — `src/components/ehr/dashboards/`
  - Practice analytics: caseload, no-show rate, revenue, outcome averages.
  - Configurable widgets; saved per user.
  - **Dep:** F1.6, F2.4.

- [ ] **F3.2 Supervisor tools** — `src/components/ehr/supervisor/`
  - Caseload overview, note review queue, co-sign workflow, risk-flag queue.
  - **Dep:** F1.5, F2.2.

- [ ] **F3.3 State-by-state consent engine** —
      `src/lib/ehr-native/consent/state-rules/`
  - Configurable ruleset per US state (age of consent, mandated reporting,
    treatment-type consent requirements).
  - Loaded from versioned JSON config; legal review sign-off required.
  - **Dep:** F1.4. **Risk:** R-CONSENT-01 (see §4).

- [ ] **F3.4 HIE + e-prescribing integrations** —
      `src/lib/ehr-native/integrations/`
  - HIE: Carequality or DirectTrust; e-prescribing: DoseSpot or DrFirst (NOT
    custom — skeptic killed custom e-prescribing).
  - **Dep:** F1.2, F2.5.

- [ ] **F3.5 Mobile parity hardening** — `src/components/ehr/`
  - Feature parity audit: every Phase 1 + 2 surface works on mobile.
  - PWA install; offline note drafting with sync-on-reconnect.
  - **Dep:** F1.13, F2.*. **Risk:** R-MOBILE-01.

- [ ] **F3.6 Automated compliance reports** —
      `src/lib/ehr-native/audit/reports/`
  - SOC 2 / HIPAA evidence export: access logs, consent history, breach
    detection summaries.
  - **Dep:** F1.3.

#### Phase 3 gates

- [ ] **G3.1** State-by-state consent rules reviewed by legal for every state
      the practice operates in.
- [ ] **G3.2** Mobile parity audit: every surface passes Lighthouse mobile
      thresholds + Playwright mobile viewport tests.
- [ ] **G3.3** Compliance report export validated against a SOC 2 evidence
      template.

---

## 3. Feature Breakdown (Work Items with Dependencies)

| ID    | Feature                      | Phase | Deps             | Est |
| ----- | ---------------------------- | ----- | ---------------- | --- |
| F1.0  | FHIR R4 type system          | 1     | —                | 5d  |
| F1.1  | Postgres schema + RLS        | 1     | F1.0             | 4d  |
| F1.2  | FHIR R4 internal server      | 1     | F1.0, F1.1       | 6d  |
| F1.3  | Audit bridge                 | 1     | F1.2             | 3d  |
| F1.4  | Consent engine v1            | 1     | F1.0, F1.2, F1.3 | 4d  |
| F1.5  | RBAC roles                   | 1     | —                | 2d  |
| F1.6  | API surface v1               | 1     | F1.2, F1.3, F1.5 | 5d  |
| F1.7  | Chart management             | 1     | F1.6             | 5d  |
| F1.8  | Modality note templates      | 1     | F1.6, F1.7       | 8d  |
| F1.9  | Scheduling                   | 1     | F1.6, F1.7       | 6d  |
| F1.10 | Claims tracking              | 1     | F1.6, F1.7       | 6d  |
| F1.11 | Client portal v1             | 1     | F1.6, F1.9       | 7d  |
| F1.12 | Native telehealth            | 1     | F1.6, F1.9       | 6d  |
| F1.13 | Mobile-responsive shell      | 1     | F1.7–F1.12       | 4d  |
| F2.1  | AI note drafting             | 2     | F1.8, F1.12      | 8d  |
| F2.2  | Risk stratification          | 2     | F1.8, F2.4       | 5d  |
| F2.3  | Treatment plan suggestions   | 2     | F2.4             | 5d  |
| F2.4  | Outcome measure trending     | 2     | F1.6, F1.11      | 5d  |
| F2.5  | Integration marketplace v1   | 2     | F1.6             | 6d  |
| F2.6  | Open API + dev docs          | 2     | F1.6             | 3d  |
| F3.1  | Customizable dashboards      | 3     | F1.6, F2.4       | 6d  |
| F3.2  | Supervisor tools             | 3     | F1.5, F2.2       | 5d  |
| F3.3  | State-by-state consent       | 3     | F1.4             | 6d  |
| F3.4  | HIE + e-prescribing          | 3     | F1.2, F2.5       | 8d  |
| F3.5  | Mobile parity hardening      | 3     | F1.13, F2.*      | 6d  |
| F3.6  | Automated compliance reports | 3     | F1.3             | 4d  |

**Total estimate:** ~12 weeks Phase 1 (with 2 engineers parallel after F1.6),
~10 weeks Phase 2, ~8 weeks Phase 3. Assumes the existing audit/consent/auth
primitives are reused, not rebuilt.

---

## 4. Risk Register (Adversarial Findings to Mitigate)

| ID            | Risk                                                                     | Source                | Severity | Mitigation                                                                                                                                                                                         | Owner                |
| ------------- | ------------------------------------------------------------------------ | --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| R-CONSENT-01  | State-by-state consent legal variation mishandled → malpractice exposure | Validator             | High     | Phase 1 ships single configurable ruleset + per-state override hook (no per-state logic in MVP). Phase 3 implements per-state rules with legal sign-off. Config is versioned JSON, not code.       | Backend lead + legal |
| R-AUDIT-01    | Incomplete audit trail → HIPAA violation                                 | Validator             | High     | Every FHIR write goes through `validateResource() → persist() → audit.log()` pipeline (F1.3). Chain verification (`verifyAuditChain`) extended to EHR events. Gate G1.5 blocks ship on audit gaps. | Backend lead         |
| R-FHIR-01     | FHIR R4 non-conformance → integration failures + marketplace rejection   | Architect             | High     | CapabilityStatement published (F1.2); validated with Inferno/Touchstone (G1.6). All resources zod-validated against R4 spec.                                                                       | Backend lead         |
| R-MOBILE-01   | Mobile parity drift → re-creates TherapyNotes' mobile gap                | Creative + UX         | Medium   | Mobile-first from F1.13; Lighthouse mobile thresholds in CI (existing `.lighthouserc.json`); Playwright mobile viewport tests in G3.2.                                                             | Frontend lead        |
| R-AI-01       | AI auto-signs notes → clinical error + liability                         | Skeptic               | High     | AI drafts never auto-sign (G2.1). Clinician signature is a separate audited action. Phase 2 only, never MVP.                                                                                       | AI lead              |
| R-AI-02       | PHI leaks to AI subprocessor without BAA                                 | Validator             | High     | BAA required before any PHI flows to NIM/Zoom/transcription (G2.3). Field-level encryption for inference; FHE where feasible (existing `src/lib/fhe`).                                             | Security lead        |
| R-BILLING-01  | Scope creep into building a billing engine                               | Skeptic (killed)      | Medium   | Hard scope line: clearinghouse API only (F1.10). No claim generation logic, no AR aging, no patient statements. Document in ADR-003.                                                               | Product              |
| R-EHR-EPIC-01 | Custom e-prescribing from scratch                                        | Skeptic (killed)      | Medium   | Integrate DoseSpot/DrFirst (F3.4). Never build. Document in ADR-004.                                                                                                                               | Product              |
| R-RESEARCH-01 | Feature prioritization without practitioner validation                   | Researcher            | Medium   | **Accepted — product skipped interviews.** Proceeding on competitive analysis. Phase 2/3 scope may need adjustment post-launch based on user feedback.                                             | Product              |
| R-SCOPE-01    | AI-first MVP temptation                                                  | Skeptic (killed)      | Medium   | Phase 1 has zero AI features. Phase 2 AI is layered on a shipped core EHR.                                                                                                                         | Product              |
| R-SEC-01      | Secrets/PHI in code, logs, fixtures                                      | AGENTS.md strict rule | High     | No suppressions; `src/lib/sanitize` on all log paths; `pnpm lint:no-suppressions` in CI; secret scan in pre-commit.                                                                                | Security lead        |
| R-TENANT-01   | Cross-tenant PHI leakage                                                 | ADR-001               | High     | Postgres RLS on every EHR table (F1.1); tenant_id enforced in every query via repository layer; pen test G1.7.                                                                                     | Backend lead         |

---

## 5. Success Metrics (Filling TherapyNotes' Gaps)

Measured against the 15 distilled insights. Each metric has a target and a
measurement method.

### 5.1 UX/UI & Workflow

| Metric                                                 | Target                                         | Method                                   |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| Clicks to complete a progress note                     | < TherapyNotes baseline (measure in user test) | Playwright click-count on note-save flow |
| Mobile Lighthouse score (notes, scheduling, messaging) | ≥ 90 perf, ≥ 95 a11y                           | CI Lighthouse on P3 routes               |
| Time-to-first-note (new user)                          | < 15 min                                       | Onboarding telemetry                     |

### 5.2 Note Templates

| Metric                                 | Target                                                          | Method                              |
| -------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Modality templates available at launch | ≥ 8 (CBT, DBT, EMDR, Psychodynamic, Somatic, IFS, EFT, Gottman) | Config count                        |
| Auto-population fields per template    | ≥ 5 (presenting problem, meds, risk, last goal, homework)       | Template schema audit               |
| Autosave interval                      | ≤ 2s                                                            | Redis lease + Postgres write timing |

### 5.3 Billing & Claims

| Metric                    | Target                                 | Method                    |
| ------------------------- | -------------------------------------- | ------------------------- |
| Eligibility check latency | < 5s (clearinghouse API)               | Endpoint timing telemetry |
| Claim status visibility   | 100% of submitted claims have a status | Claims table audit        |
| Resubmission clicks       | 1                                      | UI flow audit             |

### 5.4 Integration & Interoperability

| Metric                                | Target                               | Method                |
| ------------------------------------- | ------------------------------------ | --------------------- |
| FHIR R4 conformance                   | Inferno + Touchstone pass            | G1.6                  |
| Integrations in marketplace (Phase 2) | ≥ 4 (Calendly, Zoom, Stripe, Twilio) | Marketplace registry  |
| Open API completeness                 | 100% of Phase 1 endpoints documented | OpenAPI lint coverage |

### 5.5 Client Experience

| Metric                                         | Target                     | Method                      |
| ---------------------------------------------- | -------------------------- | --------------------------- |
| Portal self-schedule completion                | < 60s                      | Portal telemetry            |
| Secure messages sent per active client / month | ≥ 1 (engagement proxy)     | Messaging table             |
| Outcome measure completion rate                | ≥ 70% of assigned measures | QuestionnaireResponse table |

### 5.6 Telehealth

| Metric                                  | Target                                           | Method          |
| --------------------------------------- | ------------------------------------------------ | --------------- |
| Telehealth join clicks from appointment | 1                                                | UI flow audit   |
| Note pre-population rate                | 100% of telehealth encounters start with a draft | Encounter table |
| Separate login required                 | Never                                            | Auth flow audit |

### 5.7 Reporting & Analytics

| Metric                                   | Target              | Method          |
| ---------------------------------------- | ------------------- | --------------- |
| Customizable dashboard widgets (Phase 3) | ≥ 10                | Widget registry |
| Outcome trend charts available           | PHQ-9, GAD-7, OQ-45 | Chart registry  |

### 5.8 Compliance & Security

| Metric                             | Target                                               | Method                   |
| ---------------------------------- | ---------------------------------------------------- | ------------------------ |
| Audit log chain verification       | 100% pass                                            | `verifyAuditChain` in CI |
| Consent records per treatment type | 100% of active treatments have a non-expired consent | Consent table audit      |
| Compliance report export           | SOC 2 template validated                             | G3.3                     |
| Pen test findings (Phase 1 ship)   | 0 critical, 0 high                                   | G1.7                     |

### 5.9 AI-Assisted Tools (Phase 2)

| Metric                         | Target                                  | Method                         |
| ------------------------------ | --------------------------------------- | ------------------------------ |
| AI draft adoption rate         | ≥ 60% of clinicians use at least weekly | Draft usage telemetry          |
| AI draft edit rate before sign | ≥ 80% (safety: clinicians are reading)  | Note version diff              |
| Risk flag false-negative rate  | Documented + < 5%                       | Risk stratification eval suite |

---

## 6. Sequencing — Parallel vs. Serial

### 6.1 Phase 1 critical path (serial)

```
F1.0 (types) → F1.1 (schema) → F1.2 (FHIR server) → F1.3 (audit) → F1.6 (API)
            → F1.7 (charts) → F1.8 (notes) / F1.9 (scheduling) [parallel]
            → F1.10 (claims) / F1.11 (portal) / F1.12 (telehealth) [parallel]
            → F1.13 (mobile shell, cross-cutting)
            → G1.* gates
```

### 6.2 Phase 1 parallel tracks (after F1.6 unblocks)

- **Track A (clinician):** F1.7 → F1.8 → F1.9
- **Track B (billing):** F1.10 (can start once F1.7 lands patient/encounter)
- **Track C (client):** F1.11 (needs F1.9 for self-schedule)
- **Track D (telehealth):** F1.12 (needs F1.9 for appointment join)
- **Track E (cross-cutting):** F1.13 runs alongside all of the above
- **Track F (parallel from day 1):** F1.5 (RBAC) — no dep on F1.0–F1.2

### 6.3 Phase 2 parallel tracks

- **Track A (AI):** F2.4 (outcomes) → F2.1 (drafting) → F2.2 (risk) → F2.3
  (plans)
- **Track B (marketplace):** F2.5 (integrations) — parallel with Track A
- **Track C (docs):** F2.6 (open API) — parallel, low effort

### 6.4 Phase 3 parallel tracks

- **Track A (analytics):** F3.1 (dashboards) + F3.2 (supervisor)
- **Track B (compliance):** F3.3 (state consent) + F3.6 (compliance reports)
- **Track C (interop):** F3.4 (HIE + e-Rx)
- **Track D (mobile):** F3.5 (parity) — cross-cutting, runs last

### 6.5 Hard serial dependencies (never parallelize)

- F1.0 → F1.1 → F1.2 → F1.3 → F1.6 (the spine)
- F1.4 depends on F1.3 (audit must exist before consent records)
- F2.1 depends on F1.8 (templates must exist before AI drafts them)
- F2.2 depends on F2.4 (outcome measures must exist before risk stratification)
- F3.3 depends on F1.4 (state rules extend the consent engine)
- F3.4 depends on F1.2 (HIE/e-Rx flow through the FHIR server)

---

## 7. Open Questions (assume-and-proceed, flag for product)

1. **Clearinghouse vendor:** ~~Change Healthcare vs. Availity~~ **RESOLVED:
   Change Healthcare.** Confirmed by product.
2. **Telehealth transport:** ~~WebRTC-first vs. Zoom-first~~ **RESOLVED:
   WebRTC-first (native), Zoom fallback.** Confirmed by product.
3. **AI model for Phase 2:** ~~NIM-hosted vs. self-hosted~~ **RESOLVED: NIM on
   Hetzner.** Confirmed by product.
4. **State consent rules source:** ~~In-house legal vs. third-party compliance
   service~~ **RESOLVED: In-house legal + versioned JSON config.** Confirmed by
   product.
5. **Customer interviews:** ~~Researcher demanded these before Phase 2
   prioritization.~~ **RESOLVED: SKIPPED.** Product decided to proceed on
   competitive analysis already done; no practitioner interviews scheduled. Risk
   R-RESEARCH-01 accepted.

---

## 8. ADRs to write before implementation starts

- [ ] **ADR-002: FHIR R4 as canonical internal data model**
- [ ] **ADR-003: Clearinghouse API for billing — no in-house billing engine**
- [ ] **ADR-004: Vendor integration for e-prescribing — no custom build**
- [ ] **ADR-005: EHR RBAC role matrix**
- [ ] **ADR-006: Audit chain extension for EHR events**
- [ ] **ADR-007: Consent state-rules config format (versioned JSON)**

---

## 9. Definition of Done (per feature)

A feature is done when ALL of:

1. zod-validated types; no `any`, no suppressions (AGENTS.md).
2. Unit + integration tests in Vitest (or pytest for `ai/ehr/`); ≥ 70% coverage
   on new code.
3. Audit log emitted for every write path.
4. RBAC enforced on every endpoint.
5. OpenAPI + FHIR CapabilityStatement updated.
6. `pnpm typecheck && pnpm lint && pnpm test:unit` green.
7. Playwright e2e for the user-facing flow.
8. Documentation updated in `docs/developers/ehr-api.md` or
   `docs/architecture/ehr-*.md`.

---

## 10. First-week kickoff checklist

- [ ] Write ADR-002 through ADR-007.
- [ ] Create `src/lib/ehr-native/` skeleton (types, services, repositories,
      fhir, audit, consent, api, `__tests__`).
- [ ] Create `src/components/ehr/` skeleton (charts, notes, scheduling, billing,
      portal, telehealth, `__tests__`).
- [ ] Create `db/migrations/ehr_native/` directory.
- [ ] ~~Schedule customer interviews (researcher requirement) for weeks 1–2.~~
      Skipped per product decision.
- [ ] ~~Confirm clearinghouse vendor (Open Question 1).~~ Resolved: Change
      Healthcare.
- [ ] ~~Confirm telehealth transport (Open Question 2).~~ Resolved:
      WebRTC-first, Zoom fallback.
- [ ] Stand up the F1.0 type system as the first PR; everything else blocks on
      it.
