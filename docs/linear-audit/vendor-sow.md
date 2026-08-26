# Statement of Work — External Penetration Test

**Client:** Pixelated Empathy **Vendor:** _[To be filled after selection]_ **SOW
effective date:** _[To be filled]_ **Engagement start:** 2026-09-01 **Engagement
end:** 2026-12-13 **Parent:** PIX-4126 — Enterprise Gap: Penetration Testing &
External Security Assessment **Last updated:** 2026-07-30

---

## 1. Purpose

This Statement of Work (SOW) defines the commercial and technical terms for an
external penetration test of Pixelated Empathy's web application, public API,
and supporting cloud infrastructure. It is issued under the Master Services
Agreement (MSA) and Non-Disclosure Agreement (NDA) executed by both parties.

---

## 2. Scope

### 2.1 In Scope

- External web application (`https://pixelatedempathy.com`)
- Public API per `docs/api-reference/openapi.yaml`
- Authentication flows (Auth0)
- Cross-tenant data boundary testing
- API scope / RBAC escalation testing
- JWT and API-key validation
- Cloudflare edge / Civo K8s ingress configuration review
- Secrets exposed in git history (gitleaks triage support)
- Container image scanning (if images provided)

### 2.2 Out of Scope

- Social engineering
- Physical security assessments
- Third-party SaaS infrastructure (Auth0, Cloudflare, Sentry) — those vendors
  conduct their own assessments
- Volumetric DDoS beyond Cloudflare's tested capacity
- AI model hallucination / bias testing

### 2.3 Testing Methodology

The vendor will follow a methodology aligned with OWASP Testing Guide v4.2 and
PTES, including:

1. Pre-engagement and scoping call
2. Reconnaissance and information gathering
3. Threat modeling review
4. Vulnerability scanning and manual testing
5. Authentication and authorization testing
6. Cross-tenant boundary testing
7. Business logic and API testing
8. Reporting and remediation planning
9. Re-test of Critical/High findings

---

## 3. Deliverables

| Deliverable                            | Format            | Due Date           |
| -------------------------------------- | ----------------- | ------------------ |
| Kickoff agenda and rules of engagement | PDF               | Kickoff            |
| Weekly status updates                  | Email / Slack     | Weekly during test |
| Draft findings report                  | PDF               | 2026-09-29         |
| Final findings report                  | PDF               | 2026-12-13         |
| Remediation tracker                    | Spreadsheet / CSV | With final report  |
| Re-test summary                        | PDF               | 2026-12-13         |

### 3.1 Report Contents

The final report will include, for each finding:

- Title and unique identifier
- Severity (Critical / High / Medium / Low) with CVSS score
- Likelihood and impact assessment
- Technical description and evidence
- Step-by-step reproduction guidance
- Remediation recommendations
- Mapping to `docs/linear-audit/risk-register.md`

---

## 4. Timeline

| Milestone              | Target Date             |
| ---------------------- | ----------------------- |
| Kickoff and scoping    | 2026-09-01              |
| Testing window         | 2026-09-08 – 2026-09-22 |
| Draft report delivered | 2026-09-29              |
| Remediation window     | 2026-09-30 – 2026-11-28 |
| Re-test                | 2026-11-29 – 2026-12-06 |
| Final report           | 2026-12-13              |

---

## 5. Roles & Responsibilities

### 5.1 Pixelated Empathy

- Provide access to staging environment matching production
- Provision test accounts at 3 privilege levels (read / write / admin)
- Share sanitized API specifications
- Designate a technical point of contact
- Review findings and prioritize remediation
- Remediate Critical/High findings within 90 days

### 5.2 Vendor

- Conduct testing within agreed scope and timeline
- Communicate critical findings immediately
- Provide clear, actionable reports
- Respect rules of engagement and NDA
- Destroy all client data within 30 days of engagement close
- Support re-test of Critical/High findings

---

## 6. Assumptions & Dependencies

- Staging environment will be available and stable during testing window
- Vendor will receive test accounts within 3 business days of kickoff
- API specs will be shared in sanitized form
- Vendor has all required tooling and licenses
- No production testing without explicit written approval

---

## 7. Pricing & Payment

| Item                  | Amount           | Notes                                              |
| --------------------- | ---------------- | -------------------------------------------------- |
| Base engagement fee   | _[To be filled]_ | Includes testing, reporting, and one re-test cycle |
| Travel expenses       | _[To be filled]_ | If on-site work is required                        |
| Additional re-testing | _[To be filled]_ | Optional, per diem rate                            |
| Payment terms         | Net 30           | Invoice upon final report delivery                 |

---

## 8. Acceptance Criteria

This engagement will be considered complete when:

- All in-scope systems have been tested
- Draft and final reports have been delivered and accepted
- All Critical and High findings have been re-tested or accepted in writing
- Risk register has been updated with confirmed findings
- Vendor has certified destruction of client data

---

## 9. Governing Documents

- `docs/linear-audit/threat-model-scope.md`
- `docs/linear-audit/api-specification-vendor-share.md`
- `docs/linear-audit/risk-register.md`
- `docs/linear-audit/pentest-cadence.md`
- `docs/linear-audit/vendor-rfp.md`

---

## 10. Change Log

| Date       | Author | Change      |
| ---------- | ------ | ----------- |
| 2026-07-30 | Chad   | Initial SOW |
