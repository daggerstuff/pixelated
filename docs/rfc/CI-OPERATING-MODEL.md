# RFC: CI Federation Operating Model

| Metadata     | Value      |
| ------------ | ---------- |
| **Status**   | APPROVED   |
| **Author**   | Chad       |
| **Date**     | 2026-07-30 |
| **Approved** | 2026-08-01 |

---

## 1. Executive Summary

This RFC defines the federated CI operating model for Pixelated Empathy. The
model distributes validation across two providers — **GitHub Actions** and
**Bitbucket Pipelines** — with staging as the deploy target. Each pipeline
capability has a single designated owner.

---

## 2. Motivation

The current CI landscape evolved organically, resulting in:

- **Duplicate jobs** across providers wasting compute and token budgets
- **No single deploy authority** — multiple pipelines could trigger overlapping
  deployments
- **Unclear ownership** — no documented accountability per pipeline capability
- **No artifact lineage** — builds could be promoted without provenance
  verification
- **Soft gates** — several validation steps use `continue-on-error`, making
  failures advisory

A federated model with clear authority boundaries eliminates these issues.

---

## 3. Provider Authority Matrix

| Capability                                       | Owner    | Primary Provider    | Deploy Authority? |
| ------------------------------------------------ | -------- | ------------------- | ----------------- |
| Application CI (lint, test, build)               | DevOps   | GitHub Actions      | No                |
| Security scanning (CodeQL, Trivy, Checkov, SBOM) | Security | GitHub Actions      | No                |
| Bias detection                                   | AI Team  | GitHub Actions      | No                |
| AI model validation                              | AI Team  | GitHub Actions      | No                |
| AI module validation (governance, data, models)  | AI Team  | Bitbucket Pipelines | No                |
| DB migration validation                          | Backend  | GitHub Actions      | No                |
| OpenAPI validation                               | API      | GitHub Actions      | No                |
| Browser/Playwright E2E                           | Frontend | GitHub Actions      | No                |
| Performance (Lighthouse)                         | Frontend | GitHub Actions      | No                |
| Staging deploy (Civo K3s)                        | DevOps   | GitHub Actions      | No                |
| Readiness aggregation                            | DevOps   | Manual/CLI          | Advisory          |

---

## 4. Operating Rules

### Rule 1: One Owner Per Capability

Each pipeline capability listed above has exactly one designated owner (team).
No other pipeline may execute the same check. Owners are responsible for:

- Maintaining their pipeline definition
- Setting pass/fail thresholds
- Triaging false positives
- Responding to failures within SLA

### Rule 2: Build Artifact Provenance

Every promotion hop must verify artifact provenance:

1. **Commit → Build**: Build artifacts are tagged with the source commit SHA
2. **Build → Stage**: Staging deploy uses the same SHA-tagged artifact

### Rule 3: Validation Gates Before Deploy

No deploy proceeds unless all required gates in the matrix above pass for the
target commit. The readiness aggregator
(`scripts/devops/aggregate-readiness.py`) provides a pre-deploy summary.

### Rule 4: Path-Based Triggers

Each provider runs only jobs relevant to the changed paths:

| Provider            | Changed Paths                                          | Triggered Jobs             |
| ------------------- | ------------------------------------------------------ | -------------------------- |
| GitHub Actions      | `src/`, `docker/`, `k8s/`, `scripts/`, `config/`, etc. | `ci.yml`                   |
| GitHub Actions      | `.github/workflows/**`                                 | `actionlint.yml`           |
| GitHub Actions      | `db/**`                                                | `migration-validation.yml` |
| GitHub Actions      | `docs/api*/**`                                         | `openapi-validation.yml`   |
| Bitbucket Pipelines | `ai/**`, `scripts/governance/**`                       | AI validation, governance  |

---

## 5. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Push / PR                          │
└─────────┬────────────────────────────┬──────────────────────────┘
          │                            │
          ▼                            ▼
