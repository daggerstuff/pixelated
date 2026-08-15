---
title: HIPAA Risk Analysis
description:
  Comprehensive HIPAA risk analysis for Pixelated Empathy, identifying threats
  and vulnerabilities to protected health information (PHI) and evaluating risk
  levels per HIPAA Security Rule §164.308(a)(1)(ii)(A).
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# HIPAA Risk Analysis

**Pixelated Empathy — PHI Risk Assessment**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose and Scope

This risk analysis identifies and assesses risks to the confidentiality,
integrity, and availability of protected health information (PHI) created,
received, maintained, or transmitted by Pixelated Empathy. This analysis
satisfies the HIPAA Security Rule requirement for a risk analysis (45 CFR
§164.308(a)(1)(ii)(A)).

**Scope:**

- All systems, applications, and processes that handle PHI.
- All workforce members with access to PHI.
- All business associates with access to PHI.
- All PHI data flows (creation, storage, transmission, disposal).

**Methodology:**

- Threat identification (STRIDE model + HIPAA-specific threats).
- Vulnerability assessment (technical, administrative, physical).
- Risk scoring (likelihood × impact).
- Risk mitigation planning.

---

## 2. PHI Inventory

### 2.1 PHI Data Elements

Pixelated Empathy processes the following PHI data elements:

| Data Element                         | PHI Status | Source               | Storage Location       | Retention                      |
| ------------------------------------ | ---------- | -------------------- | ---------------------- | ------------------------------ |
| Patient identifiers (name, DOB, MRN) | PHI        | User registration    | PostgreSQL (encrypted) | Duration of account + 6 years  |
| Emotional analysis results           | PHI        | AI inference         | PostgreSQL (encrypted) | Duration of account + 6 years  |
| Conversation transcripts             | PHI        | User interactions    | PostgreSQL (encrypted) | Duration of account + 6 years  |
| Clinical session notes               | PHI        | User input           | PostgreSQL (encrypted) | Duration of account + 6 years  |
| Consent records                      | PHI        | User consent flows   | PostgreSQL (encrypted) | Duration of account + 10 years |
| Audit logs (PHI access)              | PHI        | System logging       | PostgreSQL (encrypted) | 6 years                        |
| User credentials (hashed)            | Not PHI    | User registration    | PostgreSQL (encrypted) | Duration of account            |
| API keys                             | Not PHI    | System configuration | Environment variables  | Until rotated                  |

### 2.2 PHI Data Flows

**Creation:**

- User registration (patient identifiers).
- User input (clinical notes, conversation transcripts).
- AI inference (emotional analysis results).

**Storage:**

- PostgreSQL database (encrypted at rest with AES-256-GCM).
- Encrypted backups (S3 with KMS encryption).
- Audit logs (append-only, integrity-verified).

**Transmission:**

- User ↔ Application: TLS 1.3 (HTTPS).
- Application ↔ Database: TLS 1.3 (internal network).
- Application ↔ AI Inference: TLS 1.3 (internal network or FHE).
- Backup replication: TLS 1.3 + encryption at rest.

**Access:**

- Users access their own PHI via authenticated web interface.
- Administrators access PHI for support (with audit logging).
- AI systems access PHI for inference (with FHE or zero-retention API).

**Disposal:**

- User account deletion: PHI encrypted with user-specific key, key destroyed.
- Backup retention: Backups retained for 6 years, then securely deleted.
- Audit logs: Retained for 6 years, then securely deleted.

### 2.3 PHI Access Roles

| Role                      | PHI Access Level         | Justification            |
| ------------------------- | ------------------------ | ------------------------ |
| Patient (user)            | Own PHI only             | Treatment, access rights |
| Clinician (if applicable) | Assigned patient PHI     | Treatment                |
| Support staff             | Limited PHI (with audit) | Support operations       |
| System administrators     | PHI (with audit + MFA)   | System operations        |
| AI inference systems      | PHI (encrypted/FHE)      | Treatment operations     |
| Business associates       | PHI per BAA              | Contracted services      |

---

## 3. Threat Identification

### 3.1 Threat Categories

**External Threats:**

- Unauthorized access (hackers, competitors, nation-states).
- Malware (ransomware, spyware, trojans).
- Denial of service (DDoS, resource exhaustion).
- Supply chain attacks (compromised dependencies, vendors).

**Internal Threats:**

- Workforce member misuse (intentional unauthorized access).
- Workforce member error (accidental disclosure, misconfiguration).
- Privileged user abuse (administrators exceeding authority).
- Former employee access (failure to revoke access).

**Environmental Threats:**

