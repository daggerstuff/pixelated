# Vendor Risk Register — Tier 1 Scored Assessments

> **Linear:** [PIX-4153](https://linear.app/pixelated/issue/PIX-4153/) — VRA-3:
> Conduct Tier 1 Vendor Security Reviews **Parent:**
> [PIX-4129](https://linear.app/pixelated/issue/PIX-4129/) — Enterprise Gap:
> Vendor Risk Assessment & Third-Party Audit **Owner:** Chad **Assessment
> date:** 2026-08-01 **Scoring framework:**
> [Vendor Risk Assessment Framework](./vendor-risk-assessment-framework.md)
> (VRA-2 / PIX-4152) **Qualitative reviews:**
> [Vendor Security Reviews](../enterprise/vendor-security-reviews.md) (VRA-4)
> **Inventory:**
> [Third-Party Vendor & Dependency Inventory](../enterprise/vendor-inventory.md)
> (VRA-1)

---

## 1. Purpose

This register applies the VRA-2 scoring framework to all 11 Tier 1 vendors
identified in the vendor inventory (VRA-1) and reviewed qualitatively in VRA-4.
Each vendor receives a numeric composite score (0–100) across four weighted
criteria, producing an Approved / Conditional / Rejected tier decision.

This document is the authoritative scored record referenced by the risk register
(`risk-register.md`) and the SOC2/HIPAA gap assessments.

---

## 2. Scoring Summary

| #   | Vendor        | Certs | Data | Breach | Financial | Composite | Tier        |
| --- | ------------- | ----- | ---- | ------ | --------- | --------- | ----------- |
| 1   | Google Gemini | 5     | 5    | 5      | 5         | **100.0** | Approved    |
| 2   | AWS           | 5     | 5    | 5      | 5         | **100.0** | Approved    |
| 3   | Cloudflare    | 5     | 4    | 4      | 5         | **89.0**  | Approved    |
| 4   | MongoDB Atlas | 5     | 4    | 4      | 5         | **89.0**  | Approved    |
| 5   | OpenAI        | 5     | 4    | 4      | 4         | **86.0**  | Approved    |
| 6   | Vercel        | 5     | 4    | 4      | 4         | **86.0**  | Approved    |
| 7   | Auth0         | 5     | 4    | 3      | 5         | **84.0**  | Approved    |
| 8   | Twilio        | 5     | 4    | 3      | 5         | **84.0**  | Approved    |
| 9   | Anthropic     | 5     | 4    | 4      | 3         | **83.0**  | Approved    |
| 10  | Sentry        | 5     | 3    | 4      | 3         | **77.0**  | Conditional |
| 11  | Resend        | 2     | 3    | 4      | 2         | **56.0**  | Conditional |

**Formula:**
`composite = 100 × (0.30×certs/5 + 0.30×data/5 + 0.25×breach/5 + 0.15×financial/5)`

**Result:** 9 Approved, 2 Conditional, 0 Rejected.

---

## 3. Individual Vendor Assessments

### 3.1 OpenAI

| Criterion               | Score | Evidence                                                                                                                                                                                                                                    |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. HIPAA-eligible tier. Published security.txt and vulnerability disclosure program.                                                                                                                   |
| Data Handling           | **4** | Zero-retention API mode available (must be explicitly enabled). DPA available. AES-256 at rest, TLS 1.2+ in transit. Data residency US/EU. Customer-managed keys not available for inference API. Retention configurable (0-day or 30-day). |
| Breach History          | **4** | No material breaches in 36 months. Documented IR process. 72-hour notification commitment in Enterprise terms. No public tabletop exercise evidence.                                                                                        |
| Financial Stability     | **4** | ~$300B valuation (2025). Microsoft significant investment. Founded 2015 (~11 years). Not public, no audited financials, but strong investor backing and revenue growth.                                                                     |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.8 + 0.15×0.8) = 86.0`
**Tier:** Approved **Conditions:** BAA must be executed before any PHI
processing. Zero-retention mode must be verified enabled org-wide (VRA-4.2).

---

### 3.2 Anthropic

| Criterion               | Score | Evidence                                                                                                                                                                                                              |
| ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. HIPAA-eligible tier. Published security page with vulnerability reporting.                                                                                                    |
| Data Handling           | **4** | Customer data not used for training by default (API usage policy). DPA available. Encryption at rest + in transit. Zero-retention is default behavior, not a toggle. US data residency only.                          |
| Breach History          | **4** | No material breaches in 36 months. Founded 2021 — shorter operating history but clean record. 72-hour notification committed in Enterprise terms.                                                                     |
| Financial Stability     | **3** | ~$61B valuation (2025). Google + Amazon significant investments. Founded 2021 (~5 years). Not public, no audited financials. Strong investor backing but shorter operating history than 5-year threshold for score 4. |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.8 + 0.15×0.6) = 83.0`
**Tier:** Approved **Conditions:** BAA must be executed before any PHI
processing.

---

### 3.3 Google Gemini (Vertex AI / GenAI)

| Criterion               | Score | Evidence                                                                                                                                                                                                                                                                     |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 + ISO 27001 + ISO 27017 + ISO 27018 + HIPAA + FedRAMP High. Broadest certification portfolio of any vendor.                                                                                                                                                             |
| Data Handling           | **5** | Customer-managed encryption keys (CMEK) available. GCP DPA standard. AES-256 at rest, TLS 1.2+ in transit. Data residency configurable (US/EU regions). Retention configurable. Data not used for training by default. Deletion via project deletion + CMEK key destruction. |
| Breach History          | **5** | No material breaches in 36 months. Google's IR capability is industry-leading. 72-hour notification in GCP terms. Verified tabletop exercises (Google conducts regular IR drills).                                                                                           |
| Financial Stability     | **5** | Alphabet Inc. (GOOG) — public company, audited financials covering 3+ years. No single customer concentration risk.                                                                                                                                                          |

**Composite:** `100 × (0.30×1.0 + 0.30×1.0 + 0.25×1.0 + 0.15×1.0) = 100.0`
**Tier:** Approved **Conditions:** BAA must be executed for PHI workloads. CMEK
should be configured for Vertex AI resources (VRA-4.5).

---

### 3.4 Auth0 (Okta)

| Criterion               | Score | Evidence                                                                                                                                                                                                                                                                              |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. HIPAA-eligible at Enterprise tier. Published security page.                                                                                                                                                                                   |
| Data Handling           | **4** | DPA available. AES-256 at rest, TLS 1.2+ in transit. US data residency (current tenant). MFA available (TOTP, SMS, push) but not enforced by default. User directory export available (CSV/LDIF).                                                                                     |
| Breach History          | **3** | Sept 2023: Okta support case breach (attackers accessed Okta's support case management system, gaining access to some customer files). Resolved with root-cause published. Within 36-month window. Auth0 itself was not directly breached, but parent company incident affects score. |
| Financial Stability     | **5** | Okta Inc. (OKTA) — public company, audited financials.                                                                                                                                                                                                                                |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.6 + 0.15×1.0) = 84.0`
**Tier:** Approved **Conditions:** Enterprise tier upgrade required for HIPAA
BAA (VRA-4.6). MFA must be enforced for all admin accounts (VRA-4.7). Monitor
Okta security disclosures quarterly.

---

### 3.5 AWS (S3 / KMS / EKS / RDS)

| Criterion               | Score | Evidence                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC 1/2/3 + ISO 27001/27017/27018 + HIPAA + FedRAMP + PCI DSS + IRAP. Most comprehensive certification portfolio.                                                                                                                                                                                        |
| Data Handling           | **5** | KMS-managed keys with annual rotation. AWS DPA standard. AES-256 at rest (S3), TLS 1.2+ in transit. Region-configurable data residency. S3 Object Ownership, public access blocks, bucket policies. Data lifecycle management (expiration, glacier). Deletion via bucket deletion + KMS key destruction. |
| Breach History          | **5** | No material breaches in 36 months. AWS Security bulletins published regularly. 72-hour notification in Business Associate Addendum.                                                                                                                                                                      |
| Financial Stability     | **5** | Amazon.com Inc. (AMZN) — public company, audited financials. AWS is $100B+ revenue business.                                                                                                                                                                                                             |

**Composite:** `100 × (0.30×1.0 + 0.30×1.0 + 0.25×1.0 + 0.15×1.0) = 100.0`
**Tier:** Approved **Conditions:** BAA must be executed for PHI buckets
(VRA-4.8). S3 bucket policies + KMS key rotation must be verified (VRA-4.9).

---

### 3.6 Cloudflare

| Criterion               | Score | Evidence                                                                                                                                                                                                                                                   |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001 + ISO 27018 + FedRAMP Moderate. Published security page and bug bounty.                                                                                                                                                           |
| Data Handling           | **4** | DPA available. Edge-only processing for Workers (no persistence by default). R2 encryption at rest (AES-128 default, not AES-256). TLS 1.2+ in transit. Data residency: edge (global), R2 region-configurable. Customer-managed keys not available for R2. |
| Breach History          | **4** | Nov 2023: Cloudflare R2 outage (availability incident, not security breach). No security breaches in 36 months. 72-hour notification in Enterprise terms.                                                                                                  |
| Financial Stability     | **5** | Cloudflare Inc. (NET) — public company, audited financials.                                                                                                                                                                                                |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.8 + 0.15×1.0) = 89.0`
**Tier:** Approved **Conditions:** Legal counsel opinion needed on edge-only
PHI + BAA necessity (VRA-4.10). R2 buckets with PHI should use strongest
available encryption (VRA-4.11).

---

### 3.7 MongoDB Atlas

| Criterion               | Score | Evidence                                                                                                                                                                                                                     |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. HIPAA-eligible at M10+ tier. Published security page.                                                                                                                                |
| Data Handling           | **4** | DPA available. AES-256 at rest, TLS 1.2+ in transit. Region-configurable data residency. Continuous backups + point-in-time recovery. Customer-managed encryption keys available at higher tiers. Data export via mongodump. |
| Breach History          | **4** | No material breaches in 36 months. Documented IR process. 72-hour notification in Enterprise terms.                                                                                                                          |
| Financial Stability     | **5** | MongoDB Inc. (MDB) — public company, audited financials.                                                                                                                                                                     |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.8 + 0.15×1.0) = 89.0`
**Tier:** Approved **Conditions:** BAA must be executed (VRA-4.12). Cluster tier
must be verified M30+ for HIPAA (VRA-4.13).

---

### 3.8 Sentry

| Criterion               | Score | Evidence                                                                                                                                                                                                                                                                          |
| ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. Published security page and bug bounty.                                                                                                                                                                                                   |
| Data Handling           | **3** | DPA available. Encryption at rest + in transit. Server-side data scrubbing available but **not configured** for PHI patterns. Breadcrumbs may leak PHI. No customer-managed keys. US/EU data residency. Data scrubbing is a compensating control but must be actively configured. |
| Breach History          | **4** | No material breaches in 36 months. Documented IR process. 72-hour notification in Business terms.                                                                                                                                                                                 |
| Financial Stability     | **3** | Private company. ~$1.5B valuation (Series C, 2022). Founded 2019 (~7 years). Revenue-growing but no audited financials. Runway estimated >18 months based on Series C size.                                                                                                       |

**Composite:** `100 × (0.30×1.0 + 0.30×0.6 + 0.25×0.8 + 0.15×0.6) = 77.0`
**Tier:** Conditional **Compensating controls required:**

- Configure Sentry server-side data scrubbing for PHI patterns (VRA-4.15) —
  **must be done before PHI-adjacent error data reaches Sentry**
- Audit Sentry breadcrumbs for PHI leakage (VRA-4.16)
- Enhanced monitoring: quarterly review of Sentry data handling
- Shorter contract term: 6-month reassessment
- Consider self-hosted GlitchTip as replacement if PHI scrubbing cannot be
  verified

**Reassessment:** 6 months (2027-Q1)

---

### 3.9 Vercel

| Criterion               | Score | Evidence                                                                                                                                                                               |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. Published security page.                                                                                                                       |
| Data Handling           | **4** | DPA available. Edge-only processing (no PHI persistence). Analytics/Speed Insights collect pseudonymized metrics only. TLS 1.2+ in transit. No request body storage.                   |
| Breach History          | **4** | No material breaches in 36 months. Documented IR process. 72-hour notification in Pro/Enterprise terms.                                                                                |
| Financial Stability     | **4** | Private company. ~$2.5B valuation (Series D, 2024). Founded 2015 (~11 years). Strong revenue growth. No audited financials but credible investor syndicate and long operating history. |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.8 + 0.15×0.8) = 86.0`
**Tier:** Approved **Conditions:** Confirm Vercel is not receiving PHI via SSR
if SSR is ever deployed (VRA-4.17). Currently used for Analytics/Speed Insights
SDK only (no PHI).