┌──────────────────┐       ┌──────────────────────┐
│  GitHub Actions   │       │  Bitbucket Pipelines  │
│  (App CI, Sec,    │       │  (AI validation,       │
│   Migrations,     │       │   governance checks)   │
│   Browser tests)  │       │                        │
└────────┬─────────┘       └──────────┬─────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Readiness Aggregator (optional)                │
│  python3 scripts/devops/aggregate-readiness.py                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌───────────────────────┐
                 │  Staging Deploy        │
                 │  (Civo K3s via GH)     │
                 └───────────────────────┘
```

---

## 6. Artifact Lineage

### 6.1 Build Stage

```mermaid
graph LR
    A[Commit SHA] --> B[GitHub Actions Build]
    B --> C[Docker Image: pixelatedempathy/api:{SHA}]
    B --> D[SBOM: sbom.cyclonedx.json]
    C --> E[Push to ACR / Civo Registry]
```

---

## 7. Gate Criticality Classification

| Classification   | Meaning                                      | SLA               |
| ---------------- | -------------------------------------------- | ----------------- |
| ✅ HARD          | Blocks pipeline on failure                   | Immediate fix     |
| ⚠️ SOFT          | Logs failure but allows pipeline to continue | Fix within 24h    |
| ⚪ INFORMATIONAL | Reports findings without blocking            | Fix within sprint |

### Current Gate Strengths

| Gate                             | Classification   | Notes                                       |
| -------------------------------- | ---------------- | ------------------------------------------- |
| CodeQL analysis (`security.yml`) | ✅ HARD          |                                             |
| Trivy filesystem scan            | ✅ HARD          | SARIF uploaded to GH Security tab           |
| Checkov infra scan               | ✅ HARD          |                                             |
| Migration dry-run / forward      | ✅ HARD          |                                             |
| OpenAPI Spectral lint            | ✅ HARD          |                                             |
| actionlint                       | ✅ HARD          |                                             |
| Bias detection tests             | ✅ HARD          |                                             |
| Playwright / Browser tests       | ✅ HARD          |                                             |
| Bitbucket AI validation          | ✅ HARD          |                                             |
| **`ci.yml` lint, tests, Trivy**  | **⚠️ SOFT**      | **All steps use `continue-on-error: true`** |
| AI model validation              | ⚪ INFORMATIONAL | Creates GitHub issue, does not block        |
| Lighthouse performance           | ⚪ INFORMATIONAL |                                             |

> **Recommendation**: Upgrade `ci.yml` unit tests and security gate from SOFT to
> HARD by removing `continue-on-error: true`. This is the primary CI gate and
> should enforce actual quality standards.

---

## 8. Provider Pipeline Locations

| Provider            | Configuration File                             | Runs In                            |
| ------------------- | ---------------------------------------------- | ---------------------------------- |
| GitHub Actions      | `.github/workflows/*.yml` (29 workflows)       | GitHub-hosted runners              |
| Bitbucket Pipelines | `bitbucket-pipelines.yml` (root, consolidated) | Bitbucket-hosted runners           |
| Bitbucket Pipelines | `ai/bitbucket-pipelines.yml` (AI submodule)    | Bitbucket-hosted runners (ai repo) |

---

## 8. Future Considerations

| Topic                                               | Timeline    | Owner            |
| --------------------------------------------------- | ----------- | ---------------- |
| Upgrade `ci.yml` from SOFT to HARD gates            | Next sprint | DevOps           |
| Establish weekly CI operations review               | Next sprint | DevOps / AI Team |
| Automate readiness aggregator as a pre-deploy check | Q3 2026     | DevOps           |

---

## 9. References

- [CI Federation Runbook](../operations/ci-federation-runbook.md)
- [Readiness Aggregator](../../scripts/devops/aggregate-readiness.py)
- [Release Readiness Schema](../../config/release-readiness-schema.json)
- [Consolidated Security Workflow](../../.github/workflows/security.yml)
- [Consolidated Bitbucket Pipeline](../../bitbucket-pipelines.yml)
- [Final Acceptance Review](../../ci-cd/final-acceptance-review.md)
