# BAA Compliance Gate — G2.3

> **Linear**: [PIX-4428](https://linear.app/pixelated/issue/PIX-4428/g23-baa-compliance-gate)
> **Project**: EHR Module Add-On (6de10c78) · **Milestone**: Phase 2 AI-Assisted Tools (dc9f17c0)
> **Priority**: Medium · **Estimate**: 1 pt
> **Status**: Required compliance gate — blocks AI service deployment when BAA is missing.

---

## 1. Purpose

This document defines the **Business Associate Agreement (BAA) compliance
requirements** for every AI service that touches Protected Health Information
(PHI) within the Pixelated Empathy EHR Module Add-On. It is the authoritative
specification for the automated gate at
[`scripts/compliance/check_baa_compliance.sh`](../../scripts/compliance/check_baa_compliance.sh)
and the CI workflow at
[`.github/workflows/baa-compliance-gate.yml`](../../.github/workflows/baa-compliance-gate.yml).

The gate **fails closed**: if any AI service handling PHI lacks a confirmed
BAA, the gate blocks deployment and CI fails with a clear, actionable
message.

---

## 2. Regulatory Context

| Regulation | Scope | BAA Trigger |
|---|---|---|
| **HIPAA Privacy Rule** (45 CFR §164.504) | Covered entities & business associates | Required before PHI disclosure to a business associate |
| **HIPAA Security Rule** (45 CFR §164.308–§164.312) | Administrative, physical, technical safeguards | BAA must obligate safeguards |
| **HITECH Act** (Pub.L. 111-5) | Breach notification, audit, enforcement | BAA must include breach notification terms |
| **Omnibus Rule** (2013) | Direct liability for business associates | Subcontractors also require BAAs |

A **Business Associate** is any entity that creates, receives, maintains, or
transmits PHI on behalf of a covered entity. AI inference providers that
process patient text, transcripts, or clinical notes qualify.

---

## 3. BAA Requirements — NIM on Hetzner

Pixelated Empathy deploys NVIDIA NIM (NVIDIA Inference Microservices) on
Hetzner Cloud dedicated hosts for AI inference. Because NIM processes PHI
(patient transcripts, clinical notes, therapeutic session content), a BAA is
**mandatory** before any production deployment.

### 3.1 Parties

| Role | Entity | Signatory |
|---|---|---|
| **Covered Entity** | Pixelated Empathy (operating entity) | CEO or designated Privacy Officer |
| **Business Associate** | Hetzner Online GmbH (infrastructure) | Hetzner's Legal/Privacy team |
| **Subcontractor** | NVIDIA Corporation (NIM model provider) | NVIDIA's Legal/BAA desk |

> **Note**: Hetzner provides IaaS. A BAA with Hetzner covers infrastructure-level
> PHI handling. NVIDIA NIM may require a separate BAA or a subcontractor
> attestation under the primary BAA, depending on deployment model.

### 3.2 Required BAA Provisions

Every BAA must include, at minimum:

1. **Permitted Uses & Disclosures** — PHI used only for providing AI inference
   services on behalf of Pixelated Empathy; no independent use.
2. **Safeguards** — Administrative, physical, and technical safeguards
   compliant with 45 CFR §164.308–§164.312.
3. **Breach Notification** — Notification to Pixelated Empathy within **24
   hours** of discovery of a Breach of Unsecured PHI, per 45 CFR §164.410.
4. **Subcontractors** — Written assurance that any subcontractor accessing PHI
   is bound by equivalent terms.
5. **Termination** — Termination for breach; return or destroy PHI upon
   termination (or certify destruction if return is infeasible).
6. **HHS Access** — Making records available to the HHS Secretary for
   compliance audits.
7. **Permitted Use Reporting** — Reporting any use or disclosure not permitted
   by the BAA within **10 business days**.

### 3.3 Encryption Specifications

PHI must be encrypted **in transit** and **at rest** at all times:

| Layer | Standard | Configuration |
|---|---|---|
| **In Transit** | TLS 1.3 | Minimum TLS 1.2 rejected; cipher suites limited to AEAD (AES-GCM, ChaCha20-Poly1305) |
| **At Rest — Database** | AES-256-GCM | PostgreSQL 17 with `pgcrypto` / TDE; key managed via KMS |
| **At Rest — Object Storage** | AES-256 | S3-compatible storage with SSE-S3 or SSE-KMS |
| **At Rest — Volumes** | AES-256-XTS | LUKS2 full-disk encryption on Hetzner volumes |
| **Key Management** | AES-256 keys | Rotated every 90 days; stored in HSM-backed KMS |

> No PHI may be transmitted to any service that does not meet these encryption
> standards. The compliance gate verifies encryption configuration is present.

### 3.4 Data Retention Policy

| Data Category | Retention | Disposition |
|---|---|---|
| **Session transcripts (PHI)** | 6 years (HIPAA retention) or per state law, whichever is longer | Secure deletion via NIST SP 800-88 Purge |
| **AI inference logs (PHI-bearing)** | 6 years | NIST SP 800-88 Purge |
| **BAA contracts** | 6 years post-termination | Archive with legal records |
| **Audit logs** | 6 years | NIST SP 800-88 Purge |
| **Model artifacts (non-PHI)** | Indefinite or until model decommissioned | Standard deletion |

> **No PHI retention by business associate.** The BAA must require Hetzner and
> NVIDIA to return or destroy PHI at termination. Retention beyond the
> specified period is a breach of the BAA.

---

## 4. No PHI Without BAA

**Rule**: No AI service may receive PHI unless its BAA confirmation
environment variable is set to `true`.

| Service | BAA Env Var | Requirement |
|---|---|---|
| NIM on Hetzner | `BAA_NIM_HETZER_CONFIRMED` | Must be `true` |
| NIM (NVIDIA) | `BAA_NVIDIA_CONFIRMED` | Must be `true` if NVIDIA processes PHI |
| Embedding service | `BAA_EMBEDDING_CONFIRMED` | Must be `true` if service processes PHI |
| Transcription service | `BAA_TRANSCRIPTION_CONFIRMED` | Must be `true` if service processes PHI |
| Bias detection (PHI) | `BAA_BIAS_DETECTION_CONFIRMED` | Must be `true` if service processes PHI |

> The gate checks each env var. A missing or `false` value for any service that
> the deployment routes PHI to causes CI failure.

---

## 5. BAA Execution Checklist — NIM on Hetzner

### Pre-Deployment Checklist

- [ ] **Identify PHI flow**: Document every path where PHI reaches NIM
  (transcripts, clinical notes, session content).
- [ ] **Sign Hetzner BAA**: Covered Entity (Pixelated Empathy Privacy Officer)
  signs BAA with Hetzner Online GmbH.
- [ ] **Sign NVIDIA BAA** (if applicable): If NVIDIA processes PHI directly
  (model fine-tuning, telemetry), sign NVIDIA BAA.
- [ ] **Verify encryption**: Confirm TLS 1.3 in transit, AES-256 at rest on
  all Hetzner volumes hosting NIM.
- [ ] **Verify key management**: Confirm KMS-backed key rotation (90-day cadence).
- [ ] **Set BAA env vars**: Set all `BAA_*_CONFIRMED=true` in the deployment
  environment and secrets store.
- [ ] **Run compliance gate**: Execute
  `scripts/compliance/check_baa_compliance.sh` — must exit 0.

### Renewal Cadence

| Item | Cadence | Owner |
|---|---|---|
| BAA contract review | Annually | Privacy Officer |
| BAA renewal | On contract expiry (typically 3 years) | Legal + Privacy Officer |
| Encryption key rotation | Every 90 days | DevOps / Security |
| BAA env var audit | Every deployment | CI gate (automated) |
| BAA status audit | Quarterly | Compliance team |

### Breach Response (BAA-triggered)

1. **Discovery**: Business associate notifies Pixelated Empathy within 24 hours.
2. **Assessment**: Privacy Officer assesses scope within 48 hours.
3. **Notification**: Affected individuals notified within 60 days (45 CFR §164.404).
4. **Documentation**: Breach logged in breach register; HHS notified if >500 individuals.
5. **Post-incident**: Root cause analysis; BAA terms reviewed; safeguards updated.

---

## 6. Gate Behavior

### Pass Conditions

All of the following must be true:

1. Every AI service BAA env var (`BAA_*_CONFIRMED`) is set to `true`.
2. Encryption configuration present (`PHI_ENCRYPTION_IN_TRANSIT` = `tls1.3` and
   `PHI_ENCRYPTION_AT_REST` = `aes-256`).
3. Data retention policy documented (`PHI_RETENTION_POLICY` = `documented`).
4. No PHI routing to services without BAA (`PHI_REQUIRES_BAA` not `false`).

### Fail Conditions (Gate Fails Closed)

The gate exits non-zero (CI failure) if:

- Any `BAA_*_CONFIRMED` env var is missing or not `true`.
- Encryption env vars are missing or set to non-compliant values.
- Data retention policy env var is missing.
- The `--strict` flag is used and any warning is present.

### CI Integration

The gate runs on every PR that touches `ai/` or `ehr/` paths via
[`.github/workflows/baa-compliance-gate.yml`](../../.github/workflows/baa-compliance-gate.yml).

---

## 7. BAA Template

See [`baa-template.md`](./baa-template.md) for a reference BAA template for
NIM on Hetzner.

---

## 8. References

- 45 CFR §164.504 — Business Associate Contracts
- 45 CFR §164.308–§164.312 — HIPAA Security Rule
- 45 CFR §164.410 — Breach Notification by Business Associate
- HHS Guidance on Business Associate Agreements
- NIST SP 800-88 — Guidelines for Media Sanitization
- NIST SP 800-111 — Guide to Storage Encryption Technologies

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-08-25 | Initial creation for PIX-4428 G2.3 | Firstmate crewmate |