- Natural disasters (fire, flood, earthquake).
- Power failure (utility outage, hardware failure).
- Hardware failure (disk corruption, server crash).
- Network failure (connectivity loss, DNS failure).

**HIPAA-Specific Threats:**

- Unauthorized use of PHI (outside TPO without authorization).
- Unauthorized disclosure of PHI (to unauthorized parties).
- Breach of unsecured PHI (requiring notification).
- Failure to honor individual rights (access, amendment, accounting).
- Inadequate minimum necessary (over-access to PHI).

### 3.2 Threat Scenarios

| ID   | Threat                                        | Source   | Target                              | Likelihood | Impact   | Risk Level |
| ---- | --------------------------------------------- | -------- | ----------------------------------- | ---------- | -------- | ---------- |
| T-01 | SQL injection attack                          | External | Database (PHI)                      | Low        | Critical | High       |
| T-02 | Phishing → credential compromise              | External | User accounts (PHI access)          | Medium     | High     | High       |
| T-03 | Ransomware encryption of database             | External | Database (PHI availability)         | Low        | Critical | High       |
| T-04 | Insider unauthorized PHI access               | Internal | Database (PHI confidentiality)      | Medium     | High     | High       |
| T-05 | Misconfigured access controls                 | Internal | Application (PHI access)            | Medium     | High     | High       |
| T-06 | Lost/stolen laptop with PHI cache             | Internal | Local storage (PHI confidentiality) | Low        | High     | Medium     |
| T-07 | Cloud provider breach (AWS/Hetzner)           | External | Cloud storage (PHI)                 | Low        | Critical | High       |
| T-08 | Business associate breach                     | External | Vendor systems (PHI)                | Low        | High     | Medium     |
| T-09 | Failure to encrypt PHI at rest                | Internal | Database (PHI confidentiality)      | Low        | Critical | High       |
| T-10 | Audit log tampering                           | Internal | Audit logs (PHI integrity)          | Low        | High     | Medium     |
| T-11 | Failure to honor access request               | Internal | Individual rights (compliance)      | Low        | Medium   | Medium     |
| T-12 | Unauthorized PHI disclosure via API           | External | API (PHI confidentiality)           | Low        | High     | Medium     |
| T-13 | DDoS attack on application                    | External | Application (PHI availability)      | Medium     | Medium   | Medium     |
| T-14 | Key management failure (encryption keys lost) | Internal | Encrypted PHI (availability)        | Low        | Critical | High       |
| T-15 | Inadequate BAA with vendor                    | Internal | Vendor PHI handling (compliance)    | Medium     | High     | High       |

---

## 4. Vulnerability Assessment

### 4.1 Technical Vulnerabilities

**Encryption:**

- ✅ PHI encrypted at rest (AES-256-GCM).
- ✅ PHI encrypted in transit (TLS 1.3).
- ✅ FHE available for AI inference (zero-knowledge).
- ✅ Key management via cloud KMS (AWS KMS, GCP KMS).
- ⚠️ Backup encryption keys managed separately (ensure key rotation).

**Access Controls:**

- ✅ Authentication via Auth0 (MFA enforced).
- ✅ Role-based access control (RBAC) implemented.
- ✅ Tenant isolation enforced (row-level security).
- ✅ API authentication and authorization (JWT + scopes).
- ⚠️ Quarterly access review process defined but not yet executed.
- ⚠️ Offboarding procedure defined but not yet tested.

**Audit Logging:**

- ✅ All PHI access logged (who, what, when).
- ✅ Logs encrypted and tamper-evident.
- ✅ Log retention: 6 years (HIPAA compliant).
- ⚠️ Log monitoring for anomalies not fully automated.

**Network Security:**

- ✅ WAF (Cloudflare) protects public endpoints.
- ✅ DDoS protection (Cloudflare).
- ✅ Network segmentation (database not publicly accessible).
- ✅ VPN required for administrative access.
- ⚠️ Penetration testing not yet conducted (scheduled).

**Vulnerability Management:**

- ✅ Automated dependency scanning (Dependabot, Trivy).
- ✅ Critical vulnerability patching SLA: 48 hours.
- ✅ High vulnerability patching SLA: 7 days.
- ⚠️ Some high-severity vulnerabilities open (tracked in risk register).

### 4.2 Administrative Vulnerabilities

**Policies and Procedures:**

- ✅ Information Security Policy created.
- ✅ Incident Response Plan created.
- ✅ Access Control Procedure created.
- ✅ Change Management Policy created.
- ⚠️ HIPAA-specific policies (use/disclosure, individual rights) not yet
  created.