---

### 3.10 Twilio

| Criterion               | Score | Evidence                                                                                                                                                                                                                               |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **5** | SOC2 Type II + ISO 27001, both current. HIPAA-eligible via "Twilio for Healthcare" tier. Published security page.                                                                                                                      |
| Data Handling           | **4** | DPA available. Encryption at rest + in transit. HIPAA tier available (separate pricing, BAA included). US/EU/Australia data residency. Message log export available.                                                                   |
| Breach History          | **3** | 2024: Authy app vulnerability (SIM-swap attack vector). While Authy is a separate product, it's under the Twilio umbrella. Resolved with patches. Core Twilio service not breached but parent company incident within 36-month window. |
| Financial Stability     | **5** | Twilio Inc. (TWLO) — public company, audited financials.                                                                                                                                                                               |

**Composite:** `100 × (0.30×1.0 + 0.30×0.8 + 0.25×0.6 + 0.15×1.0) = 84.0`
**Tier:** Approved **Conditions:** Determine if SMS messages contain PHI; if
yes, execute BAA via Twilio for Healthcare (VRA-4.18). Monitor Authy/Twilio
security disclosures.

---

### 3.11 Resend

| Criterion               | Score | Evidence                                                                                                                                                                                           |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Certifications | **2** | SOC2 Type II was in progress as of 2026 — **not yet obtained**. No ISO 27001. Published privacy policy covers basics. Industry self-attestation only (CSA STAR or equivalent not confirmed).       |
| Data Handling           | **3** | DPA available. Encryption in transit. At-rest encryption relies on vendor-managed keys. US data residency. Retention documented but not self-service. HIPAA tier requires Enterprise plan upgrade. |
| Breach History          | **4** | No breaches (founded 2022, ~4 years operating). Short but clean record. 72-hour notification committed in terms.                                                                                   |
| Financial Stability     | **2** | Private company. Early stage. Founded 2022 (~4 years). Funding amount undisclosed. Runway not verifiable. No audited financials.                                                                   |

