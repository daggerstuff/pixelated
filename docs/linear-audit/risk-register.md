# Enterprise Security Risk Register

**Parent:** PIX-4126 — Enterprise Gap: Penetration Testing & External Security
Assessment **Last updated:** 2026-07-30 **Owner:** Chad **Review cadence:**
Quarterly, or within 5 business days after any security assessment / incident

---

## 1. Purpose

This register records the security risks identified during the PIX-4126
gap-analysis and pre-pentest workstreams (S2–S3). It feeds directly into the
annual external penetration test plan and is the authoritative place to track
risk acceptance, remediation, and residual exposure.

---

## 2. Risk Scoring

| Factor         | Values                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| **Likelihood** | `Low` / `Medium` / `High` / `Critical`                                             |
| **Impact**     | `Low` / `Medium` / `High` / `Critical`                                             |
| **Severity**   | Derived from Likelihood × Impact; mapped to `Critical` / `High` / `Medium` / `Low` |
| **Status**     | `Open` / `In Progress` / `Mitigated` / `Accepted` / `Transferred`                  |

---

## 3. Findings from Threat Model (S2)

Source: `docs/linear-audit/threat-model-scope.md`

| ID      | STRIDE Category        | Risk Statement                                             | Likelihood | Impact   | Severity     | Status      | Owner             | Target Resolution       |
| ------- | ---------------------- | ---------------------------------------------------------- | ---------- | -------- | ------------ | ----------- | ----------------- | ----------------------- |
| R-TM-S1 | Spoofing               | JWT forgery via compromised Auth0 signing keys             | Low        | Critical | **High**     | Mitigated   | Platform          | Ongoing (Auth0 managed) |
| R-TM-S2 | Spoofing               | API key replay after exfiltration from logs / git history  | Medium     | Critical | **Critical** | Open        | Platform + DevOps | S4 – vendor test        |
| R-TM-S3 | Spoofing               | Cloudflare service-token spoof via phishing / leaked token | Low        | High     | **Medium**   | Open        | DevOps            | S4 – vendor test        |
| R-TM-S4 | Spoofing               | Cross-tenant impersonation by modifying `tenantId` claim   | Medium     | High     | **High**     | Open        | Platform          | S4 – vendor test        |
| R-TM-T1 | Tampering              | SQL injection through user input to ORM                    | Low        | Critical | **High**     | Open        | Platform          | S4 – vendor test        |
| R-TM-T2 | Tampering              | Cross-tenant write via authorization bypass                | Medium     | Critical | **Critical** | Open        | Platform          | S4 – vendor test        |
| R-TM-T3 | Tampering              | ML model weight tampering in compromised training pipeline | Low        | High     | **Medium**   | Open        | AI/ML             | S5                      |
| R-TM-T4 | Tampering              | Provenance / audit log tampering by compromised service    | Low        | High     | **Medium**   | Open        | Platform          | S5                      |
| R-TM-T5 | Tampering              | Container image tampering via compromised base image       | Low        | High     | **Medium**   | Open        | DevOps            | Ongoing (Trivy CI)      |
| R-TM-R1 | Repudiation            | User denies action due to missing audit trail              | Low        | High     | **Medium**   | In Progress | Platform          | S5                      |
| R-TM-R2 | Repudiation            | Service action without attributable actor                  | Medium     | High     | **High**     | Open        | Platform          | S5                      |
| R-TM-I1 | Information Disclosure | Cross-tenant data leak from missing `tenantId` filter      | Medium     | Critical | **Critical** | Open        | Platform          | S4 – vendor test        |
| R-TM-I2 | Information Disclosure | Secrets in git history / committed env files               | High       | Critical | **Critical** | In Progress | DevOps + Security | S3–S4                   |
| R-TM-I3 | Information Disclosure | PII in error logs / Sentry telemetry                       | Medium     | High     | **High**     | Open        | Platform          | S4                      |
| R-TM-I4 | Information Disclosure | OpenAPI spec reveals internal endpoints                    | Low        | Medium   | **Medium**   | Open        | Platform          | S3 (pre-share review)   |
| R-TM-I5 | Information Disclosure | Sentry source-map leak                                     | Low        | Medium   | **Medium**   | Open        | Platform          | S4                      |
| R-TM-I6 | Information Disclosure | Cloudflare token leak in deploy logs                       | Low        | High     | **Medium**   | Open        | DevOps            | S4                      |
| R-TM-D1 | Denial of Service      | LLM API cost exhaustion from authenticated abuse           | Medium     | Medium   | **Medium**   | Open        | Platform          | S4                      |
| R-TM-D2 | Denial of Service      | Postgres connection pool exhaustion                        | Medium     | Medium   | **Medium**   | Open        | Platform          | S4                      |
| R-TM-D3 | Denial of Service      | Cloudflare origin DDoS                                     | Low        | High     | **Medium**   | Open        | DevOps            | Ongoing (Cloudflare)    |
| R-TM-D4 | Denial of Service      | Large session payload causing resource exhaustion          | Low        | Medium   | **Low**      | Open        | Platform          | S4                      |
| R-TM-E1 | Elevation of Privilege | `read` scope upgraded to `admin` via missing scope guard   | Medium     | Critical | **Critical** | Open        | Platform          | S4 – vendor test        |
| R-TM-E2 | Elevation of Privilege | Cross-workspace API key via tenant-bypass bug              | Low        | High     | **Medium**   | Open        | Platform          | S4                      |
| R-TM-E3 | Elevation of Privilege | OAuth2-proxy misconfiguration exposes services             | Low        | High     | **Medium**   | Open        | DevOps            | S4                      |
| R-TM-E4 | Elevation of Privilege | Worker runtime RCE through template / eval                 | Low        | Critical | **High**     | Open        | Platform          | S4                      |