- ⚠️ Minimum necessary policy not yet documented.

**Training:**

- ⚠️ HIPAA training program not yet developed.
- ⚠️ Training completion tracking not yet implemented.
- ⚠️ Role-specific training (for PHI access) not yet defined.

**Risk Management:**

- ✅ Risk analysis conducted (this document).
- ⚠️ Risk management plan not yet created.
- ⚠️ Quarterly risk review not yet scheduled.

**Vendor Management:**

- ✅ Vendor inventory completed (VRA-1).
- ✅ Vendor risk assessments completed (VRA-3).
- ⚠️ BAAs not yet executed with all required vendors.
- ⚠️ Vendor monitoring program not yet established.

### 4.3 Physical Vulnerabilities

**Facilities:**

- ✅ Cloud-hosted infrastructure (no on-premises PHI servers).
- ✅ Cloud providers have physical security controls (SOC2 certified).
- ⚠️ Workforce members may access PHI from unsecured locations (remote work).

**Devices:**

- ✅ Company laptops have full-disk encryption.
- ✅ Mobile device management (MDM) for company phones.
- ⚠️ Personal device policy not yet documented (BYOD).
- ⚠️ Device disposal procedure not yet tested.

---

## 5. Risk Scoring

### 5.1 Likelihood Scale

| Likelihood         | Definition                                  | Probability     |
| ------------------ | ------------------------------------------- | --------------- |
| **Rare**           | May occur only in exceptional circumstances | <5% per year    |
| **Unlikely**       | Could occur at some time                    | 5-20% per year  |
| **Possible**       | Might occur at some time                    | 20-50% per year |
| **Likely**         | Will probably occur in most circumstances   | 50-80% per year |
| **Almost Certain** | Expected to occur in most circumstances     | >80% per year   |

### 5.2 Impact Scale

| Impact            | Definition                                  | Consequence                                                    |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------- |
| **Insignificant** | No material impact                          | No notification required, no fines                             |
| **Minor**         | Small impact, easily contained              | Minor notification, small fines (<$10K)                        |
| **Moderate**      | Noticeable impact, requires remediation     | Individual notification, moderate fines ($10K-$100K)           |
| **Major**         | Significant impact, substantial remediation | Large-scale notification, large fines ($100K-$1M)              |
| **Catastrophic**  | Severe impact, existential threat           | Mass notification, catastrophic fines (>$1M), business closure |

### 5.3 Risk Level Matrix

|                    | Insignificant | Minor  | Moderate | Major    | Catastrophic |
| ------------------ | ------------- | ------ | -------- | -------- | ------------ |
| **Almost Certain** | Medium        | High   | High     | Critical | Critical     |
| **Likely**         | Low           | Medium | High     | Critical | Critical     |
| **Possible**       | Low           | Medium | High     | High     | Critical     |
| **Unlikely**       | Low           | Low    | Medium   | High     | High         |
| **Rare**           | Low           | Low    | Low      | Medium   | High         |

### 5.4 Risk Scores (from Section 3.2)

| Risk Level   | Count | Threat IDs                                           |
| ------------ | ----- | ---------------------------------------------------- |
| **Critical** | 0     | —                                                    |
| **High**     | 8     | T-01, T-02, T-03, T-04, T-05, T-07, T-09, T-14, T-15 |
| **Medium**   | 6     | T-06, T-08, T-10, T-11, T-12, T-13                   |
| **Low**      | 0     | —                                                    |

---

## 6. Risk Mitigation Plan

### 6.1 High-Priority Mitigations (Address within 90 days)

| Threat ID               | Mitigation                                                         | Owner                  | Target Date | Status      |
| ----------------------- | ------------------------------------------------------------------ | ---------------------- | ----------- | ----------- |
| T-01 (SQL injection)    | Conduct penetration test, remediate findings                       | Security Lead          | 2026-11-01  | Scheduled   |
| T-02 (Phishing)         | Implement phishing simulation training, enforce MFA                | Security Lead          | 2026-10-01  | In Progress |
| T-03 (Ransomware)       | Test backup restoration, implement immutable backups               | DevOps Lead            | 2026-10-15  | In Progress |
| T-04 (Insider access)   | Implement quarterly access reviews, anomaly detection              | HIPAA Security Officer | 2026-11-01  | Planned     |
| T-05 (Misconfiguration) | Implement configuration management, automated compliance checks    | DevOps Lead            | 2026-10-15  | In Progress |
| T-07 (Cloud breach)     | Encrypt all PHI with customer-managed keys, test incident response | Security Lead          | 2026-11-01  | Planned     |
| T-09 (Unencrypted PHI)  | Verify all PHI storage encrypted, audit backup encryption          | Security Lead          | 2026-10-01  | In Progress |
| T-14 (Key management)   | Implement key rotation, test key recovery procedures               | DevOps Lead            | 2026-11-01  | Planned     |
| T-15 (Inadequate BAA)   | Execute BAAs with all required vendors (per VRA-3)                 | HIPAA Privacy Officer  | 2026-11-01  | In Progress |