**Composite:** `100 × (0.30×0.4 + 0.30×0.6 + 0.25×0.8 + 0.15×0.4) = 56.0`
**Tier:** Conditional **Compensating controls required:**

- Do not send PHI via Resend until SOC2 Type II obtained
- Upgrade to Enterprise plan + execute BAA before any PHI email (VRA-4.19)
- Enhanced monitoring: quarterly review of Resend security posture
- Shorter contract term: 6-month reassessment
- Document replacement path: AWS SES or Twilio SendGrid as fallback
- Reassess once SOC2 Type II is obtained (expected to move to Approved)

**Reassessment:** 6 months (2027-Q1) or upon SOC2 Type II attainment, whichever
is first.

---

## 4. Tier Decision Matrix

| Tier            | Count | Vendors                                                                                 | Action                                                                                       |
| --------------- | ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Approved**    | 9     | Google Gemini, AWS, Cloudflare, MongoDB Atlas, OpenAI, Vercel, Auth0, Twilio, Anthropic | Standard onboarding. Annual reassessment. Execute BAAs where required before PHI processing. |
| **Conditional** | 2     | Sentry, Resend                                                                          | Compensating controls required. 6-month reassessment. Enhanced monitoring.                   |
| **Rejected**    | 0     | —                                                                                       | —                                                                                            |

