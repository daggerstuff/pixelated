# Final Acceptance Review — CI Federation Gates

**Date:** 2026-07-30
**Reviewer:** Chad
**Project:** CI Federation & Release Readiness (PIX-1875)

---

## 1. Validation Lane Inventory

### GitHub Actions (28 workflows)

| Category                  | Workflow                   | Trigger                               | Gate?                        | Status                        |
| ------------------------- | -------------------------- | ------------------------------------- | ---------------------------- | ----------------------------- |
| **Core CI**               | `ci.yml`                   | Push/PR → staging                     | ✅ (all `continue-on-error`) | 🟢 Active                     |
| **Security**              | `security.yml`             | Push/PR → main/master/staging + daily | ✅                           | 🟢 Active                     |
| **Security (deprecated)** | `security-scanning.yml`    | —                                     | ❌ Deprecated                | 🟢 Pending removal 2026-08-31 |
| **Workflow lint**         | `actionlint.yml`           | Push/PR → staging (workflow changes)  | ✅                           | 🟢 Active                     |
| **DB migration**          | `migration-validation.yml` | Push/PR → main/staging (db changes)   | ✅                           | 🟢 Active                     |
| **OpenAPI**               | `openapi-validation.yml`   | Push/PR → main/staging (api changes)  | ✅                           | 🟢 Active                     |
| **AI validation**         | `ai-validation.yml`        | Scheduled daily + manual              | ✅                           | 🟢 Active                     |
| **Bias detection**        | `bias-detection-ci.yml`    | Push/PR → main/master/staging         | ✅                           | 🟢 Active                     |
| **Browser tests**         | `browser-tests.yml`        | Push/PR → main/master/staging         | ✅                           | 🟢 Active                     |
| **Playwright E2E**        | `playwright.yml`           | Push/PR → main/master/staging         | ✅                           | 🟢 Active                     |
| **Performance**           | `lighthouse.yml`           | Push/PR → staging                     | ✅                           | 🟢 Active                     |
| **Deploy (Civo K3s)**     | `deploy-civo.yml`          | Push → main                           | ✅ Release gate              | 🟢 Active                     |
| **Docs deploy**           | `docs-deploy.yml`          | Push → main/staging                   | ⚪ Informational             | 🟢 Active                     |
| **Remaining 15**          | various                    | schedule/manual/webhook               | ⚪ Varies                    | 🟢 Active                     |

### Bitbucket Pipelines

| Pipeline                                 | Path conditions              | Gate? | Status     |
| ---------------------------------------- | ---------------------------- | ----- | ---------- |
| `bitbucket-pipelines.yml` (root)         | ✅ AI steps gated by `ai/**` | ✅    | 🟢 Active  |
| `ai/bitbucket-pipelines.yml` (submodule) | N/A (submodule-owned)        | ✅    | 🟢 Active  |
| `ci-cd/bitbucket-pipelines.yaml`         | —                            | ❌    | 🟢 Removed |

### Readiness Aggregator

| Component                                 | Status                        | Notes                                       |
| ----------------------------------------- | ----------------------------- | ------------------------------------------- |
| `aggregate-readiness.py`                  | 🟢 Works (dry-run: 100% pass) | Provider fetch needs `GITHUB_TOKEN`         |
| `release-readiness-schema.json` (config/) | 🟢 Published v1.0             | New format with `meta`, `providerPipelines` |
| `test_aggregate_readiness.py`             | 🟢 34/34 pass                 | Full coverage                               |
| `ci-cd/release-readiness.json`            | 🟡 Sample uses old format     | Needs migration to new schema               |

---

## 2. Gates Assessment

### ✅ Active Gates (block on failure)

- `actionlint.yml` — blocks on workflow YAML errors (exit code propagated)
- `migration-validation.yml` — blocks on migration failure (dry-run + forward + rollback tests)
- `openapi-validation.yml` — blocks on invalid API specs

### ⚠️ Soft Gates (continue-on-error)

- `ci.yml` — **all steps use `continue-on-error: true`** including lint, tests, and Trivy scan. The security gate step warns but does not fail the job. Lint/test failures and
  - CRITICAL/HIGH vulnerabilities are logged but do not block PRs or deploys.
- **Impact:** CI federations's primary `ci.yml` gate is advisory-only. Consider removing `continue-on-error: true` on critical steps (unit tests, security gate) to enforce
  - actual gating.

### ✅ Consolidated Workflows (completed)

- `codeql.yml` → merged into `security.yml` ✅
- `security-scanning.yml` → merged into `security.yml`, deprecated ✅
- `ci-cd/bitbucket-pipelines.yaml` → consolidated into root `bitbucket-pipelines.yml`, removed ✅

---

## 3. Remaining Gaps for BAU

| Gap                                                                      | Tracking Issue      | Priority |
| ------------------------------------------------------------------------ | ------------------- | -------- |
| Runbook + escalation map not yet written                                 | PIX-1879            | Medium   |
| `ci.yml` uses `continue-on-error: true` on all steps — soft gate only    | (no issue)          | High     |
| Provider pipeline fetch in aggregator needs credentials configured       | Operational concern | Medium   |
| Old schema files in `ci-cd/` should be migrated to new format or removed | (no issue)          | Low      |

| Dry-run promotion tests not yet executed | PIX-1913 | High |

---

## 4. Work Completed This Session

| Issue    | Title                                    | Status  |
| -------- | ---------------------------------------- | ------- |
| PIX-1873 | Readiness aggregator endpoint/script     | ✅ Done |
| PIX-1881 | Consolidate GitHub security lane         | ✅ Done |
| PIX-1893 | Consolidate Bitbucket AI validation lane | ✅ Done |
| PIX-1875 | Final acceptance review                  | ✅ Done |

---

## 5. Handoff Notes

**Runbook status:** Not yet created (PIX-1879). Key operational knowledge:

- All GitHub workflows live in `.github/workflows/`
- Readiness aggregator: `scripts/devops/aggregate-readiness.py`
- Release schema: `config/release-readiness-schema.json`
- Security scanning: consolidated in `security.yml`
- AI validation pipeline: `ai-validation.yml` (scheduled daily + manual trigger)
- Bitbucket AI lane: `bitbucket-pipelines.yml` (root) with path conditions

**Escalation contacts:** Not yet documented. Should include DevOps lead for CI federation gates, AI team lead for AI validation pipeline.
