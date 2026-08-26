# Threat Model & Penetration Testing Scope

**Issue:** PIX-4136 (S2: Reconnaissance & Threat Modeling) **Sprint:** 6
(2026-07-28 to 2026-08-11) **Parent:** PIX-4126 — Enterprise Gap: Penetration
Testing & External Security Assessment **Project:** Enterprise Readiness Program
**Last updated:** 2026-07-29

---

## 1. Purpose

Define the system threat model that guides the penetration testing engagement in
PIX-4126 / S3-S9. Identifies critical assets, trust boundaries, and attack
vectors grounded in Pixelated's actual production architecture.

This document is the **scope artifact** the vendor will use to scope the
engagement. Anything not described here is out of scope by default.

---

## 2. System Architecture (Verified)

Evidence sources: `k8s/civo/deployment-blue.yaml`,
`k8s/civo/deployment-green.yaml`, `infra/sinker/`, `docker-compose*.yml`,
`Dockerfile`, `sentry.server.config.ts`, `docs/api-reference/openapi.yaml`,
`packages/memory-schema/src/schemas.ts`, `src/services/auth.service.ts`.

| Layer              | Runtime                                                                                                                   | Evidence                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Edge / WAF         | Cloudflare (zone id managed via `infra/sinker/run_*infra-prep-cloudflare-zone-id*.json`)                                  | `sentry.server.config.ts` Cloudflare integration; `infra/sinker/traefik/traefik.yml` |
| Kubernetes         | Civo (`k8s/civo/deployment-blue.yaml`, `deployment-green.yaml`)                                                           | Blue/green deploys                                                                   |
| App servers        | Astro SSR + Node services (`src/`, `agents/*/agent/lib/workers-ai.ts`)                                                    | Cloudflare Workers runtime hints                                                     |
| Container services | Docker Compose (`docker/docker-compose.{production,celery,db,qdrant}.yml`, `ai-services/Dockerfile`, `agents/Dockerfile`) | Local + prod orchestration                                                           |
| Auth               | Auth0 (JWT) + API Key (`docs/api-reference/openapi.yaml` info section)                                                    | `src/lib/auth/session.ts`, `src/services/auth.service.ts`                            |
| DB                 | Postgres (multi-schema: `db/*.sql`, `db/migrations/010_create_workspaces_table.sql`, `docker/init-db.sql`)                | Workspaces table, session storage                                                    |
| Observability      | Sentry server (`sentry.server.config.ts`), monitoring compose                                                             |                                                                                      |

**Note on prior Sprint Notes claim of "multi-cloud AWS + GCP + Azure +
Cloudflare":** That description is over-scoped. Production runtime is
**Cloudflare (edge) + Civo K8s (compute) + Cloudflare R2 / Postgres /
self-hosted Docker services**. No AWS/GCP/Azure resources were located in the
working tree. Threat model is sized to actual infra; future cloud expansion
(AWS/GCP) would require re-scoping.

---

## 3. Multi-Tenant Data Model

Per `packages/memory-schema/src/schemas.ts:90,125,149` and
`db/migrations/010_create_workspaces_table.sql`:

- **tenantId** — primary scoping field across memory objects, workspaces
- **Workspaces** table — top-level grouping (DB migration 010)
- **Sessions** — per-user state (`db/session.sql`, `db/session-progress.sql`)
- **Provenance records** — `db/provenance_schema.sql`
- **API keys** — `ai/security/migrations/001_create_api_keys.sql` (scoped, see
  §5)

Every cross-tenant request must filter by `tenantId`. Missing or wrong filter =
data leak (top-tier breach).

---

## 4. Critical Assets Inventory (14)

