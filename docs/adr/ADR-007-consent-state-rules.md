# ADR-007: Consent State-Rules Config Format (Versioned JSON)

**Status**: Accepted  
**Date**: 2026-08-19  
**Author**: Backend Platform Engineer

## Context

The EHR module build plan (F1.4, F3.3) requires a consent engine handling
per-treatment-type consent records, expiry tracking, and state-by-state legal
variation. The platform already has `src/lib/consent/ ConsentExpiryService.ts`
which tracks consent expiry via `ConsentRecord` and `ConsentLevel` types with
batch checking, but not state-specific rules.

The adversarial review's validator flagged state-by-state consent mishandling as
High severity malpractice exposure (plan risk R-CONSENT-01). Consent rules vary
by state: age of consent (California 12+, New York 18+), mandated reporting
thresholds, treatment types requiring explicit consent. The plan resolves this
with a phased approach: Phase 1 ships a single configurable ruleset with a
per-state override hook; Phase 3 implements per-state rules with legal sign-off.
Open Question 4 is resolved: in-house legal + versioned JSON config.

## Decision 1: State-by-State Consent Rules as Versioned JSON Config

**Chosen**: State-by-state consent rules stored as versioned JSON config files
in `src/lib/ehr-native/consent/state-rules/` keyed by state code  
**Rejected**: Hardcoded rules in code; external rules engine service;
database-driven rules

### Rationale

- Consent rules change with legislation; JSON is reviewable by legal counsel
  (non-engineers), versionable via git, carries audit trail of sign-offs
- Hardcoded rules hide legal logic in code; external rules engine adds vendor
  dependency and BAA; database-driven rules lack git-history audit
- Config is bundled so changes require deploy — acceptable given legal review
  cadence

### Implementation

- Config files in `src/lib/ehr-native/consent/state-rules/` keyed by 2-letter
  state code (e.g., `CA.json`, `NY.json`); `default.json` is the Phase 1
  fallback when no state-specific file exists
- Each config file defines: `stateCode`, `ageOfConsent`, `mandatedReportingAge`,
  `treatmentTypesRequiringConsent` (array), `consentValidityPeriod` (days),
  `minorConsentRules`, `expirationRules`, `requiredFields` (on FHIR `Consent`),
  `version`, `legalReviewDate`, `legalReviewer`
- Config validated by zod schema (`StateConsentRulesSchema`) at load time

## Decision 2: Phased Rollout — Single Ruleset Then Per-State

**Chosen**: Phase 1 ships `default.json` with per-state override hook; Phase 3
implements per-state rules with legal sign-off  
**Rejected**: Full per-state in Phase 1; deferring all consent rules to Phase 3

### Rationale

- Phase 1 cannot ship per-state rules without legal review for every state
  (R-CONSENT-01); single ruleset with override hook lets Phase 1 ship safely
  with conservative defaults (consent for all treatment types, 18+)
- Deferring all consent rules to Phase 3 would block Phase 1 MVP — consent
  tracking is core (F1.4)

### Implementation

- Phase 1 (F1.4): `default.json` with conservative rules; engine loads default,
  checks for state override; if none, default applies
- Phase 3 (F3.3): per-state JSON files with legal sign-off; engine loads
  state-specific file based on `Patient.address.state` (ADR-002)
- Override hook: if `state-rules/{stateCode}.json` exists, it overrides
  `default.json`

## Decision 3: Versioning via Git + Semantic Versioning with Legal Sign-Off

**Chosen**: Config versioned via git with semantic versioning; changes require
legal review and sign-off commit  
**Rejected**: Unversioned config; database versioning; external versioning

### Rationale

- Git history provides complete audit trail of who changed what rule and when —
  essential for malpractice defense
- Semantic versioning signals breaking (major), additions (minor),
  clarifications (patch)
- Legal sign-off as commit requirement ensures no rule ships without review
  (mitigation for R-CONSENT-01); Gate G3.1 blocks Phase 3 ship until per-state
  rules reviewed

### Implementation

- Each config file has `version`, `legalReviewDate`, `legalReviewer` fields
- Pre-commit hook / CI check verifies changes to `state-rules/*.json` include
  updated `legalReviewDate` and `legalReviewer`
- Consent engine logs active ruleset version in consent audit events (ADR-006);
  major version bumps require a new ADR

## Decision 4: Extend Existing ConsentExpiryService

**Chosen**: Consent engine extends `src/lib/consent/ ConsentExpiryService.ts`
rather than replacing it  
**Rejected**: New consent service from scratch; replacing ConsentExpiryService
entirely

### Rationale

- `ConsentExpiryService` handles expiry tracking, thresholds, batch checking —
  reusable; `ConsentRecord` / `ConsentLevel` types compatible with FHIR
  `Consent` (ADR-002); extending avoids breaking existing code

### Implementation

- `src/lib/ehr-native/consent/` (F1.4) wraps `ConsentExpiryService`, adds
  `StateConsentRulesEngine` (loads JSON config, returns `ConsentDecision`) and
  `ConsentValidator` (validates FHIR `Consent` against state ruleset); consent
  records are FHIR R4 `Consent` per ADR-002

## Consequences

### Positive

- Consent rules reviewable by legal counsel without engineering involvement
- Git history provides complete audit trail with legal sign-off — malpractice
  defense ready
- Phased rollout lets Phase 1 ship safely with conservative defaults
- Extends existing `ConsentExpiryService` — no rewrite of expiry tracking

### Negative

- Config changes require a deploy — rule updates are not instant
- Legal sign-off is a serial dependency for Phase 3 per-state rollout
- Conservative default may require consent where permissive states do not
- Malformed rule could silently apply incorrect logic (zod is the only gate)

### Mitigations

- Hot-reload can be added later if deploy latency is a problem
- Phase 3 legal review scheduled early (gate G3.1); default ruleset documented
  as conservative; practices override with state-specific file
- zod validation at load catches malformed config; integration tests verify
  correct decisions per state

## Related Decisions

- ADR-001: Zero-PHI guards, audit log foundation
- ADR-002: Consent records are FHIR R4 `Consent` stored as JSONB
- ADR-005: `ehr:clinician` and `ehr:client` consent access scoped by role
- ADR-006: Consent changes trigger double-audit; ruleset version in audit
  metadata
