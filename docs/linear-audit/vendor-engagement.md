# External Pentest — Vendor Engagement Tracker

**Parent:** PIX-4126 — Enterprise Gap: Penetration Testing & External Security
Assessment **Last updated:** 2026-07-30 **Owner:** Chad **Status:** Vendor
selection in progress

---

## 1. Objective

Track vendor selection, scoping, and execution of the first annual external
penetration test for Pixelated Empathy.

---

## 2. RFP / SOW Documents

| Document                   | File                              | Status      |
| -------------------------- | --------------------------------- | ----------- |
| Request for Proposal (RFP) | `docs/linear-audit/vendor-rfp.md` | ✅ Complete |
| Statement of Work (SOW)    | `docs/linear-audit/vendor-sow.md` | ✅ Complete |

## 3. Vendor Selection Checklist

| Step                         | Status         | Due Date   | Owner          | Notes                            |
| ---------------------------- | -------------- | ---------- | -------------- | -------------------------------- |
| Define scope & requirements  | ✅ Done        | 2026-07-29 | Chad           | Threat model + S3 scans complete |
| Short-list qualified vendors | 🔄 In Progress | 2026-08-04 | Chad           | Need ≥2 vendors                  |
| Issue RFP / SOW              | ⏳ Pending     | 2026-08-08 | Chad           | Blocked on short-list            |
| Evaluate proposals           | ⏳ Pending     | 2026-08-15 | Chad + CTO     |                                  |
| Select vendor                | ⏳ Pending     | 2026-08-18 | CTO            |                                  |
| Sign MSA / NDA               | ⏳ Pending     | 2026-08-22 | Legal + Vendor | Tracked in PIX-4135              |
| Finalize SOW & kickoff       | ⏳ Pending     | 2026-08-25 | Chad + Vendor  | SOW document ready               |

---

## 4. Scope of Work (for Vendor)

### 4.1 In Scope

- External web application (`https://pixelatedempathy.com`)
- Public API per `docs/api-reference/openapi.yaml`
- Authentication flows (Auth0)
- Cross-tenant data boundary testing
- API scope / RBAC escalation testing
- JWT and API-key validation
- Cloudflare edge / Civo K8s ingress configuration review
- Secrets exposed in git history (gitleaks triage)
- Container image scanning (if images provided)

### 4.2 Out of Scope

- Social engineering
- Physical security
- Third-party SaaS infrastructure (Auth0, Cloudflare, Sentry)
- Volumetric DDoS beyond Cloudflare capacity
- AI model hallucination / bias testing

### 4.3 Deliverables

1. Executive summary
2. Detailed findings report with CVSS scores
3. Reproduction steps for each finding
4. Remediation recommendations
5. Risk register update (`docs/linear-audit/risk-register.md`)
6. Re-test of Critical/High findings after remediation

---

## 5. Vendor Communication Log

| Date      | Vendor    | Contact   | Method    | Summary   | Next Action |
| --------- | --------- | --------- | --------- | --------- | ----------- |
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_   |

---

## 6. Documents Shared with Vendor

| Document                                              | Version   | Date Shared | SHA-256   | Vendor Ack |
| ----------------------------------------------------- | --------- | ----------- | --------- | ---------- |
| `docs/linear-audit/threat-model-scope.md`             | v1.0      | _pending_   | _pending_ | _pending_  |
| `docs/linear-audit/api-specification-vendor-share.md` | v1.0      | _pending_   | _pending_ | _pending_  |
| `docs/api-reference/openapi.yaml`                     | _pending_ | _pending_   | _pending_ | _pending_  |
| `docs/api-reference/openapi.json`                     | _pending_ | _pending_   | _pending_ | _pending_  |
| `docs/linear-audit/vendor-sow.md`                     | v1.0      | _pending_   | _pending_ | _pending_  |

---

## 7. Engagement Timeline

| Milestone              | Target Date             | Status |
| ---------------------- | ----------------------- | ------ |
| Vendor kickoff         | 2026-09-01              | ⏳     |
| Testing window         | 2026-09-08 – 2026-09-22 | ⏳     |
| Draft report delivered | 2026-09-29              | ⏳     |
| Remediation window     | 2026-09-30 – 2026-11-28 | ⏳     |
| Re-test                | 2026-11-29 – 2026-12-06 | ⏳     |
| Final report           | 2026-12-13              | ⏳     |

---

## 8. Related Linear Issues

| Issue    | Title                                                              | Status             |
| -------- | ------------------------------------------------------------------ | ------------------ |
| PIX-4126 | Enterprise Gap: Penetration Testing & External Security Assessment | In Progress        |
| PIX-4135 | Vendor selection, MSA/NDA, Rules of Engagement                     | TBD                |
| PIX-4136 | S2: Reconnaissance & Threat Modeling                               | In Progress        |
| PIX-4137 | S3: Automated Vulnerability Scanning — Infrastructure              | In Progress        |
| PIX-4159 | Bump pyjwt to ≥2.13.0                                              | In Progress        |
| PIX-4160 | Bump python-multipart to ≥0.0.30                                   | In Progress        |
| PIX-4162 | Bump @babel/core via pnpm.overrides                                | Done per S3 report |

---

## 9. Change Log

| Date       | Author | Change                            |
| ---------- | ------ | --------------------------------- |
| 2026-07-30 | Chad   | Initial vendor engagement tracker |