---

## 5. Hard Gate Assessment

Per VRA-2 §3.4, the following hard gates were evaluated:

| Hard Gate                                     | Applicable Vendors                                                   | Result                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Refuses 72-hour breach notification           | All 11                                                               | **None refuse** — all commit to 72-hour notification in terms                                                               |
| PHI processing without BAA                    | OpenAI, Anthropic, Google, Auth0, AWS, MongoDB Atlas, Twilio, Resend | **Not a gate** — all offer BAA; none have executed yet, but all are willing. BAA execution is a condition, not a rejection. |
| Cardholder data without PCI-DSS               | None                                                                 | **N/A** — no vendor processes cardholder data for Pixelated                                                                 |
| Undisclosed material breach (prior 12 months) | All 11                                                               | **None found** — no vendor has an undisclosed material breach in prior 12 months                                            |

**Result:** No hard gate rejections.

---

## 6. BAA Execution Status

| Vendor        | BAA Required     | BAA Offered      | BAA Executed | Blocking Issue                         | Action             |
| ------------- | ---------------- | ---------------- | ------------ | -------------------------------------- | ------------------ |
| OpenAI        | Yes              | Yes              | No           | Must execute before PHI                | VRA-4.1 (30 days)  |
| Anthropic     | Yes              | Yes              | No           | Must execute before PHI                | VRA-4.3 (30 days)  |
| Google Gemini | Yes              | Yes              | No           | Must execute before PHI                | VRA-4.4 (30 days)  |
| Auth0         | Yes (Enterprise) | Yes              | No           | Enterprise tier upgrade required       | VRA-4.6 (30 days)  |
| AWS           | Yes              | Yes              | No           | Must execute for PHI buckets           | VRA-4.8 (30 days)  |
| MongoDB Atlas | Yes              | Yes              | No           | Must execute before PHI                | VRA-4.12 (30 days) |
| Cloudflare    | Conditional      | Conditional      | N/A          | Legal opinion needed on edge-only PHI  | VRA-4.10 (60 days) |
| Sentry        | Conditional      | Yes              | No           | PHI scrubbing must be configured first | VRA-4.14 (60 days) |
| Vercel        | No               | N/A              | N/A          | No PHI access                          | —                  |
| Twilio        | Conditional      | Yes              | No           | Depends on SMS content                 | VRA-4.18 (60 days) |
| Resend        | Conditional      | Yes (Enterprise) | No           | Enterprise upgrade + SOC2 needed       | VRA-4.19 (60 days) |

