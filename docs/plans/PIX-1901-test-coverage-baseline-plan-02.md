# PIX-1901: Test Coverage Baseline (Plan 02)

**Status:** Implementation Ready **Assignee:** Chad **Priority:** P2
**Related:** PIX-160, PIX-3762

---

## Executive Summary

This plan establishes the methodology and phased rollout for raising test
coverage across the Pixelated Empathy clinical platform codebase. It defines
measurement points, gating thresholds, and dependencies between the coverage
audit (PIX-160) and the TypeScript strict-mode tracker (PIX-3762).

---

## Current Baseline

| Metric                       | Value | Source                                       |
| ---------------------------- | ----- | -------------------------------------------- |
| Total TS source files        | 1,427 | find + exclusion filters                     |
| Total test files             | ~711  | *.test.ts, *.spec.ts, **tests**              |
| Vitest threshold: lines      | 55%   | config/vitest.config.ts:338                  |
| Vitest threshold: functions  | 55%   | config/vitest.config.ts:339                  |
| Vitest threshold: branches   | 45%   | config/vitest.config.ts:340                  |
| Vitest threshold: statements | 55%   | config/vitest.config.ts:341                  |
| Target (security baseline)   | 70%   | security-baseline.json                       |
| Production-readiness gate    | >=70% | src/pages/api/v1/production-readiness.ts:236 |

## Gating Logic

- **PASS:** coverage >= 70%
- **WARNING:** coverage 55-69%
- **FAIL:** coverage < 55%

The thresholds are deliberately kept ~6pp below actual current values (see
comment in vitest.config.ts:335-341) so CI stays green while real progress is
enforced.

---

## Phased Rollout

### Phase 1: Infrastructure (Week 1)

| Task                         | Issue    | Deliverable                               |
| ---------------------------- | -------- | ----------------------------------------- |
| Baseline measurement harness | PIX-160  | scripts/ci/coverage-audit-report.json     |
| Strict mode tracker fix      | PIX-3762 | scripts/ci/ts-strict-mode-tracker.ts v2.0 |

**Phase 1 Exit Criteria:**

- Coverage audit runs without environment timeout
- strict-mode-progress.json updates on every CI run
- production-readiness.ts exposes coverage per module

### Phase 2: Critical Path (Weeks 2-3)

Target modules with direct HIPAA/privacy impact:

| Module         | Prod Files | Priority | Action                                         |
| -------------- | ---------- | -------- | ---------------------------------------------- |
| lib/encryption | 1          | P0       | Add unit tests for AES-256-GCM, key rotation   |
| lib/security   | 53         | P0       | Expand **tests**/security-*.test.ts            |
| lib/logging    | 9          | P0       | Cover audit log redaction, fallback paths      |
| middleware     | 5          | P0       | Cover auth guards, rate-limit middleware       |
| config         | 19         | P0       | Cover env parsing, feature flags               |
| lib/auth       | 38         | P1       | Expand **tests**/middleware.test.ts, MFA flows |
| lib/audit      | 8          | P1       | Cover chain verification, genesis validation   |
| lib/db         | 20         | P1       | Cover connection pooling, transaction rollback |
| lib/memory     | 37         | P1       | Cover memory CRUD, consent filters             |
| types          | 50         | P1       | Cover type guards, brand checks                |

**Phase 2 Exit Criteria:**

- All 10 P0/P1 modules reach >= 55% coverage
- Security baseline tests (PIX-164) remain green

### Phase 3: Supporting Modules (Weeks 4-5)

| Module  | Prod Files | Priority | Action                                   |
| ------- | ---------- | -------- | ---------------------------------------- |
| lib/ehr | 12         | P2       | Cover HL7 parse, FHIR mapping            |
| lib/fhe | 34         | P2       | Cover key rotation, parameter validation |
| hooks   | 46         | P2       | Cover custom React hooks                 |
| utils   | 40         | P2       | Cover date/number/string utilities       |

**Phase 3 Exit Criteria:**

- All P2 modules reach >= 45% coverage
- No new suppressions added

### Phase 4: Scale Modules (Weeks 6-8)

| Module       | Prod Files | Priority | Action                                       |
| ------------ | ---------- | -------- | -------------------------------------------- |
| lib/ai       | 172        | P3       | Targeted tests for highest-risk AI paths     |
| lib/services | 53         | P3       | Cover Redis, notification, training services |
| components   | 71         | P3       | Cover AIChat, evaluation panels              |
| pages/api    | 203        | P3       | Cover high-traffic API routes                |

**Phase 4 Exit Criteria:**

- Aggregate coverage >= 60%
- production-readiness.ts reports >= 60%

### Phase 5: Baseline Lock (Week 9)

- Raise Vitest thresholds to match new actuals
- Enable noUnusedLocals + noUnusedParameters in root tsconfig.json
- Mark Phase 1-4 modules as clean in strict-mode-progress.json

---

## Measurement Commands

```bash
# Coverage audit
VITEST_COVERAGE_ENABLED=true pnpm vitest run -c config/vitest.config.ts

# Per-module strict mode
pnpm tsx scripts/ci/ts-strict-mode-tracker.ts --write-json

# Security baseline validation
pnpm vitest run src/lib/security/__tests__/security-baseline-policy.test.ts
```

---

## Risks & Mitigations

| Risk                                      | Mitigation                                          |
| ----------------------------------------- | --------------------------------------------------- |
| Full test run exceeds 30s timeout         | Use targeted runs; exclude CPU-bound perf tests     |
| External service deps (Redis, MongoDB)    | Use mocks/in-memory servers in unit tests           |
| Third-party type mismatches (Auth0, SEAL) | Wrap in local adapters; suppress only in test mocks |
| Scope creep on 1,427-file codebase        | Stick to P0/P1 first; P3 deferred if needed         |

---

## Dependencies

- PIX-160: Coverage audit report (feeds this plan's baseline metrics)
- PIX-3762: Strict mode tracker (feeds migration tracking)
- PIX-223: Test Coverage & Security Baseline (overall parent)
- PIX-164: HIPAA Tests (TypeScript) — must stay green throughout

---

## Success Criteria

1. All 18 tracked modules have coverage >= 45%
2. P0/P1 modules (10 modules) have coverage >= 55%
3. Strict mode tracker reports < 50 total errors across all 18 modules
4. Security baseline tests pass on every CI run
5. Production-readiness checks pass with test-coverage >= 55