---

## 4. Findings from Automated Vulnerability Scanning (S3)

Source: `docs/linear-audit/s3-scan-results.md`

### 4.1 Dependency Vulnerabilities

> **Note:** Trivy filesystem scan reports **1 Critical + 42 High** findings in
> total. The table below groups them by the 17 distinct package-level risk
> areas; those 17 packages collectively account for the 42 HIGH findings through
> multiple CVEs per package and transitive dependency hits. The remaining Trivy
> output is duplicate reporting of the same underlying packages.

| ID      | Severity     | Package           | Current   | Target  | Status        | Owner           | Tracking Issue            |
| ------- | ------------ | ----------------- | --------- | ------- | ------------- | --------------- | ------------------------- |
| R-S3-01 | **Critical** | vllm              | 0.20.2rc1 | ≥0.22.0 | Open          | AI/ML           | CVE-2026-48746 / PIX-4161 |
| R-S3-02 | **High**     | pillow            | <12.3.0   | ≥12.3.0 | Open          | AI/ML           | Multiple CVEs             |
| R-S3-03 | **High**     | gitpython         | <3.1.55   | ≥3.1.55 | Open          | AI/ML / Tooling |                           |
| R-S3-04 | **High**     | vllm              | <0.24.0   | ≥0.24.0 | Open          | AI/ML           | Multiple CVEs             |
| R-S3-05 | **High**     | postcss           | <8.5.18   | ≥8.5.18 | Open          | Platform        | Build-time                |
| R-S3-06 | **High**     | mcp               | <1.28.1   | ≥1.28.1 | Open          | AI/ML           |                           |
| R-S3-07 | **High**     | python-multipart  | <0.0.30   | ≥0.0.30 | **Mitigated** | Platform        | PIX-4160 / pixelated#5102 |
| R-S3-08 | **High**     | starlette         | <1.3.1    | ≥1.3.1  | **Mitigated** | Platform        | pixelated#5102            |
| R-S3-09 | **High**     | urllib3           | <2.7.0    | ≥2.7.0  | Open          | Platform        |                           |
| R-S3-10 | **High**     | brace-expansion   | <5.0.8    | ≥5.0.8  | Open          | Platform        | PIX-4162 follow-up        |
| R-S3-11 | **High**     | pyasn1            | <0.6.4    | ≥0.6.4  | Open          | Platform        |                           |
| R-S3-12 | **High**     | cryptography      | <48.0.1   | ≥48.0.1 | Open          | Platform        |                           |
| R-S3-13 | **High**     | pyjwt             | <2.13.0   | ≥2.13.0 | **Mitigated** | Platform        | PIX-4159 / pixelated#5102 |
| R-S3-14 | **High**     | httplib2          | <0.32.0   | ≥0.32.0 | Open          | Platform        |                           |
| R-S3-15 | **High**     | react-router      | <8.3.0    | ≥8.3.0  | Open          | Platform        | Major migration           |
| R-S3-16 | **High**     | sharp             | <0.35.0   | ≥0.35.0 | Open          | Platform        | Build-time                |
| R-S3-17 | **High**     | golang.org/x/text | <0.39.0   | ≥0.39.0 | Open          | Platform        | Tooling                   |

