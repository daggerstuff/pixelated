# Request for Proposal — External Penetration Test

**Issued by:** Pixelated Empathy **RFP date:** 2026-07-30 **Response deadline:**
2026-08-15 **Anticipated engagement start:** 2026-09-01 **Contact:** Chad
<chad@pixelatedempathy.com>

---

## 1. Introduction

Pixelated Empathy is seeking qualified cybersecurity vendors to conduct an
external penetration test of our production web application, public API, and
supporting infrastructure. This engagement is required to close an enterprise
readiness gap (Linear PIX-4126) and satisfy customer and compliance
requirements.

This RFP describes the scope, deliverables, evaluation criteria, and submission
requirements. Vendors should provide a detailed proposal including methodology,
team qualifications, timeline, and pricing.

---

## 2. Company Overview

Pixelated Empathy provides an AI-assisted therapeutic platform. Our stack
includes:

- Edge / WAF: Cloudflare
- Compute: Civo Kubernetes (blue/green deployments)
- Application: Astro SSR + Node services
- Authentication: Auth0 (JWT) + API keys
- Database: PostgreSQL (multi-tenant)
- Observability: Sentry, Prometheus, Grafana

Detailed architecture is available in the threat model document shared under
NDA.

---

## 3. Scope of Work

### 3.1 In Scope

- External web application (`https://pixelatedempathy.com`)
- Public API per `docs/api-reference/openapi.yaml`
- Authentication flows (Auth0)
- Cross-tenant data boundary testing
- API scope / RBAC escalation testing
- JWT and API-key validation
- Cloudflare edge / Civo K8s ingress configuration review
- Secrets exposed in git history (gitleaks triage support)
- Container image scanning (if images provided)

### 3.2 Out of Scope

- Social engineering
- Physical security assessments
- Third-party SaaS infrastructure (Auth0, Cloudflare, Sentry)
- Volumetric DDoS beyond Cloudflare capacity
- AI model hallucination / bias testing

### 3.3 Testing Methodology

Vendors should propose a methodology that includes, at minimum:

- Reconnaissance and threat modeling review
- Automated and manual vulnerability assessment
- Authentication and session management testing
- Authorization and cross-tenant boundary testing
- API endpoint fuzzing and business logic testing
- Configuration review of cloud and Kubernetes resources
- Report of findings with CVSS scores and remediation guidance

---

## 4. Deliverables

The vendor will deliver:

1. **Executive summary** suitable for leadership and board review
2. **Detailed findings report** with CVSS scores and evidence
3. **Reproduction steps** for each confirmed vulnerability
4. **Remediation recommendations** with prioritized roadmap
5. **Risk register update** aligned with `docs/linear-audit/risk-register.md`
6. **Re-test report** for all Critical and High findings after remediation

---

## 5. Evaluation Criteria

Proposals will be evaluated on:

| Criterion                                                  | Weight |
| ---------------------------------------------------------- | ------ |
| Relevant healthcare / AI platform experience               | 20%    |
| Methodology and depth of testing                           | 25%    |
| Team qualifications and certifications (OSCP, GWAPT, etc.) | 20%    |
| Timeline and availability                                  | 15%    |
| Pricing and value                                          | 15%    |
| References from similar engagements                        | 5%     |

---

## 6. Submission Requirements

Please submit the following in PDF format to the contact listed above:

1. Company overview and relevant experience
2. Proposed methodology and tools
3. Team structure and resumes of key testers
4. Sample report (sanitized)
5. Timeline with key milestones
6. Pricing model (fixed fee preferred) and payment terms
7. Insurance and liability information
8. Two professional references

---

## 7. Timeline

| Milestone                    | Date       |
| ---------------------------- | ---------- |
| RFP issued                   | 2026-07-30 |
| Vendor Q&A deadline          | 2026-08-08 |
| Proposal deadline            | 2026-08-15 |
| Evaluation complete          | 2026-08-22 |
| Vendor selected / MSA signed | 2026-08-22 |
| SOW finalized                | 2026-08-25 |
| Engagement kickoff           | 2026-09-01 |

---

## 8. Rules of Engagement

Selected vendor must agree to:

- Conduct testing only against authorized targets
- Report findings promptly and confidentially
- Provide a secure channel for critical disclosures
- Destroy all customer data within 30 days of engagement close
- Comply with Pixelated Empathy's MSA, NDA, and code of conduct

---

## 9. Attachments

- `docs/linear-audit/threat-model-scope.md`
- `docs/linear-audit/api-specification-vendor-share.md`
- `docs/linear-audit/risk-register.md`
- `docs/linear-audit/pentest-cadence.md`
- `docs/linear-audit/vendor-sow.md`

---

## 10. Change Log

| Date       | Author | Change      |
| ---------- | ------ | ----------- |
| 2026-07-30 | Chad   | Initial RFP |