**Summary:** 6 vendors require P0 BAA execution (30-day deadline). 3 vendors
require conditional BAA (60-day deadline). 2 vendors do not require BAA.

---

## 7. Risk Register Cross-Reference

This register feeds the following risk register entries:

| Risk Register ID | Vendor     | Risk                                     | Mitigation                                               |
| ---------------- | ---------- | ---------------------------------------- | -------------------------------------------------------- |
| R-TM-S1          | Auth0      | JWT forgery via compromised signing keys | Auth0 managed; SOC2 Type II + ISO 27001 (score: 84.0)    |
| R-TM-S3          | Cloudflare | Service-token spoof                      | Cloudflare edge; SOC2 Type II (score: 89.0)              |
| R-TM-I3          | Sentry     | PII in error logs / Sentry telemetry     | Sentry PHI scrubbing required (score: 77.0, Conditional) |
| R-TM-I6          | Cloudflare | Token leak in deploy logs                | Cloudflare edge; access controls (score: 89.0)           |
| R-TM-D3          | Cloudflare | Origin DDoS                              | Cloudflare DDoS protection (score: 89.0)                 |

---

## 8. Reassessment Schedule

| Quarter           | Vendors                          | Focus                                             |
| ----------------- | -------------------------------- | ------------------------------------------------- |
| 2026-Q4 (initial) | Sentry, Resend                   | 6-month Conditional reassessment                  |
| 2027-Q1           | OpenAI, Anthropic, Google Gemini | AI vendor BAA status, zero-retention verification |
| 2027-Q2           | Auth0, AWS, Cloudflare           | Identity + cloud infra, Okta breach monitoring    |
| 2027-Q3           | MongoDB Atlas, Sentry            | Data storage + observability                      |
| 2027-Q4           | Vercel, Twilio, Resend           | Hosting + communications                          |

---

## 9. Open Items

- [ ] Vendor Intake Linear template not yet created (deferred from VRA-2 §7)
- [ ] Compensation-control catalogue for Conditional vendors needs concrete SOC2
      CC mapping
- [ ] Automated cross-link from Trivy scan results to vendor record (for
      dependency-level risk)
- [ ] Resend SOC2 Type II attainment tracking — reassess upon notification
- [ ] Sentry PHI scrubbing verification — must be confirmed before next
      Conditional reassessment

---

## 10. Change Log

| Date       | Author   | Change                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------ |
| 2026-08-01 | Sisyphus | Initial Tier 1 scored assessments for all 11 vendors per VRA-2 framework |