### 6.2 Medium-Priority Mitigations (Address within 180 days)

| Threat ID                  | Mitigation                                                | Owner                 | Target Date | Status  |
| -------------------------- | --------------------------------------------------------- | --------------------- | ----------- | ------- |
| T-06 (Lost device)         | Implement remote wipe, enforce device encryption policy   | IT Lead               | 2026-12-01  | Planned |
| T-08 (BA breach)           | Implement vendor monitoring program, annual BAA review    | HIPAA Privacy Officer | 2026-12-01  | Planned |
| T-10 (Audit log tampering) | Implement log integrity monitoring, alert on anomalies    | Security Lead         | 2026-12-01  | Planned |
| T-11 (Individual rights)   | Implement individual rights request workflow, train staff | HIPAA Privacy Officer | 2026-12-01  | Planned |
| T-12 (API disclosure)      | Conduct API security review, implement rate limiting      | Engineering Lead      | 2026-12-01  | Planned |
| T-13 (DDoS)                | Verify DDoS protection configuration, test response plan  | DevOps Lead           | 2026-12-01  | Planned |

### 6.3 Ongoing Mitigations

| Mitigation              | Frequency                         | Owner                  |
| ----------------------- | --------------------------------- | ---------------------- |
| Vulnerability scanning  | Continuous (automated)            | DevOps Lead            |
| Patch management        | Per SLA (Critical: 48h, High: 7d) | Engineering Lead       |
| Access review           | Quarterly                         | HIPAA Security Officer |
| Risk analysis review    | Annual (or when material changes) | HIPAA Security Officer |
| HIPAA training          | Annual (all workforce)            | HIPAA Privacy Officer  |
| BAA review              | Annual (all vendors)              | HIPAA Privacy Officer  |
| Backup restoration test | Quarterly                         | DevOps Lead            |
| Incident response drill | Annual                            | Security Lead          |

---

## 7. Residual Risk

After implementing the mitigations in Section 6, the following residual risks
remain:

| Threat ID | Residual Risk Level | Justification                                                                      |
| --------- | ------------------- | ---------------------------------------------------------------------------------- |
| T-01      | Medium              | Penetration testing and remediation reduce but do not eliminate SQL injection risk |
| T-02      | Medium              | Phishing training and MFA reduce but do not eliminate credential compromise risk   |
| T-03      | Medium              | Backup testing reduces but does not eliminate ransomware impact                    |
| T-04      | Medium              | Access reviews reduce but do not eliminate insider threat risk                     |
| T-07      | Medium              | Encryption reduces but does not eliminate cloud provider breach risk               |

**Risk Acceptance:** The residual risk levels are acceptable given:

- The sensitivity of PHI and regulatory requirements.
- The cost-benefit of additional controls.
- The compensating controls already in place (encryption, audit logging, FHE).

**Risk Review:** Residual risks are reviewed quarterly by the HIPAA Security
Officer and CSO.

---

## 8. Certification Statement

This risk analysis was conducted in accordance with the HIPAA Security Rule (45
CFR §164.308(a)(1)(ii)(A)) and represents a comprehensive assessment of risks to
PHI created, received, maintained, or transmitted by Pixelated Empathy.

**Conducted By:** Chad (interim HIPAA Security Officer) **Date:** 2026-08-01
**Reviewed By:** [CSO name, pending] **Approval Date:** [Pending]

---

## 9. Related Documents

- [HIPAA Officer Designations](./hipaa-officer-designations.md)
- [Information Security Policy](./policies/information-security-policy.md)
- [Incident Response Plan](./policies/incident-response-plan.md)
- [Access Control Procedure](./policies/access-control-procedure.md)
- [Vendor Risk Register](../../linear-audit/vendor-register.md)
- [Risk Register](../../linear-audit/risk-register.md)
- [HIPAA Compliance Overview](../../compliance/hipaa.mdx)

---

## 10. Change Log

| Date       | Author   | Change                                             |
| ---------- | -------- | -------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial HIPAA risk analysis (PIX-4155 remediation) |

---

_Document owner: HIPAA Security Officer_ _Review cadence: Annual (or when
material changes occur)_ _Next review: 2027-08-01_
