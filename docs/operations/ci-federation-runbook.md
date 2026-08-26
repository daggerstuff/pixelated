# CI Federation Operations Runbook & Escalation Map

**Last updated:** 2026-07-30 **Owner:** Chad **Repo:** daggerstuff/pixelated

---

## 1. Overview

This runbook documents the CI federation gates, their locations, owners,
break/fix procedures, and escalation paths. The Pixelated CI model federates
across two providers:

| Provider                 | Domain                                           | Deploy Authority  |
| ------------------------ | ------------------------------------------------ | ----------------- |
| **GitHub Actions**       | Application CI, security scanning, AI validation | Civo K3s (deploy) |
| **Bitbucket Pipelines**  | AI module validation, governance checks          | —                 |
| **Readiness Aggregator** | Cross-provider release readiness summary         | Local/devops      |

---

## 2. Gate Inventory

### 2.1 Core CI (`ci.yml`)

| Property          | Value                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **File**          | `.github/workflows/ci.yml`                                                                           |
| **Trigger**       | Push/PR → `staging` (path-filtered: src, ai, docker, k8s, terraform, scripts, config)                |
| **Owner**         | DevOps / Chad                                                                                        |
| **Steps**         | Format check → lint → unit tests → Docker build → Trivy scan → security gate                         |
| **Gate strength** | ⚠️ SOFT (all steps use `continue-on-error: true`)                                                    |
| **Break/fix**     | Check runner logs in GitHub Actions → fix the specific step failure → re-run via `workflow_dispatch` |
| **Escalation**    | DevOps lead if runner failures or persistent Docker build issues                                     |

### 2.2 Security Scanning (`security.yml`)

