---
title: Vendor Security Reviews
description:
  Vendor security review process and initial Tier 1 reviews for Critical-risk
  vendors in the Pixelated Empathy vendor ecosystem, including BAA status,
  certifications, data access levels, and risk assessments.
---

<!-- markdownlint-disable MD025 MD013 MD036 MD049 -->

<div align="center">

# Vendor Security Reviews

**VRA-4: Document Vendor Security Reviews**

_Pixelated Empathy Enterprise Readiness Program_

</div>

---

## 1. Purpose & Scope

This document defines the vendor security review process and records the initial
Tier 1 security reviews for all Critical-risk vendors identified in the
[Third-Party Vendor & Dependency Inventory](./vendor-inventory.md).

**In scope**: All vendors with Critical or High risk classification (see
vendor-inventory.md Section 3) that process, store, or transmit customer or
platform data.

**Out of scope**: Low-risk open-source libraries (covered by automated
dependency vulnerability scanning — see vendor-inventory.md Section 15),
self-hosted infrastructure components (covered by the SLO and DR runbooks).

**Parent ticket**: [PIX-4129](https://linear.app/pixelated/issue/PIX-4129) —
Vendor Risk Assessment & Third-Party Audit, acceptance criterion 4.

---

## 2. Review Process

### 2.1 When to Review

| Trigger                                   | Action                        |
| ----------------------------------------- | ----------------------------- |
| New vendor onboarding                     | Initial review before go-live |
| Scheduled cadence (see §2.2)              | Periodic review               |
| Security incident involving vendor        | Ad-hoc review within 7 days   |
| Contract renewal / renegotiation          | Review before renewal         |
| BAA expiration                            | Review + renew 60 days prior  |
| Material change to vendor's data handling | Review within 14 days         |

### 2.2 Review Cadence

| Vendor Risk | Cadence                 | Reviewer                   |
| ----------- | ----------------------- | -------------------------- |
| Critical    | Quarterly + on-incident | Security lead + compliance |
| High        | Semi-annually           | Security lead              |
| Medium      | Annually                | Engineering lead           |
| Low         | Biennially              | Engineering lead           |

### 2.3 Review Checklist

Each vendor review documents the following (per vendor-inventory.md Section
16.3):

- [ ] Current data access level confirmed (see vendor-inventory.md Section 2)
- [ ] BAA status (if applicable) confirmed current
- [ ] SLA performance over review period
- [ ] Security incidents in review period
- [ ] Pricing / contract changes
- [ ] Certification status (SOC2, ISO 27001, HIPAA, FedRAMP)
- [ ] Data residency confirmed
- [ ] Exit / data deletion procedure tested
- [ ] Replacement vendor identified (if critical)
- [ ] Penetration test results reviewed (if available)

### 2.4 Review Output

Each completed review is stored at:

```
.agent/internal/vendor-reviews/<vendor-name>-YYYY-QQ.md
```

Reviews include: reviewer name, date, risk rating change (if any), findings,
action items with owners and due dates, and a pass/fail/watch decision.

### 2.5 Escalation Criteria

A vendor review results in **fail** if any of the following are true:

1. BAA required but not executed (Critical/High-risk vendors w/ PHI access)
2. Data access level exceeds what the contract permits
3. Security incident unresolved with no remediation plan
4. Certification lapsed > 90 days (for HIPAA-relevant vendors)
5. SLA performance below contracted threshold for 2 consecutive quarters
6. Exit/deletion procedure cannot be verified

A **watch** designation means: concerns identified but not blocking, re-review
in 30 days. A **pass** means: all checklist items satisfied, no blocking
concerns.

---

## 3. Tier 1 Vendor Reviews — Initial Assessment

The following 11 vendors are classified as Critical risk in vendor-inventory.md.
These initial reviews were conducted as part of PIX-4129 to establish a
baseline. Each will be re-reviewed quarterly.

> **Note**: These are documentation-only baseline reviews based on vendor public
> documentation, SDK capabilities, and contractual terms available at time of
> writing. No vendor-side penetration testing or audit was performed. Follow-up
> action items (VRA-4.x) track items requiring verification with the vendor.

### 3.1 OpenAI

| Field                         | Value                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| **Service**                   | GPT models, Whisper, Embeddings API                                           |
| **Data access level**         | L4 — prompt content (inference payloads)                                      |
| **BAA status**                | Required — OpenAI offers BAA for HIPAA-eligible accounts (zero-retention API) |
| **BAA executed**              | No — **follow-up VRA-4.1 (P0)**                                               |
| **SLA**                       | 99.9% API uptime (per OpenAI terms)                                           |
| **Certifications**            | SOC2 Type II, ISO 27001, HIPAA-eligible                                       |
| **Data residency**            | US (default), EU (optional)                                                   |
| **Security incidents (12mo)** | None publicly disclosed                                                       |
| **Zero-retention mode**       | Available — must be enabled per-request or org-wide                           |
| **Replacement vendor**        | Anthropic Claude, Google Gemini, self-hosted Llama                            |
| **Exit plan**                 | API account deletion + zero-retention confirmation                            |
| **Initial review decision**   | **Watch** — BAA not yet executed                                              |

**Findings**:

- OpenAI is HIPAA-eligible and offers zero-retention API mode, but BAA must be
  executed before any PHI is sent.
- Zero-retention mode must be explicitly enabled; default mode retains prompts
  for 30 days (as of 2026-07).
- SOC2 Type II and ISO 27001 certifications current.

**Action items**:

- VRA-4.1: Execute BAA with OpenAI (P0, Compliance, due 30 days)
- VRA-4.2: Verify zero-retention API mode is enabled org-wide (P0, Engineering,
  due 14 days)

### 3.2 Anthropic

| Field                         | Value                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| **Service**                   | Claude models API                                                           |
| **Data access level**         | L4 — prompt content                                                         |
| **BAA status**                | Required — Anthropic offers BAA for HIPAA-eligible                          |
| **BAA executed**              | No — **follow-up VRA-4.3 (P0)**                                             |
| **SLA**                       | 99.9% API uptime                                                            |
| **Certifications**            | SOC2 Type II, ISO 27001, HIPAA-eligible                                     |
| **Data residency**            | US                                                                          |
| **Security incidents (12mo)** | None publicly disclosed                                                     |
| **Zero-retention mode**       | Available — API usage policy states no training on customer data by default |
| **Replacement vendor**        | OpenAI GPT, Google Gemini, self-hosted                                      |
| **Exit plan**                 | API account deletion + zero-retention confirmation                          |
| **Initial review decision**   | **Watch** — BAA not yet executed                                            |

**Findings**:

- Anthropic's API usage policy states customer data is not used for training by
  default, reducing risk even without zero-retention mode.
- HIPAA-eligible with BAA available.
- SOC2 Type II and ISO 27001 current.

**Action items**:

- VRA-4.3: Execute BAA with Anthropic (P0, Compliance, due 30 days)

### 3.3 Google Gemini (Vertex AI / GenAI)

| Field                         | Value                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Service**                   | Gemini models via google-genai SDK / Vertex AI                                 |
| **Data access level**         | L4 — prompt content                                                            |
| **BAA status**                | Required — Google Cloud offers BAA (HIPAA-eligible)                            |
| **BAA executed**              | No — **follow-up VRA-4.4 (P0)**                                                |
| **SLA**                       | 99.9% (Vertex AI), 99.95% (Cloud Storage)                                      |
| **Certifications**            | SOC2, ISO 27001, ISO 27017, ISO 27018, HIPAA, FedRAMP High                     |
| **Data residency**            | US, EU (configurable via Vertex AI regions)                                    |
| **Security incidents (12mo)** | None material to Pixelated Empathy                                             |
| **Zero-retention mode**       | Customer-managed encryption keys (CMEK); data not used for training by default |
| **Replacement vendor**        | OpenAI, Anthropic, self-hosted                                                 |
| **Exit plan**                 | Project deletion, CMEK key destruction                                         |
| **Initial review decision**   | **Watch** — BAA not yet executed                                               |

**Findings**:

- Google Cloud has the broadest certification set (FedRAMP High, ISO 27018 for
  cloud privacy).
- CMEK available for encryption key control.
- Data residency configurable — ensure US/EU region matches HIPAA requirements.

**Action items**:

- VRA-4.4: Execute BAA with Google Cloud (P0, Compliance, due 30 days)
- VRA-4.5: Configure CMEK for Vertex AI resources (P1, Engineering, due 60 days)

### 3.4 Auth0 (Okta)

| Field                         | Value                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| **Service**                   | Identity provider (OAuth2/OIDC), user authentication       |
| **Data access level**         | L3 — user IDs, email, profile metadata                     |
| **BAA status**                | Required — Auth0 offers BAA at Enterprise tier             |
| **BAA executed**              | No — **follow-up VRA-4.6 (P0)**                            |
| **SLA**                       | 99.99% (EU), 99.95% (US)                                   |
| **Certifications**            | SOC2 Type II, ISO 27001, HIPAA-eligible (Enterprise)       |
| **Data residency**            | US (current tenant: dev-f3vkhvb6n52y7fre.us.auth0.com)     |
| **Security incidents (12mo)** | Sept 2023: Okta support case breach (resolved)             |
| **MFA**                       | Supported (TOTP, SMS, push)                                |
| **Replacement vendor**        | Keycloak (self-hosted), AWS Cognito                        |
| **Exit plan**                 | User directory export (CSV/LDIF), tenant deletion          |
| **Initial review decision**   | **Watch** — BAA not yet executed, Enterprise tier required |

**Findings**:

- Current Auth0 tenant is on a Developer plan — HIPAA BAA requires Enterprise
  tier upgrade.
- Sept 2023 Okta support case breach affected 1Password and others; Auth0 itself
  was not directly impacted but Okta parent company incident warrants
  monitoring.
- MFA available but not enforced by default.

**Action items**:

- VRA-4.6: Upgrade to Auth0 Enterprise tier + execute BAA (P0, Compliance, due
  30 days)
- VRA-4.7: Enforce MFA for all admin accounts (P1, Engineering, due 14 days)

### 3.5 AWS (S3 / KMS / EKS / RDS)

| Field                         | Value                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| **Service**                   | S3 (object storage), KMS (key management), EKS (K8s), RDS                     |
| **Data access level**         | L4 — PHI stored in S3 buckets w/ KMS encryption                               |
| **BAA status**                | Required — AWS offers BAA (HIPAA-eligible services)                           |
| **BAA executed**              | No — **follow-up VRA-4.8 (P0)**                                               |
| **SLA**                       | S3: 99.9%, KMS: 99.9%, EKS: 99.95%, RDS: 99.95%                               |
| **Certifications**            | SOC 1/2/3, ISO 27001/27017/27018, HIPAA, FedRAMP, PCI DSS, IRAP               |
| **Data residency**            | Region-configurable (current: hel1 via Hetzner for compute, S3 in AWS region) |
| **Security incidents (12mo)** | None material to Pixelated Empathy                                            |
| **Encryption**                | AES-256 at rest (S3), KMS-managed keys                                        |
| **Replacement vendor**        | GCP (Cloud Storage), Azure (Blob), self-hosted MinIO                          |
| **Exit plan**                 | S3 object export, KMS key destruction, bucket deletion                        |
| **Initial review decision**   | **Watch** — BAA not yet executed                                              |

**Findings**:

- AWS has the most comprehensive certification portfolio.
- S3 buckets must have: server-side encryption (KMS), versioning enabled, public
  access block, and bucket policy restricting to authorized roles.
- KMS keys should have rotation enabled (annual).

**Action items**:

- VRA-4.8: Execute BAA with AWS (P0, Compliance, due 30 days)
- VRA-4.9: Verify S3 bucket policies + KMS key rotation (P1, Engineering, due 30
  days)

### 3.6 Cloudflare

| Field                         | Value                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **Service**                   | Workers, R2, Workers AI, Turnstile, DDoS, DNS                                |
| **Data access level**         | L4 — request payloads (edge), R2 objects                                     |
| **BAA status**                | Not available for Workers/R2 (edge-only); conditional for Enterprise         |
| **BAA executed**              | N/A — **follow-up VRA-4.10 (P1)**                                            |
| **SLA**                       | Workers: 99.99%, R2: 99.99%, DNS: 100%                                       |
| **Certifications**            | SOC2 Type II, ISO 27001, ISO 27018, FedRAMP Moderate                         |
| **Data residency**            | Edge (global), R2 region-configurable                                        |
| **Security incidents (12mo)** | Nov 2023: Cloudflare R2 outage (resolved)                                    |
| **Edge-only PHI**             | If PHI stays at edge (Workers) and is not persisted, BAA may not be required |
| **Replacement vendor**        | Self-hosted Caddy/nginx, AWS Lambda@Edge                                     |
| **Exit plan**                 | R2 object export, Workers code export, account deletion                      |
| **Initial review decision**   | **Pass** (conditional) — edge-only PHI w/o persistence                       |

**Findings**:

- Cloudflare Workers run at the edge — if PHI is processed but not persisted,
  BAA may not be legally required. Legal counsel should confirm.
- Workers AI inference runs at the edge; prompt payloads are not persisted by
  default.
- Turnstile (CAPTCHA alternative) does not process PHI.
- R2 objects can contain PHI — ensure encryption at rest (default AES-128).
- High uptime SLA (99.99% Workers).

**Action items**:

- VRA-4.10: Legal counsel opinion on edge-only PHI + BAA necessity (P1,
  Compliance, due 60 days)
- VRA-4.11: Ensure R2 buckets w/ PHI use customer-managed keys if available (P2,
  Engineering)

### 3.7 MongoDB Atlas

| Field                         | Value                                                             |
| ----------------------------- | ----------------------------------------------------------------- |
| **Service**                   | Managed MongoDB (M30+ cluster)                                    |
| **Data access level**         | L4 — PHI in MongoDB collections                                   |
| **BAA status**                | Required — MongoDB Atlas offers BAA at HIPAA-eligible tier (M10+) |
| **BAA executed**              | No — **follow-up VRA-4.12 (P0)**                                  |
| **SLA**                       | 99.95% (M30+), 99.99% (M50+)                                      |
| **Certifications**            | SOC2 Type II, ISO 27001, HIPAA-eligible                           |
| **Data residency**            | Region-configurable (ensure US/EU per HIPAA)                      |
| **Security incidents (12mo)** | None material                                                     |
| **Encryption**                | AES-256 at rest, TLS 1.2+ in transit                              |
| **Backup**                    | Continuous backups + point-in-time recovery                       |
| **Replacement vendor**        | Self-hosted MongoDB, PostgreSQL                                   |
| **Exit plan**                 | mongodump export, cluster termination, backup deletion            |
| **Initial review decision**   | **Watch** — BAA + cluster tier verification needed                |

**Findings**:

- MongoDB Atlas is HIPAA-eligible at M10+ tier.
- Must verify current cluster tier meets HIPAA requirements (M30+ recommended).
- Continuous backups + PITR available at no extra cost.

**Action items**:

- VRA-4.12: Execute BAA with MongoDB Atlas (P0, Compliance, due 30 days)
- VRA-4.13: Verify cluster tier is M30+ for HIPAA compliance (P1, Engineering,
  due 14 days)

### 3.8 Sentry

| Field                         | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| **Service**                   | Error tracking, performance monitoring                             |
| **Data access level**         | L2 — pseudonymized error data (no PHI by default)                  |
| **BAA status**                | Required if error payloads contain PHI — conditional BAA available |
| **BAA executed**              | No — **follow-up VRA-4.14 (P1)**                                   |
| **SLA**                       | 99.9%                                                              |
| **Certifications**            | SOC2 Type II, ISO 27001                                            |
| **Data residency**            | US, EU                                                             |
| **Security incidents (12mo)** | None material                                                      |
| **PHI risk**                  | Medium — error stack traces may contain PHI if not scrubbed        |
| **Data scrubbing**            | Available (server-side scrubbing, before-send hooks)               |
| **Replacement vendor**        | Self-hosted GlitchTip                                              |
| **Exit plan**                 | Event archive export (JSON), organization deletion                 |
| **Initial review decision**   | **Watch** — PHI scrubbing not configured                           |

**Findings**:

- Sentry receives error data from @sentry/* SDKs. Stack traces and breadcrumbs
  may contain PHI (e.g., user IDs, session content).
- Server-side data scrubbing must be configured to strip PHI before storage.
- @sentry/toolbar (Spotlight) is dev-only and should be disabled in production.

**Action items**:

- VRA-4.14: Execute BAA with Sentry (conditional) (P1, Compliance, due 60 days)
- VRA-4.15: Configure Sentry server-side data scrubbing for PHI patterns (P1,
  Engineering, due 14 days)
- VRA-4.16: Audit Sentry breadcrumbs for PHI leakage (P1, Engineering, due 30
  days)

### 3.9 Vercel

| Field                         | Value                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Service**                   | Hosting (Astro SSR), Vercel Analytics, Speed Insights                           |
| **Data access level**         | L2 — pseudonymized analytics, request metadata                                  |
| **BAA status**                | Not required — no PHI access (Analytics is pseudonymized)                       |
| **BAA executed**              | N/A                                                                             |
| **SLA**                       | 99.9% (Pro), 99.99% (Enterprise)                                                |
| **Certifications**            | SOC2 Type II, ISO 27001                                                         |
| **Data residency**            | Global edge                                                                     |
| **Security incidents (12mo)** | None material                                                                   |
| **PHI risk**                  | Low — Analytics/Speed Insights collect pseudonymized metrics, no request bodies |
| **Replacement vendor**        | Self-hosted Docker, Hetzner, Cloudflare Pages                                   |
| **Exit plan**                 | Static build artifact export, project deletion                                  |
| **Initial review decision**   | **Pass**                                                                        |

**Findings**:

- Vercel Analytics and Speed Insights collect pseudonymized, aggregated metrics
  (page views, Core Web Vitals). No request bodies or user content.
- If SSR is deployed to Vercel, response data passes through Vercel's edge but
  is not persisted. Confirm deployment model.
- Currently, the primary deployment is via Docker/Hetzner; Vercel is used for
  Analytics/Speed Insights SDK only.

**Action items**:

- VRA-4.17: Confirm Vercel is not receiving PHI via SSR (P2, Engineering, due 60
  days)

### 3.10 Twilio

| Field                         | Value                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| **Service**                   | SMS, Voice, WhatsApp, Verify (2FA)                                  |
| **Data access level**         | L3 — phone numbers, message content (if SMS used for PHI)           |
| **BAA status**                | Required if SMS contains PHI — Twilio HIPAA-eligible tier available |
| **BAA executed**              | No — **follow-up VRA-4.18 (P1)**                                    |
| **SLA**                       | 99.95%                                                              |
| **Certifications**            | SOC2 Type II, ISO 27001, HIPAA-eligible (Twilio for Healthcare)     |
| **Data residency**            | US, EU, Australia                                                   |
| **Security incidents (12mo)** | None material                                                       |
| **PHI risk**                  | Medium — only if SMS messages contain PHI (clinical communications) |
| **HIPAA tier**                | Twilio for Healthcare (separate pricing, BAA included)              |
| **Replacement vendor**        | Self-hosted SIP, email-only (Resend)                                |
| **Exit plan**                 | Message log export, account closure                                 |
| **Initial review decision**   | **Watch** — BAA status depends on SMS content                       |

**Findings**:

- Twilio is HIPAA-eligible via "Twilio for Healthcare" tier which includes BAA.
- Current usage: Verify (2FA) and potentially SMS notifications.
- If SMS is used to send clinical information (appointment reminders, etc.), BAA
  is required.
- Verify (2FA) sends OTP codes — not PHI, but phone numbers are PII.

**Action items**:

- VRA-4.18: Determine if SMS messages contain PHI; if yes, execute BAA via
  Twilio for Healthcare (P1, Compliance, due 60 days)

### 3.11 Resend

| Field                         | Value                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| **Service**                   | Transactional email API                                      |
| **Data access level**         | L3 — email addresses, email content                          |
| **BAA status**                | Required if email contains PHI — Resend HIPAA tier available |
| **BAA executed**              | No — **follow-up VRA-4.19 (P1)**                             |
| **SLA**                       | 99.9%                                                        |
| **Certifications**            | SOC2 Type II (in progress as of 2026)                        |
| **Data residency**            | US                                                           |
| **Security incidents (12mo)** | None material                                                |
| **PHI risk**                  | Medium — if emails contain clinical information              |
| **HIPAA tier**                | Resend HIPAA tier available (requires Enterprise plan)       |
| **Replacement vendor**        | Self-hosted Postfix, AWS SES, Twilio SendGrid                |
| **Exit plan**                 | Email log export, account deletion                           |
| **Initial review decision**   | **Watch** — BAA status depends on email content              |

**Findings**:

- Resend is a newer email provider; SOC2 Type II was in progress.
- If transactional emails contain PHI (password reset with clinical context,
  appointment confirmations), BAA is required.
- Resend HIPAA tier requires Enterprise plan upgrade.

**Action items**:

- VRA-4.19: Determine if emails contain PHI; if yes, upgrade to Enterprise +
  execute BAA (P1, Compliance, due 60 days)

---

## 4. Summary Decision Matrix

| Vendor        | Risk     | BAA Required | BAA Executed | Decision           | Follow-ups           |
| ------------- | -------- | ------------ | ------------ | ------------------ | -------------------- |
| OpenAI        | Critical | Yes          | No           | Watch              | VRA-4.1, 4.2         |
| Anthropic     | Critical | Yes          | No           | Watch              | VRA-4.3              |
| Google Gemini | Critical | Yes          | No           | Watch              | VRA-4.4, 4.5         |
| Auth0         | Critical | Yes          | No           | Watch              | VRA-4.6, 4.7         |
| AWS           | Critical | Yes          | No           | Watch              | VRA-4.8, 4.9         |
| Cloudflare    | High     | Conditional  | N/A          | Pass (conditional) | VRA-4.10, 4.11       |
| MongoDB Atlas | Critical | Yes          | No           | Watch              | VRA-4.12, 4.13       |
| Sentry        | High     | Conditional  | No           | Watch              | VRA-4.14, 4.15, 4.16 |
| Vercel        | High     | No           | N/A          | Pass               | VRA-4.17             |
| Twilio        | High     | Conditional  | No           | Watch              | VRA-4.18             |
| Resend        | High     | Conditional  | No           | Watch              | VRA-4.19             |

**Summary**: 8 vendors require BAA execution (P0/P1), 2 are conditional (need
PHI content determination), 1 passed unconditionally (Vercel).

---

## 5. Consolidated Action Items

| ID       | Action                                                      | Priority | Owner       | Due     |
| -------- | ----------------------------------------------------------- | -------- | ----------- | ------- |
| VRA-4.1  | Execute BAA with OpenAI                                     | P0       | Compliance  | 30 days |
| VRA-4.2  | Verify OpenAI zero-retention mode enabled org-wide          | P0       | Engineering | 14 days |
| VRA-4.3  | Execute BAA with Anthropic                                  | P0       | Compliance  | 30 days |
| VRA-4.4  | Execute BAA with Google Cloud                               | P0       | Compliance  | 30 days |
| VRA-4.5  | Configure CMEK for Vertex AI resources                      | P1       | Engineering | 60 days |
| VRA-4.6  | Upgrade Auth0 to Enterprise tier + execute BAA              | P0       | Compliance  | 30 days |
| VRA-4.7  | Enforce MFA for all Auth0 admin accounts                    | P1       | Engineering | 14 days |
| VRA-4.8  | Execute BAA with AWS                                        | P0       | Compliance  | 30 days |
| VRA-4.9  | Verify S3 bucket policies + KMS key rotation                | P1       | Engineering | 30 days |
| VRA-4.10 | Legal opinion on Cloudflare edge-only PHI + BAA             | P1       | Compliance  | 60 days |
| VRA-4.11 | Ensure R2 buckets w/ PHI use customer-managed keys          | P2       | Engineering | 90 days |
| VRA-4.12 | Execute BAA with MongoDB Atlas                              | P0       | Compliance  | 30 days |
| VRA-4.13 | Verify MongoDB Atlas cluster tier M30+ for HIPAA            | P1       | Engineering | 14 days |
| VRA-4.14 | Execute conditional BAA with Sentry                         | P1       | Compliance  | 60 days |
| VRA-4.15 | Configure Sentry server-side data scrubbing for PHI         | P1       | Engineering | 14 days |
| VRA-4.16 | Audit Sentry breadcrumbs for PHI leakage                    | P1       | Engineering | 30 days |
| VRA-4.17 | Confirm Vercel is not receiving PHI via SSR                 | P2       | Engineering | 60 days |
| VRA-4.18 | Determine SMS PHI content; execute BAA if needed (Twilio)   | P1       | Compliance  | 60 days |
| VRA-4.19 | Determine email PHI content; execute BAA if needed (Resend) | P1       | Compliance  | 60 days |

---

## 6. Quarterly Review Schedule

| Quarter | Vendors Reviewed                 | Focus                                |
| ------- | -------------------------------- | ------------------------------------ |
| Q1      | OpenAI, Anthropic, Google Gemini | AI vendor BAA status, zero-retention |
| Q2      | Auth0, AWS, Cloudflare           | Identity + cloud infra               |
| Q3      | MongoDB Atlas, Sentry            | Data storage + observability         |
| Q4      | Vercel, Twilio, Resend           | Hosting + communications             |

**Next review**: Q1 2027 — OpenAI, Anthropic, Google Gemini

---

## 7. Glossary

| Term                  | Definition                                                      |
| --------------------- | --------------------------------------------------------------- |
| **BAA**               | Business Associate Agreement — HIPAA-required contract          |
| **CMEK**              | Customer-Managed Encryption Keys                                |
| **Data access level** | Classification 0-5 of vendor data access (see vendor-inventory) |
| **FedRAMP**           | Federal Risk and Authorization Management Program               |
| **HIPAA-eligible**    | Vendor service covered under HIPAA with BAA executed            |
| **ISO 27001**         | Information security management system standard                 |
| **ISO 27018**         | Cloud privacy protection standard                               |
| **L4**                | Data access level 4 — sensitive data including PHI              |
| **P0**                | Priority 0 — must be done before go-live                        |
| **SOC2 Type II**      | Service Organization Control 2 — Type II audit report           |
| **Zero-retention**    | AI vendor API mode where prompts are not stored after inference |

---

## 8. References

- **Linear**: [PIX-4129](https://linear.app/pixelated/issue/PIX-4129) — Vendor
  Risk Assessment
- **Related ticket**: [PIX-4151](https://linear.app/pixelated/issue/PIX-4151) —
  VRA-1: Inventory All Third-Party Dependencies
- **Related docs**:
  - [Third-Party Vendor & Dependency Inventory](./vendor-inventory.md) — full
    vendor list, data access levels, risk framework
  - [SLO Definitions Runbook](./runbooks/slo-definitions.md)
  - [DR RTO/RPO Targets Runbook](./runbooks/dr-rto-rpo-targets.md)
  - [HIPAA Compliance](../compliance/hipaa.mdx)
  - [Security](../compliance/security.mdx)
- **External standards**:
  - HIPAA Security Rule (45 CFR 164.308-318)
  - NIST SP 800-161 (Supply Chain Risk Management)
  - SOC2 Trust Services Criteria (AICPA)
  - ISO 27001/27017/27018 (Information Security / Cloud Security)

---

_Document maintained by: Security + Compliance_ _Last updated: 2026-07-30_