### 4.2 Secret-Exposure Findings

| ID      | Source                                                               |       Count | Severity                      | Status   | Owner    |
| ------- | -------------------------------------------------------------------- | ----------: | ----------------------------- | -------- | -------- |
| R-S3-18 | Real source (`src/components/auth/AuthProvider.tsx`)                 | 5 locations | Low (verified false positive) | Accepted | Platform |
| R-S3-19 | Infra YAML (`infra/sinker/`, `infra/config/production/`)             |          14 | **High**                      | Open     | DevOps   |
| R-S3-20 | K8s cluster backup (`cluster-backup-20251019-203844/resources.yaml`) |          48 | **High**                      | Open     | DevOps   |

### 4.3 Audit Correctness Finding

| ID      | Risk                                                                                          | Severity | Status                              | Owner    |
| ------- | --------------------------------------------------------------------------------------------- | -------- | ----------------------------------- | -------- |
| R-S3-21 | Sprint Notes incorrectly claimed "0 critical, 0 high" while scans showed 1 critical + 42 high | **High** | Mitigated (documentation corrected) | Security |

---

## 5. Compliance Mapping

| Framework | Control                             | Risk IDs Covered          | Evidence Required               |
| --------- | ----------------------------------- | ------------------------- | ------------------------------- |
| SOC 2     | CC6.1, CC6.6, CC7.1                 | R-TM-S1 to R-TM-E4        | Annual external pentest report  |
| HIPAA     | §164.308(a)(1)(ii)(A) Risk Analysis | R-TM-I1, R-TM-I2, R-TM-I3 | This register + threat model    |
| ISO 27001 | A.14.2.8, A.18.2.3                  | R-S3-01 to R-S3-21        | Pentest report + scan artifacts |

---

## 6. Risk Acceptance

Any risk marked `Accepted` or `Transferred` must include:

- Business justification
- Accepting party (name + date)
- Review date
- Compensating controls

| ID      | Acceptance Date | Accepted By | Justification                                               | Review Date |
| ------- | --------------- | ----------- | ----------------------------------------------------------- | ----------- |
| R-S3-18 | 2026-07-29      | Chad        | gitleaks false positive; callback path and helper name only | 2026-10-29  |

---

## 7. Action Plan

### Before Vendor Engagement (S3 → S4)

1. **Tier 1 remediation** (must complete):
   - [x] R-S3-13 pyjwt → 2.13.0 (PIX-4159) — merged
   - [x] R-S3-07 python-multipart → 0.0.30 (PIX-4160) — merged
   - [x] R-S3-08 starlette → 1.3.1 — merged

2. **Vendor prep**:
   - [ ] Finalize vendor selection (PIX-4135)
   - [ ] Sign MSA / NDA (PIX-4135)
   - [ ] Provision 3 privilege-level test accounts
   - [ ] Confirm staging environment mirrors production

### During Vendor Engagement (S4)

- Validate all `Critical` and `High` risks with active testing.
- Vendor updates this register with confirmed / new findings.

### After Vendor Engagement (S5)

- Remediate all confirmed Critical/High findings.
- Re-score residual risk.
- Publish final assessment report.

---

## 8. Change Log

| Date       | Author | Change                                                                                                                    |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-30 | Chad   | Initial risk register consolidating S2 threat model and S3 scan findings                                                  |
| 2026-07-30 | Chad   | Aligned threat-model risk IDs to STRIDE identifiers (R-TM-S1..E4)                                                         |
| 2026-07-30 | Chad   | Marked R-S3-07, R-S3-08, R-S3-13 as In Progress after Tier 1 remediation PRs opened (to be updated to Mitigated on merge) |
| 2026-07-30 | Chad   | Marked R-S3-07, R-S3-08, R-S3-13 as Mitigated after PRs merged (ai#490, docs#4, pixelated#5102)                           |