| Property          | Value                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **File**          | `.github/workflows/security.yml`                                                                                                                                                |
| **Trigger**       | Push/PR → `main/master/staging` + daily schedule                                                                                                                                |
| **Owner**         | Security / Chad                                                                                                                                                                 |
| **Jobs**          | CodeQL (JS + Python), Trivy filesystem scan, Checkov (infra + Helm), pnpm audit, pip-audit, SBOM generation, container image scan, Dockerfile config scan                       |
| **Gate strength** | ✅ HARD (CodeQL, Trivy, Checkov SARIF uploads block on findings)                                                                                                                |
| **Break/fix**     | Review SARIF results in [GitHub Security tab](https://github.com/daggerstuff/pixelated/security) → patch vulnerabilities → update `.trivyignore` or baseline as needed → re-run |
| **Known issues**  | Container image scan matrix includes 9 base images; NVIDIA CUDA images may produce CVEs that are upstream-only                                                                  |
| **Escalation**    | Security lead for unpatched CVEs; DevOps for Trivy/Checkov tool failures                                                                                                        |

### 2.3 AI Validation (`ai-validation.yml`)

| Property             | Value                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **File**             | `.github/workflows/ai-validation.yml`                                                                     |
| **Trigger**          | Daily schedule (`0 0 * * *`) + manual `workflow_dispatch`                                                 |
| **Owner**            | AI Team / Steiner                                                                                         |
| **Steps**            | Generate token → trigger webhook → wait → fetch results → alert if pass rate < 85%                        |
| **Gate strength**    | ⚪ INFORMATIONAL (creates GitHub issue on failure, does not block)                                        |
| **Break/fix**        | Check AI validation dashboard → inspect webhook logs → verify AI service is healthy → re-trigger manually |
| **Required secrets** | `AI_VALIDATION_SECRET`, `APP_URL`                                                                         |
| **Escalation**       | AI team lead for persistent pass rate drops; DevOps for webhook connectivity                              |

### 2.4 DB Migration Validation (`migration-validation.yml`)

| Property          | Value                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **File**          | `.github/workflows/migration-validation.yml`                                                              |
| **Trigger**       | Push/PR → `main/staging` (path: `db/**`) + daily schedule                                                 |
| **Owner**         | Backend / Dagger                                                                                          |
| **Steps**         | Checksum → dry-run (BEGIN/ROLLBACK) → apply forward → schema snapshot → test rollbacks → verify integrity |
| **Gate strength** | ✅ HARD (fails on dry-run error, forward migration error, or orphaned constraints)                        |
| **Break/fix**     | Check migration SQL syntax → fix the broken migration file → dry-run locally first → push fix             |
| **Escalation**    | Backend lead for schema design issues; DBA for data migration performance                                 |

### 2.5 OpenAPI Validation (`openapi-validation.yml`)

| Property          | Value                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| **File**          | `.github/workflows/openapi-validation.yml`                                 |
| **Trigger**       | Push/PR → `main/staging` (path: `docs/api*/**, .spectral.yaml`) + daily    |
| **Owner**         | API / Dagger                                                               |
| **Steps**         | Spectral lint → FastAPI schema export → validation → publish spec artifact |
| **Gate strength** | ✅ HARD (Spectral lint fails on errors)                                    |
| **Break/fix**     | Fix OpenAPI spec violations per Spectral output → re-run                   |
| **Escalation**    | API lead for spec design decisions                                         |

### 2.6 Workflow Validation (`actionlint.yml`)

| Property          | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| **File**          | `.github/workflows/actionlint.yml`                         |
| **Trigger**       | Push/PR → `staging` (path: `.github/workflows/**`)         |
| **Owner**         | DevOps / Chad                                              |
| **Steps**         | Download actionlint → run on all `.github/workflows/*.yml` |
| **Gate strength** | ✅ HARD (exits non-zero on violations)                     |
| **Break/fix**     | Read actionlint output → fix the workflow YAML → re-run    |
| **Escalation**    | DevOps lead for unsupported action syntax                  |

### 2.7 Bias Detection (`bias-detection-ci.yml`)

| Property          | Value                                             |
| ----------------- | ------------------------------------------------- |
| **File**          | `.github/workflows/bias-detection-ci.yml`         |
| **Trigger**       | Push/PR → `main/master/staging`                   |
| **Owner**         | AI Team / Steiner                                 |
| **Steps**         | Python service tests, TypeScript tests, E2E tests |
| **Gate strength** | ✅ HARD                                           |
| **Escalation**    | AI team lead                                      |

### 2.8 Browser Testing (`browser-tests.yml`, `playwright.yml`)

| Property          | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| **File**          | `.github/workflows/browser-tests.yml`, `.github/workflows/playwright.yml`      |
| **Trigger**       | Push/PR → `main/master/staging`                                                |
| **Owner**         | Frontend / Steiner                                                             |
| **Steps**         | Playwright smoke E2E, browser test suite                                       |
| **Gate strength** | ✅ HARD                                                                        |
| **Escalation**    | Frontend lead for flaky tests; DevOps for Playwright browser dependency issues |

### 2.9 Performance (`lighthouse.yml`)

| Property          | Value                                     |
| ----------------- | ----------------------------------------- |
| **File**          | `.github/workflows/lighthouse.yml`        |
| **Trigger**       | Push/PR → `staging`                       |
| **Owner**         | Frontend / Steiner                        |
| **Gate strength** | ⚪ INFORMATIONAL                          |
| **Escalation**    | Frontend lead for performance regressions |

### 2.10 Bitbucket Pipelines (AI lane)

| Property          | Value                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **File**          | `bitbucket-pipelines.yml` (root), `ai/bitbucket-pipelines.yml` (submodule)                      |
| **Trigger**       | Branch pushes, PRs (AI steps gated by `ai/**` path conditions)                                  |
| **Owner**         | AI Team / Steiner                                                                               |
| **Steps**         | Install deps → lint → type-check → security scan → unit/integration tests → SonarCloud → deploy |
| **Gate strength** | ✅ HARD (Bitbucket blocks on step failure)                                                      |
| **Escalation**    | AI team lead for AI pipeline failures; DevOps for Bitbucket runner issues                       |

### 2.11 Readiness Aggregator

| Property               | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **File**               | `scripts/devops/aggregate-readiness.py`                                                  |
| **Trigger**            | Manual (CLI)                                                                             |
| **Owner**              | DevOps / Chad                                                                            |
| **Schema**             | `config/release-readiness-schema.json`                                                   |
| **Validation lanes**   | Lint, typecheck, unit tests, format check                                                |
| **Provider pipelines** | GitHub Actions, Bitbucket Pipelines (requires credentials)                               |
| **Gate strength**      | ⚪ MANUAL (pre-deployment advisory gate)                                                 |
| **Break/fix**          | Check Python dependencies → verify provider API tokens → run with `--dry-run` to isolate |
| **Escalation**         | DevOps lead for aggregator logic errors                                                  |

---

## 3. Deployment Gates

### 3.1 Staging (Civo K3s)

| Step                 | Workflow                         | Blocks?          |
| -------------------- | -------------------------------- | ---------------- |
| CI checks pass       | `ci.yml`                         | ⚠️ Soft          |
| Security scan        | `security.yml`                   | ✅               |
| AI validation        | `ai-validation.yml`              | ⚪ Informational |
| Migration validation | `migration-validation.yml`       | ✅               |
| Deploy               | `deploy-civo.yml` (push to main) | ✅ Final gate    |

---

## 4. Escalation Paths

| Issue Type                   | First Response | Escalate To        | Contact  |
| ---------------------------- | -------------- | ------------------ | -------- |
| CI runner failure            | DevOps         | Ops lead           | @chad    |
| Security vulnerability       | Security       | Security lead      | @dagger  |
| AI model validation          | AI team        | AI lead            | @steiner |
| DB migration error           | Backend        | DBA / Backend lead | @dagger  |
| API spec violation           | API team       | API lead           | @dagger  |
| Workflow YAML error          | DevOps         | DevOps lead        | @chad    |
| Browser test flake           | Frontend       | Frontend lead      | @steiner |
| Pipeline credentials expired | DevOps         | Ops lead           | @chad    |
| Bitbucket runner down        | DevOps         | Ops lead           | @chad    |

---

## 5. Common Break/Fix Procedures

### 5.1 GitHub Action Fails

1. Navigate to Actions tab → find failing workflow run
2. Click into failing job → expand failing step
3. Read error output → fix the issue → push fix to the same branch
4. If the fix is a CI configuration issue, trigger `workflow_dispatch` to re-run

### 5.2 Security Vulnerability Reported

1. Check the GitHub Security tab for SARIF results
2. Assess severity: CRITICAL/HIGH requires action within 48h
3. If false positive: add to `.trivyignore` or CodeQL query filters
4. If real: patch dependency → update lock file → push fix
5. Re-run security workflow to verify fix

### 5.3 AI Validation Pipeline Alert

1. Check the auto-created GitHub issue from `ai-validation.yml`
2. Navigate to the AI validation dashboard at
   `${APP_URL}/admin/ai/validation-pipeline`
3. Inspect recent pass rates and failure reasons
4. If webhook failure: check AI service health and connectivity
5. Re-trigger manually via `workflow_dispatch`

### 5.4 Migration Failure

1. Dry-run the failing migration locally:
   ```bash
   psql -d pixelated_empathy -f db/migrations/<file>.sql
   ```
2. Fix SQL syntax or data compatibility issue
3. Run the full validation workflow again
4. If rollback also fails, check for dependencies between migrations

### 5.5 Bitbucket Pipeline Fails for AI Changes

1. Check Bitbucket Pipelines → find the failing run
2. Review the step output (governance, data validation, model validation)
3. If path condition didn't trigger: verify `includePaths` patterns
4. If Python dependency issue: update `requirements.txt` or `pyproject.toml`
5. Re-run via re-push or Bitbucket's manual re-run UI

### 5.6 Readiness Aggregator Fails

1. Ensure all validation commands are installed (oxlint, astro, vitest)
2. Run with `--dry-run` to bypass actual execution and isolate
3. Check provider tokens:
   ```bash
   export GITHUB_TOKEN=ghp_...
   python3 scripts/devops/aggregate-readiness.py --providers github
   ```
4. Validate output against schema:
   ```bash
   python3 -c "import json, jsonschema; jsonschema.validate(json.load(open('report.json')), json.load(open('config/release-readiness-schema.json')))"
   ```

---

## 6. Key Secrets & Configuration

| Secret                 | Used By               | Managed In                                |
| ---------------------- | --------------------- | ----------------------------------------- |
| `GITHUB_TOKEN`         | All GitHub workflows  | Auto-injected by GitHub                   |
| `AI_VALIDATION_SECRET` | `ai-validation.yml`   | GitHub Secrets                            |
| `APP_URL`              | `ai-validation.yml`   | GitHub Secrets                            |
| `SONAR_TOKEN`          | SonarCloud steps      | GitHub Secrets (CI) + Bitbucket variables |
| `AI_VALIDATION_SECRET` | AI validation webhook | GitHub Secrets                            |

---

## 7. SLA Targets

| Gate                              | Max Response Time    | Escalation Time |
| --------------------------------- | -------------------- | --------------- |
| Security vulnerability (CRITICAL) | 4 hours              | 8 hours         |
| Security vulnerability (HIGH)     | 48 hours             | 72 hours        |
| CI pipeline outage                | 2 hours              | 4 hours         |
| AI validation failure             | 24 hours             | 48 hours        |
| Migration failure                 | 4 hours (pre-deploy) | 8 hours         |
| Bitbucket pipeline outage         | 4 hours              | 24 hours        |

---

## 8. Weekly CI Operations Review

### Cadence

- **When:** Every Monday, 30 minutes
- **Attendees:** CI lead (Chad), on-call engineer
- **Tool:** Run the CI ops dashboard before the meeting:
  ```bash
  python3 scripts/ci/ci-ops-dashboard.py --days 7 --html /tmp/ci-ops-weekly.html
  ```

### Review Checklist

#### 1. Pipeline Health (5 min)

| Check                                  | Source                             | Green/Yellow/Red    |
| -------------------------------------- | ---------------------------------- | ------------------- |
| All GitHub workflows passing (last 7d) | Dashboard → failed checks by lane  | Red if any failures |
| All Bitbucket AI pipelines green       | Bitbucket UI: pipelines → branches | Red if any failure  |
| No stuck/pending workflows >30 min     | GitHub Actions → queued workflows  | Yellow if >2        |
| No deploy gate failures                | Dashboard → deploy gate failures   | Red if any          |

#### 2. Performance (5 min)

| Check                    | Source                         | Threshold      |
| ------------------------ | ------------------------------ | -------------- |
| Avg PR feedback time     | Dashboard → PR feedback time   | <20 min target |
| Longest CI run (staging) | GitHub Actions → workflow runs | <30 min target |
| Queue wait time          | GitHub Actions → queued time   | <5 min target  |

#### 3. Security (5 min)

- Review any open CRITICAL/HIGH security alerts from the past week
- Check CodeQL + Trivy scan results from `security.yml`
- Verify no new supply-chain vulnerabilities in dependencies (pnpm audit /
  pip-audit)

#### 4. Capacity & Cost (5 min)

| Check                           | Source               | Action if degraded                         |
| ------------------------------- | -------------------- | ------------------------------------------ |
| GitHub Actions minutes used     | GH Billing → Actions | Review if nearing quota                    |
| Self-hosted runner availability | GitHub → runners     | Check runner logs                          |
| Bitbucket pipeline builds       | Bitbucket → usage    | Verify AI-only lane is not running CI jobs |

#### 5. Backlog & Action Items (10 min)

- Review open CI federation tickets in Linear (filter:
  `project:"CI Federation"`)
- Review any open incidents or post-mortems
- Check if any pipeline needs maintenance (pin updates, deprecation windows)
- Assign next week's CI improvement tasks

### Monthly Deep Dive

On the first Monday of each month, extend the review to 60 minutes and cover:

- Run the dashboard with `--days 30` for a broader trend analysis
- Review deprecation timelines (e.g., `security-scanning.yml` removal after
  2026-08-31)
- Audit for job duplication drift (new workflows that may overlap with existing
  ones)
- Rotate CI tokens and review secret access
- Update this runbook if topology has changed