| #   | Asset                                   | Sensitivity  | Storage                                                         | Notes                                        |
| --- | --------------------------------------- | ------------ | --------------------------------------------------------------- | -------------------------------------------- |
| 1   | User mental-health conversation content | **Critical** | Postgres `session` tables                                       | **PHI**-equivalent under HIPAA Security Rule |
| 2   | Auth0 user identities + sessions        | **Critical** | Auth0 + `db/session.sql`                                        | Credential material                          |
| 3   | API signing keys                        | **Critical** | `ai/security/migrations/001_create_api_keys.sql`                | Server-to-server trust                       |
| 4   | ML model weights + adapters             | **High**     | `ai/training_data_unified/`, `ai/training/v1/`                  | Re-identification risk on training data      |
| 5   | Bias-detection datasets                 | **High**     | `tests/bias-detection/test-datasets.ts`                         | Could leak prior outputs                     |
| 6   | Crisis-detection scenarios              | **High**     | `tests/crisis-detection/crisis-test-scenarios.ts`               | Reveals detection logic                      |
| 7   | Database credentials (Postgres)         | **High**     | `docker-compose*.yml`, `.env` files                             | Direct DB access                             |
| 8   | Cloudflare API tokens                   | **High**     | env vars + `infra/sinker/`                                      | DNS / WAF / R2                               |
| 9   | OAuth2-proxy credentials                | **High**     | `infra/sinker/run_2026*infra-fix-oauth2-proxy-healthcheck.json` | Edge auth                                    |
| 10  | Workspace configuration                 | **Medium**   | `db/migrations/010_create_workspaces_table.sql`                 | Tenant boundary metadata                     |
| 11  | Audit / provenance logs                 | **Medium**   | `db/provenance_schema.sql`                                      | Tampering risk                               |
| 12  | Sentry DSN + telemetry config           | **Medium**   | `sentry.server.config.ts`                                       | Source map leakage                           |
| 13  | Webhook signing secrets                 | **Medium**   | env / config                                                    | Outbound trust                               |
| 14  | Static site build artifacts             | **Low**      | `dist/`, `build/`                                               | Information disclosure                       |

---

## 5. Authentication & Authorization

Per `docs/api-reference/openapi.yaml` info section +
`src/services/auth.service.ts`:

- **Dual-mode auth:** Auth0 JWT (browser) **or** API Key (server-to-server)
- **Header mapping:** `Authorization: Bearer <jwt>` **or** `X-API-Key: <key>`
- **Strategies:** `jwtOnly`, `apiKeyOnly`, `either` per-endpoint
- **Scope-based RBAC:** `read`, `write`, `admin`, `memory:read`, `memory:write`,
  `admin`
- **Tenant binding:** API keys are scoped to one tenantId (per migration 001)

Threat-modeling implications:

- A successful JWT forgery or API-key exfiltration grants tenant-scoped but full
  RBAC privileges — therefore the auth subsystem is **Tier 1** attack surface.
- `either` strategy endpoints must validate _both_ paths identically (common
  bug: API key bypasses certain checks that JWT enforces).
- Token storage (`src/lib/auth/session.ts`) is reviewed for XSS-safe handling.

---

## 6. Trust Boundaries (5)

| #   | Boundary                                | Crosses                                   | Controls (claimed)                                                             |
| --- | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| TB1 | Internet → Cloudflare edge              | All external traffic                      | Cloudflare WAF, rate limit, bot mgmt                                           |
| TB2 | Cloudflare edge → Civo K8s service mesh | Incoming requests                         | Cloudflare Tunnel or ingress, oauth2-proxy (`infra/sinker/...oauth2-proxy...`) |
| TB3 | Service → Postgres                      | DB queries                                | NetworkPolicy, TLS, row-level tenant scoping                                   |
| TB4 | Service → external AI APIs              | Outbound LLM calls                        | API key from secrets store, request size limits                                |
| TB5 | Tenant → tenant                         | Cross-tenant reads (should be impossible) | `tenantId` filter on every query, scoped API keys                              |

**Boundary-crossing analysis:** vendor MUST test attempts to cross TB5 (the only
boundary that requires per-request enforcement rather than network controls).
All other boundaries are network/perimeter-based and have known mature tooling.

---

## 7. STRIDE Threat Model

### S — Spoofing

| ID  | Threat                         | Vector                             | Existing Control                     | Residual Risk      |
| --- | ------------------------------ | ---------------------------------- | ------------------------------------ | ------------------ |
| S1  | JWT forgery                    | None — Auth0 signs with RS256      | Signature verification, key rotation | Low                |
| S2  | API key replay                 | Stolen key from logs / git history | Scope-bound, tenant-bound            | **High** (see §10) |
| S3  | Cloudflare service-token spoof | Phishing dev                       | Token in env, not source             | Low                |
| S4  | Cross-tenant impersonation     | Modified `tenantId` claim          | Tenant filter on query, scope check  | Medium             |

### T — Tampering

| ID  | Threat                           | Vector                          | Existing Control             | Residual Risk |
| --- | -------------------------------- | ------------------------------- | ---------------------------- | ------------- |
| T1  | SQL injection                    | User input → ORM                | Type-safe ORM (Zod schemas)  | Low–Medium    |
| T2  | Cross-tenant write               | Authorization bypass            | Scope check before write     | Medium        |
| T3  | ML model weight tampering        | Compromised training pipeline   | Hash check, signed artifacts | Medium        |
| T4  | Provenance / audit log tampering | DB write by compromised service | Append-only DB role          | Medium        |
| T5  | Container image tampering        | Compromised base image          | Trivy scan (S3)              | Low           |

