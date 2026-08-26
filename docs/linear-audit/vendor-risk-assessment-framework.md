# Vendor Risk Assessment Framework

> **Linear:** [PIX-4152](https://linear.app/pixelated/issue/PIX-4152/) — VRA-2:
> Create Vendor Risk Assessment Framework **Parent:**
> [PIX-4129](https://linear.app/pixelated/issue/PIX-4129/) — Enterprise Gap:
> Vendor Risk Assessment & Third-Party Audit **Owner:** Chad **Last reviewed:**
> 2026-07-30

---

## 1. Purpose

This framework defines the criteria, scoring system, and lifecycle that
Pixelated uses to assess third-party vendors before onboarding and to
re-evaluate them on a recurring cadence. It is the single source of truth for
vendor risk decisions and is referenced by the broader Vendor Risk & Third-Party
Audit program (PIX-4129) and the Enterprise Readiness Program.

The framework exists to:

- Make vendor approvals reproducible and auditable rather than ad-hoc.
- Catch supply-chain, data-handling, and continuity risks before a vendor
  touches Pixelated data.
- Produce a numeric score that feeds the risk register
  (`docs/linear-audit/risk-register.md`) and downstream compliance artifacts
  (SOC 2 Trust Criteria, HIPAA BAA coverage, etc.).

Scope: any external entity that stores, processes, or transmits Pixelated or
customer data, or that is wired into a runtime path that can reach such data.
This includes cloud providers, SaaS apps, model-inference vendors, observability
vendors, and managed-database vendors. It does NOT include pure OSS dependencies
licensed for self-hosting (those are covered by the S3 dependency-vulnerability
process in `s3-scan-results.md`).

---

## 2. Assessment Criteria

Every vendor is evaluated against four criteria, each scored 0–5 (see §3).
Evidence must be attached or linked from the vendor record; self-attestation
alone is capped at _Conditional_ (see §4).

### 2.1 Security Certifications

The vendor must hold a recognised independent attestation that covers the
controls relevant to the service it will provide to Pixelated. Acceptable
certifications:

| Certification                       | Covers                                  | Acceptable scope                           |
| ----------------------------------- | --------------------------------------- | ------------------------------------------ |
| SOC 2 Type II                       | Security, availability, confidentiality | Annual report, <15 months old              |
| ISO/IEC 27001                       | ISMS                                    | Valid certificate, not expired             |
| HIPAA (HITRUST or BAA-backed audit) | PHI handling                            | Required if vendor touches PHI             |
| PCI-DSS                             | Cardholder data                         | Required if vendor touches cardholder data |
| FedRAMP (Moderate or above)         | US gov cloud                            | Required for US public-sector workloads    |

Scoring:

- **5** — Holds SOC 2 Type II + ISO 27001, both current, scope unambiguous.
- **4** — Holds SOC 2 Type II, current, scope unambiguous.
- **3** — Holds ISO 27001 only, or SOC 2 Type II with a scope carve-out that
  materially affects the service Pixelated intends to use.
- **2** — Holds an industry self-attestation (e.g. CSA STAR Level 1) or a lapsed
  SOC 2 report (<24 months old).
- **1** — Has documented controls but no independent attestation.
- **0** — No attestation, no documented controls.

Vendor must also maintain a vulnerability disclosure policy (security.txt or
equivalent) and a published point of contact for security incidents. Missing
both caps this criterion at 2.

### 2.2 Data Handling

Covers how the vendor treats Pixelated and customer data once it crosses the
trust boundary.

Required evidence:

- A signed Data Processing Agreement (DPA) or equivalent contractual terms
  covering:
  - Purpose limitation.
  - Sub-processor disclosure (Pixelated must approve material new
    sub-processors).
  - Data return / deletion on termination, with documented SLA and certificate.
- Encryption at rest (AES-256 or stronger) and in transit (TLS 1.2+ with modern
  ciphers). HSM-backed key management counts positively.
- Data residency: documented regions where Pixelated/customer data may be stored
  and processed, with an affirmative commitment to honour a region restriction
  when Pixelated requests it.
- Retention: documented retention periods and a deletion procedure that can be
  triggered from Pixelated's side (API call or written notice).

Scoring:

- **5** — DPA signed, end-to-end encryption w/ customer-managed keys, residency
  honourable on request, retention configurable, deletion certificate issued on
  termination.
- **4** — DPA signed, encryption at rest + in transit, residency documented but
  not configurable per-tenant, retention documented.
- **3** — DPA signed, encryption in transit; at-rest encryption relies on
  vendor-managed keys only; retention documented but not self-service.
- **2** — DPA signed, encryption in transit only; residency unspecified;
  retention unspecified.
- **1** — DPA not signed but vendor has a published privacy/processing policy
  that covers the essentials.
- **0** — No DPA, no documented processing policy, or vendor refuses to sign
  Pixelated's DPA.

### 2.3 Breach History

A vendor that has never had a breach is not necessarily safe; one that has had a
breach and handled it well may be safer than one that has not been tested. The
assessment rewards transparency and incident-response quality.

Evidence:

- Public record of any material breaches in the prior 36 months, including
  root-cause write-up and customer-notice timeline.
- Documented incident-response runbook with a committed notification SLA to
  Pixelated.
- A signed breach-notification addendum committing to notify Pixelated within
  **72 hours** of confirmed compromise (aligns with HIPAA Breach Notification
  Rule and SOC 2 CC7.4).

Scoring:

- **5** — Zero breaches in 36 months; IR runbook published; 72-hour notification
  addendum signed; verified tabletop exercise results from the prior 12 months.
- **4** — Zero breaches in 36 months; IR runbook documented; 72-hour
  notification committed in the MSA.
- **3** — One minor breach in 36 months that was disclosed within 72 hours,
  root-caused, and remediated to a third-party auditor's satisfaction.
- **2** — One minor breach in 36 months with late notification (>72 hours) OR no
  published IR runbook but a 72-hour commitment exists in the MSA.
- **1** — Multiple breaches or one major breach in 36 months with slow/unclear
  notification; vendor cannot evidence a closed-loop post-mortem.
- **0** — Material breach in the prior 12 months with no disclosure, or a
  documented pattern of concealment.

A vendor that refuses to sign a 72-hour notification commitment is automatically
capped at 2 on this criterion regardless of history.

### 2.4 Financial Stability

A vendor that disappears mid-contract can be as damaging as one that is
compromised. Financial stability is scored on a blend of operating history,
capitalisation, and audit posture.

Evidence:

- Years of operating history under the same legal entity.
- Audited financial statements (or, for private pre-profit vendors, a runway
  attestation from a named investor or the most recent board-reported cash
  position).
- Public market disclosures or, for private vendors, a redacted cap table shared
  under NDA.
- Material customer concentration (single customer >40 percent of revenue is
  flagged).

Scoring:

- **5** — Public company or >10 years operating history with audited financials
  covering the prior 3 years; no single customer >40 percent of revenue.
- **4** — 5–10 years operating history with audited financials for the prior 2
  years; runway ≥18 months at current burn.
- **3** — 3–5 years operating history with reviewed (not audited) financials;
  runway ≥12 months.
- **2** — <3 years operating history, runway ≥12 months, no audited financials,
  but credible investor syndicate.
- **1** — <3 years operating history, runway 6–12 months, financials not
  independently verified.
- **0** — Runway <6 months, financials unavailable, or vendor cannot evidence
  capital to service the proposed contract term.

---

## 3. Scoring System

Each criterion is scored 0–5 (see §2). The composite score is a weighted sum of
the four criterion scores, normalised to 0–100.

### 3.1 Weights

| Criterion               | Weight | Rationale                                                                      |
| ----------------------- | ------ | ------------------------------------------------------------------------------ |
| Security Certifications | 0.30   | Independent attestation is the cheapest, highest-signal control we have.       |
| Data Handling           | 0.30   | Data once handed over is the asset; mishandling is the most expensive failure. |
| Breach History          | 0.25   | Reflects both the vendor's track record and our ability to react.              |
| Financial Stability     | 0.15   | Predictive but noisy; treated as a gating signal, not the main lever.          |

Weights sum to 1.00.

### 3.2 Composite Score

```
composite = 100 * (
    0.30 * cert_score      / 5
  + 0.30 * data_score      / 5
  + 0.25 * breach_score    / 5
  + 0.15 * financial_score / 5
)
```

The composite is rounded to one decimal place and stored with the vendor record.

### 3.3 Tier thresholds

| Tier            | Composite | Meaning                                                                                                                                                   |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Approved**    | ≥ 80      | Approved for onboarding. Standard contract. Re-assessed every 12 months.                                                                                  |
| **Conditional** | 50–79     | Approved with compensating controls: enhanced monitoring, data minimisation, shorter contract term, or executive sign-off. Re-assessed every 6 months.    |
| **Rejected**    | < 50      | Do not onboard. A vendor cannot move from Rejected to Conditional without a full re-assessment that materially changes at least one criterion's evidence. |

### 3.4 Hard gates

A vendor is auto-categorised as **Rejected** regardless of the composite score
if ANY of the following hold:

- Refuses to sign a 72-hour breach-notification commitment (caps breach
  criterion at 2 and forces Rejected).
- Intends to process PHI but will not sign a HIPAA BAA.
- Intends to touch cardholder data but is not PCI-DSS compliant for the relevant
  services.
- Has had an undisclosed material breach in the prior 12 months that Pixelated
  independently discovers during diligence.

### 3.5 Worked example

A hypothetical vendor scores as follows:

| Criterion               | Raw | Normalised | Weighted contribution |
| ----------------------- | --- | ---------- | --------------------- |
| Security Certifications | 4   | 0.80       | 0.30 × 0.80 = 0.240   |
| Data Handling           | 4   | 0.80       | 0.30 × 0.80 = 0.240   |
| Breach History          | 3   | 0.60       | 0.25 × 0.60 = 0.150   |
| Financial Stability     | 5   | 1.00       | 0.15 × 1.00 = 0.150   |

Composite = 100 × (0.240 + 0.240 + 0.150 + 0.150) = **78.0** → _Conditional_.
Approved with compensating controls, re-assessed in 6 months.

---

## 4. Assessment Lifecycle

### 4.1 Onboarding assessment

1. **Intake.** The sponsoring Pixelated team files a Vendor Intake request
   (Linear template) naming the vendor, the proposed use, data categories
   Pixelated will share, and the contract term.
2. **Evidence collection.** The security owner (Chad, until dedicated TPM is
   hired) requests the vendor's SOC 2 Type II, ISO 27001 certificate, DPA
   template, breach-notification addendum, and most recent audited financials.
   Vendor has 10 business days to produce evidence, else the request is closed
   as "Did Not Respond".
3. **Scoring.** Each criterion is scored per §3 and recorded in the vendor
   register (`docs/linear-audit/vendor-register.md`, to be created under
   PIX-4153 follow-on).
4. **Decision.** Composite + tier per §3.3. _Rejected_ decisions may be appealed
   once with new evidence; the appeal re-runs the full assessment.
5. **Record.** The completed assessment (scores + evidence links + decision
   rationale) is committed to the vendor register and cross-referenced from
   `risk-register.md` §6.

### 4.2 Re-assessment cadence

- **Approved** vendors: annual re-assessment. Triggers also include vendor
  ownership change, a material sub-processor addition, or a publicly disclosed
  breach involving the vendor.
- **Conditional** vendors: 6-month re-assessment, with a quarterly light-touch
  review of the compensating controls.
- **Rejected** vendors: no re-assessment within 12 months except by appeal with
  new evidence.

### 4.3 Termination

A vendor that breaches the DPA, suffers an unmanaged incident, or falls below
_Conditional_ on re-assessment is put on a 30-day remediation plan. If
remediation fails, the vendor is terminated and the data-return/deletion
procedure in the DPA is invoked. A deletion certificate is filed in the vendor
register before the vendor record is closed.

---

## 5. Compliance Mapping

This framework is the operational backbone for the following compliance
controls. Each row links back to the criterion that produces the evidence.

| Framework          | Control                                       | Source criterion      |
| ------------------ | --------------------------------------------- | --------------------- |
| SOC 2              | CC9.2 — Vendor Risk Management                | §3 composite + tier   |
| SOC 2              | CC7.4 — Incident Handling                     | §2.3 Breach History   |
| HIPAA              | §164.308(b)(1) — Business Associate Contracts | §2.2 DPA + §2.3 BAA   |
| HIPAA              | §164.414 — Breach Notification by BA          | §2.3 72-hour addendum |
| ISO 27001          | A.15 — Supplier Relationships                 | All of §2             |
| NIST SP 800-161 r1 | SC-3 — Supply Chain Risk Management           | All of §2 + scoring   |

---

## 6. Roles

| Role                 | Owner          | Responsibility                                                              |
| -------------------- | -------------- | --------------------------------------------------------------------------- |
| Vendor Risk Owner    | Chad (interim) | Owns this framework, approves assessment decisions, maintains the register. |
| Sponsoring Team      | Filing team    | Files intake, provides use-case and data-category context.                  |
| Legal                | TBD            | Negotiates DPA + breach-notification addendum.                              |
| Security Engineering | Chad           | Reviews certifications, runs independent verification of breach history.    |

---

## 7. Open Items

These are deliberately tracked here so the framework is honest about its current
gaps:

- [ ] `docs/linear-audit/vendor-register.md` does not yet exist. It will be
      created by the follow-on VRA-3 task (Linear issue to be filed).
- [ ] Automated dependency scanning (Trivy) feeds S3 in `s3-scan-results.md`;
      the cross-link from the vendor register needs to be wired once the
      register exists.
- [ ] The Linear Vendor Intake template is not yet defined. It will be created
      under the same follow-on VRA-3 task.
- [ ] Compensation-control catalogue for Conditional vendors is illustrative in
      §4.2; needs a concrete control list mapped to SOC 2 CC points of focus.

---

## 8. Change Log

| Date       | Author | Summary                                                                                                                                                                                                        |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-30 | Chad   | Initial framework created under PIX-4152 (VRA-2). Covers 4 assessment criteria, 0–5 scoring per criterion, weighted composite (0–100), 3-tier decision, hard gates, lifecycle, compliance mapping, open items. |
