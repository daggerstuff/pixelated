# Penetration Test — Rules of Engagement (RoE)

**Parent:** PIX-4126 — Enterprise Gap: Penetration Testing & External Security
Assessment **Sub-issue:** PIX-4135 (S1) — Pre-Engagement: Scope Definition &
Vendor Selection **Last updated:** 2026-07-31 **Owner:** Chad **Status:** Draft
(vendor-agnostic; final version to be co-signed with selected vendor)

---

## 1. Purpose

This document defines the mutually agreed rules, boundaries, and procedures
governing the external penetration test ("the Engagement") performed against
Pixelated Empathy's ("the Company") production-representative environments. It
protects both parties, authorizes the tester to act, and ensures the test does
not cause harm to production systems, users, or data.

It is vendor-agnostic by design: the same terms are offered to every vendor on
the shortlist (Bishop Fox, Cobalt, Synack, HackerOne, Pentest People) and
finalized once the vendor is selected.

---

## 2. Authorized Parties

| Role              | Party                                       | Responsibility                                            |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| Client (Company)  | Pixelated Empathy                           | Authorizes the test, provides access, remediates findings |
| Testers           | Selected vendor team                        | Executes the test within these rules                      |
| Client POC        | Chad (Security)                             | Single point of contact for all testing questions         |
| Technical POC     | Platform Engineering                        | Environment access, staging credentials, WAF adjustments  |
| Emergency Contact | On-call via `security@pixelatedempathy.com` | Immediate stop-work authority                             |

---

## 3. Authorized Scope

### 3.1 In-Scope Systems (see `pentest-asset-inventory.md`)

- `https://pixelatedempathy.com` and `https://www.pixelatedempathy.com`
- Public REST API (`/api/*`) and GraphQL endpoint per
  `docs/api-reference/openapi.yaml`
- WebSocket service (`ws://` therapy chat)
- Staging environment (primary target) — mirrors production without PHI
- Civo Kubernetes ingress + Cloudflare edge configuration (read-only review)
- Public container images provided by the Company

### 3.2 Authorized Techniques

- Black-box and gray-box testing against staging
- Authenticated testing with accounts provided at all privilege levels
- SQL injection, XSS, SSRF, CSRF, IDOR/BOLA, mass-assignment, auth/session
  testing
- API fuzzing and parameter discovery (`ffuf`, `kiterunner`, etc.)
- Cloud/K8s misconfiguration review (read-only)
- Passive analysis of public documentation and DNS records

---

## 4. Out of Scope & Prohibited Actions

| Item                                                        | Reason                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Volumetric DDoS beyond Cloudflare capacity                  | Risk to production availability                            |
| Social engineering of employees                             | Not part of this engagement                                |
| Physical security                                           | Not part of this engagement                                |
| Production PHI / real patient data                          | Tests use synthetic/anonymized data only                   |
| Third-party SaaS (Auth0, Cloudflare, Sentry, provider APIs) | Outside company control — tested via their interfaces only |
| AI model hallucination / bias probing                       | Tracked separately, not part of pentest                    |
| Persistence / privilege escalation beyond PoC               | No implants, no backdoors, no data exfiltration            |
| Brute-forcing user accounts with real credentials           | Only test accounts provided by the Company                 |

**Universal rule:** If a test could impact production availability, user data,
or third-party systems, **stop and ask first**.

---

## 5. Test Window & Hours

| Parameter                     | Value                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| Test window                   | As scheduled in the engagement timeline (see `vendor-engagement.md`) |
| Active testing hours          | Mon–Fri, 09:00–18:00 local (client) time                             |
| After-hours / weekend testing | By prior written agreement only                                      |
| Out-of-window scanning        | Prohibited (no automated scans outside the window)                   |

---

## 6. Communication Protocol

| Event                                       | Channel               | Contact                        | SLA                     |
| ------------------------------------------- | --------------------- | ------------------------------ | ----------------------- |
| Critical finding (active exploitation risk) | Phone + email         | Client POC + Emergency Contact | Immediate (same hour)   |
| High finding                                | Email + Linear ticket | Client POC                     | Within 24h              |
| Medium/Low findings                         | Written report        | Client POC                     | At report delivery      |
| Scope change request                        | Email                 | Client POC                     | Prior approval required |
| Stop-work request                           | Phone + email         | Testers                        | Immediate               |

**Emergency contacts** are provided in the signed version of this document
(names, phone numbers, and email addresses) and never published in the repo.

---

## 7. Data Handling & Confidentiality

- All findings, PoCs, screenshots, and test data are confidential.
- Testers may not retain client data beyond the engagement without written
  consent.
- No PHI is to be accessed or copied; any incidental exposure must be reported
  within 24 hours.
- Deliverables (report, PoCs) are transmitted over encrypted channels only.
- The Company's data retention policy requires vendor deletion of all test
  artifacts within 30 days of engagement close (see `vendor-sow.md`).

---

## 8. Finding Classification & Handling

Severity classification and remediation SLAs follow the
`penetration-testing-assessment.md` runbook §7:

| Severity | CVSS     | Remediation SLA | Notes                                      |
| -------- | -------- | --------------- | ------------------------------------------ |
| Critical | 9.0–10.0 | 7 days          | Immediate notification, stop-work possible |
| High     | 7.0–8.9  | 30 days         | Notify within 24h                          |
| Medium   | 4.0–6.9  | 90 days         | At report delivery                         |
| Low      | 0.1–3.9  | 180 days        | At report delivery                         |
| Info     | N/A      | Next quarter    | Recommendations only                       |

All confirmed findings are logged in `findings-register.md` and triaged into
Linear tickets (S9 — PIX-4143).

---

## 9. Stop-Work Conditions

The Engagement is paused immediately when any of the following occur:

1. Production outage or degradation attributable to testing
2. Exposure or potential exposure of real PHI
3. Discovery of an unanticipated critical vulnerability (tester will confirm
   with POC before continuing)
4. Third-party system impact
5. Request from the Company POC or Emergency Contact

Testing resumes only after the issue is resolved and both parties agree.

---

## 10. Legal & Compliance

- The Engagement is governed by the signed MSA and NDA between the Company and
  the selected vendor.
- The tester confirms compliance with applicable law in the testing
  jurisdictions.
- This RoE is evidence for **SOC 2 CC7.1** (system operations controls) and
  **HIPAA §164.308(a)(1)(ii)(A)** (risk analysis) audits — retain with the final
  report for 7 years.

---

## 11. Acceptance

This document requires written acceptance by:

- **Company representative** (CTO / Security Lead) — authorizes the test
- **Tester representative** (vendor) — accepts the rules and boundaries

| Party   | Name | Signature | Date |
| ------- | ---- | --------- | ---- |
| Company |      |           |      |
| Vendor  |      |           |      |

---

## 12. Change Log

| Date       | Author | Change                                                       |
| ---------- | ------ | ------------------------------------------------------------ |
| 2026-07-31 | Chad   | Initial vendor-agnostic Rules of Engagement draft (PIX-4135) |