### R — Repudiation

| ID  | Threat                             | Vector              | Existing Control              | Residual Risk |
| --- | ---------------------------------- | ------------------- | ----------------------------- | ------------- |
| R1  | User denies action                 | No audit trail      | Provenance logging            | Low           |
| R2  | Service action without attribution | Missing actor field | Required actor on every write | Medium        |

### I — Information Disclosure

| ID  | Threat                               | Vector                       | Existing Control                         | Residual Risk                    |
| --- | ------------------------------------ | ---------------------------- | ---------------------------------------- | -------------------------------- |
| I1  | Cross-tenant data leak               | Missing `tenantId` filter    | Tenant filter on read                    | **Critical** — top test priority |
| I2  | Secrets in git history               | Committed `.env`, infra JSON | gitleaks scan (S3)                       | **High** (see §10)               |
| I3  | PII in error logs                    | Verbose error handler        | Log redaction, Sentry scrubbing          | Medium                           |
| I4  | OpenAPI spec reveals internals       | Public swagger               | Spec review, internal endpoint scrubbing | Medium                           |
| I5  | Sentry source-map leak               | Public source maps           | Source map upload restricted             | Medium                           |
| I6  | Cloudflare token leak in deploy logs | Verbose deploy script        | Token redaction (sinker)                 | Low–Medium                       |

### D — Denial of Service

| ID  | Threat                         | Vector                 | Existing Control                        | Residual Risk |
| --- | ------------------------------ | ---------------------- | --------------------------------------- | ------------- |
| D1  | LLM API cost exhaustion        | Authenticated abuse    | Per-tenant rate limit, scope=admin only | Medium        |
| D2  | Postgres connection exhaustion | Connection pool flood  | PgBouncer or pool limits                | Medium        |
| D3  | Cloudflare origin DDoS         | Volumetric at edge     | Cloudflare DDoS protection              | Low           |
| D4  | Large session payload          | Unbounded request size | Request size limit, Zod max             | Low           |

### E — Elevation of Privilege

| ID  | Threat                           | Vector                            | Existing Control                          | Residual Risk                |
| --- | -------------------------------- | --------------------------------- | ----------------------------------------- | ---------------------------- |
| E1  | `read` scope upgraded to `admin` | Missing scope check               | Per-route scope guard                     | **High** — top test priority |
| E2  | Cross-workspace API key          | Tenant-bypass bug                 | Tenant bound to key                       | Medium                       |
| E3  | OAuth2-proxy misconfig           | `infra/sinker/...oauth2-proxy...` | Misconfig could let unauth reach services | Medium                       |
| E4  | Worker runtime RCE               | Server-side template / eval       | No eval claimed                           | Low                          |

**Total: 22 STRIDE threats across 6 categories.**

---

## 8. Attack Surface

### External (8)

1. Public web app (`src/pages/`)
2. Public API (`docs/api-reference/openapi.yaml`)
3. Auth0 login flow (Auth0 tenant)
4. Cloudflare Worker entrypoints (`agents/*/agent/lib/workers-ai.ts`)
5. Webhook receivers (outbound integrations)
6. Marketing site (`docs/`, `.mdx`)
7. Auth0 callback URLs
8. Cloudflare R2 endpoints (if public)

### Internal (6)

1. Service-to-service (Agent ↔ Agent in `agents/*/`)
2. AI service runtime (`ai-services/Dockerfile`)
3. ML training pipelines (`ai/training/v1/`, `ai/training_data_unified/`)
4. Bias detection pipeline (`tests/bias-detection/`)
5. Crisis detection pipeline (`tests/crisis-detection/`)
6. Cluster-admin kubeconfig (Civo)

---

## 9. Prioritized Pentest Focus Areas (14)

