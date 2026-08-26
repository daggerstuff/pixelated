# 2026-Q3 Findings Report

**Assessment:** Full internal security assessment — Q3 2026 **Date range:**
_TBD_ **Environment:** Staging (primary), Production (limited, read-only)
**Tester:** _TBD_ (owner: Chad) **Methodology:** OWASP Top 10, OWASP API
Security Top 10, NIST SP 800-115, PTES **Runbook:**
`docs/runbooks/penetration-testing-assessment.md`

---

## 1. Executive Summary

_Write a 3–5 sentence summary of the assessment: headline finding counts,
overall risk posture, and any areas needing immediate attention._

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 0     |
| Medium   | 0     |
| Low      | 0     |
| Info     | 0     |

> **Baseline note:** S3 automated scans (Trivy, Checkov, pnpm audit, pip-audit)
> established a clean baseline (0 Critical / 0 High) on 2026-07-30. This report
> documents the first full quarterly assessment against that baseline.

---

## 2. Scope Executed

| Asset                                    | Tested? | Notes            |
| ---------------------------------------- | ------- | ---------------- |
| Web application (`pixelatedempathy.com`) | ☐       |                  |
| REST API (`/api/*`) + GraphQL            | ☐       |                  |
| WebSocket service                        | ☐       |                  |
| Auth flows (JWT, OAuth, sessions)        | ☐       |                  |
| Admin dashboard (`/admin/*`)             | ☐       |                  |
| Cloud / K8s config                       | ☐       | Read-only review |
| CI/CD pipeline                           | ☐       |                  |
| Supply chain (SCA)                       | ☐       | Weekly automated |

---

## 3. Findings

### 3.1 Summary Table

| ID             | Severity | Title             | Affected Asset | CVSS  | Status                         |
| -------------- | -------- | ----------------- | -------------- | ----- | ------------------------------ |
| _SEC-FIND-001_ | _High_   | _Example finding_ | _API_          | _7.5_ | _Open / Remediated / Verified_ |

### 3.2 Detailed Findings

#### SEC-FIND-001 — Title

- **Severity:** High (CVSS 7.5)
- **Affected asset:** ...
- **Description:** ...
- **Reproduction steps:**
  1. ...
  2. ...
- **Impact:** ...
- **Recommended remediation:** ...
- **Linear ticket:** `SEC-FIND-NNN`
- **Remediation SLA deadline:** ...
- **Status:** Open / Remediated / Verified

---

## 4. Remediation & Retest

| Finding        | SLA met? | Fix deployed? | Retested? | Closure date |
| -------------- | -------- | ------------- | --------- | ------------ |
| _SEC-FIND-001_ | _Yes/No_ | _Yes/No_      | _Yes/No_  | _YYYY-MM-DD_ |

---

## 5. Compliance Evidence

- Risk register updated: `docs/linear-audit/risk-register.md`
- Findings register updated: `docs/linear-audit/findings-register.md`
- SOC 2 CC7.1 evidence: this report + remediation tracker
- HIPAA §164.308(a)(1)(ii)(A) evidence: this report + risk analysis

---

## Change Log

| Date       | Author | Change                                                 |
| ---------- | ------ | ------------------------------------------------------ |
| 2026-07-31 | Chad   | Template created; baseline noted (0 Critical / 0 High) |