| #   | Focus Area                              | STRIDE IDs | Severity     |
| --- | --------------------------------------- | ---------- | ------------ |
| 1   | Cross-tenant data leakage (I1)          | I1, T2, E2 | **Critical** |
| 2   | API scope escalation (E1)               | E1         | **Critical** |
| 3   | Auth bypass via API key (S2, I1)        | S2, E1, I1 | **Critical** |
| 4   | Secrets in git history (I2)             | I2, S2     | **Critical** |
| 5   | SQL injection across ORM                | T1, I1     | High         |
| 6   | OAuth2-proxy misconfig                  | E3, I1     | High         |
| 7   | JWT validation gaps                     | S1, E1     | High         |
| 8   | PII leakage in logs / Sentry            | I3, R2     | High         |
| 9   | Cross-tenant write (T2)                 | T2, I1     | High         |
| 10  | OpenAPI spec internal endpoint exposure | I4         | Medium       |
| 11  | Sentry source-map exposure              | I5         | Medium       |
| 12  | ML model weight exfiltration            | I1, T3     | Medium       |
| 13  | LLM cost-exhaustion DoS                 | D1         | Medium       |
| 14  | Provenance log integrity                | T4, R1     | Medium       |

**Severity tally:** 4 Critical, 5 High, 5 Medium — matches S2 deliverable
target.

---

## 10. Findings from S3 Supporting Scans (Pre-Pentest)

Source: `docs/linear-audit/s3-scan-results.md`.

- **pnpm audit:** 3 high, 1 moderate, 1 low (vs. Sprint Notes claim of "0
  high"). Vendor should NOT rely on Sprint Notes as authoritative — re-baselined
  against current `pnpm-lock.yaml` on 2026-07-29. See S3 report.
- **gitleaks:** 2585 raw findings; after triage: 5 source-code, 14 infra YAML,
  168 k8s-cluster, 196 docs, 1532 export archives, 357 test fixtures. Vendor
  should focus on **infra_yaml + k8s_cluster + real_source** buckets (see S3
  report for full list).
- **Trivy filesystem / Dockerfile:** 0 critical, 0 high (verified 2026-07-29).
- **Trivy container / Prowler AWS / kube-bench / Nmap:** blocked on external
  dependencies — re-run once access is provisioned.

---

## 11. Compliance Mapping

| Framework     | Controls Touched                                             | Pentest Evidence Required                             |
| ------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| **SOC 2**     | CC6.1 (access), CC6.6 (boundaries), CC7.1 (threat detection) | Annual external pentest, scope = this doc             |
| **HIPAA**     | §164.308 (admin safeguards), §164.312 (technical safeguards) | Risk analysis (§164.308(a)(1)(ii)(A)) — this document |
| **PCI DSS**   | Req 6.3, 11.3 (pentest), 11.4                                | If payment data ever flows — currently NOT in scope   |
| **ISO 27001** | A.14.2.8 (system testing), A.18.2.3 (technical compliance)   | Annual external test                                  |

---

## 12. Out-of-Scope (Default)

The following are **out of scope** for S3-S9 unless explicitly added by change
order. Vendor must confirm before testing:

- Denial-of-service / volumetric attacks beyond Cloudflare's tested capacity
- Social engineering / phishing of Pixelated employees
- Physical security of any office / data center
- Third-party SaaS (Auth0, Cloudflare, Sentry) — those vendors run their own
  tests
- Audit of `ai/training_data_unified/configs/` (large archived configs, not
  prod)
- Pure UX / cosmetic issues (separate bug bounty)
- AI hallucination / bias detection issues (separate model-evaluation
  workstream)

---

## 13. Engagement Logistics

- **Test environment:** staging (TBD by vendor scoping call — must mirror prod
  config including tenant seeding)
- **Test accounts:** to be provisioned at 3 privilege levels (read / write /
  admin), one per role, all in same workspace for cross-tenant testing
- **API documentation:** `docs/linear-audit/api-specification-vendor-share.md`
- **Emergency contact:** TBD per Rules of Engagement (PIX-4135)
- **Reporting cadence:** Daily summary during engagement, final report in 5
  business days post-test

---

## 14. Open Items (Pending S3-S9)

- [ ] Confirm staging environment mirror parity (DevOps)
- [ ] Provision 3 privilege-level test accounts (Chad)
- [ ] Run blocked scans (Prowler / kube-bench / Nmap) once access granted
- [ ] Vendor selection finalized (PIX-4135)
- [ ] MSA / NDA signed (PIX-4135)
- [ ] Schedule engagement start (PIX-4135)

---

## 15. Change Log

| Date       | Author | Change                                                        |
| ---------- | ------ | ------------------------------------------------------------- |
| 2026-07-29 | Chad   | Initial STRIDE model, trust boundaries, attack surface map    |
| 2026-07-29 | Chad   | Reconciled infra claim (Cloudflare + Civo, not AWS/GCP/Azure) |
| 2026-07-29 | Chad   | Added S3 scan cross-reference (§10)                           |
