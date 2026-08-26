# HIPAA Compliance Gap Assessment

**Issue:** PIX-4155 (SOC2-2: Conduct HIPAA Compliance Gap Assessment)
**Parent:** PIX-4130 (Enterprise Gap: SOC2 / HIPAA Certification Readiness)
**Project:** Enterprise Readiness Program **Assessment Date:** 2026-08-01
**Assessor:** Sisyphus (AI Agent) **Review Status:** Draft — pending
legal/compliance review

---

## 1. Executive Summary

This assessment maps Pixelated Empathy's existing controls to HIPAA Privacy,
Security, and Breach Notification Rules and identifies gaps that must be
remediated before formal HIPAA certification or Business Associate Agreement
(BAA) execution with covered entities.

**Current State:**

- Strong technical foundation: FHE encryption, audit logging, consent management
- HIPAA-aligned controls already implemented (JITScenarioInjector HIPAA gating,
  audit trail export, tenant isolation)
- Comprehensive threat model covering PHI-equivalent data flows
- Active vulnerability scanning and dependency management

**Key Gaps:**

1. No formal HIPAA policies and procedures documentation
2. No designated HIPAA Privacy Officer or Security Officer
3. No Business Associate Agreement (BAA) framework
4. No formal risk analysis per HIPAA Security Rule §164.308(a)(1)(ii)(A)
5. No breach notification procedures per HIPAA Breach Notification Rule
6. No workforce training program specific to HIPAA
7. No documented sanction policy for HIPAA violations

**Estimated Remediation Effort:** 12-16 weeks for initial compliance readiness

---

## 2. HIPAA Regulatory Framework Overview

HIPAA applies to **Covered Entities** (healthcare providers, health plans,
clearinghouses) and **Business Associates** (entities that handle PHI on behalf
of covered entities).

**Pixelated Empathy's Role:** Business Associate (processes emotion data that
may constitute PHI when used in healthcare contexts).

**Applicable Rules:**

| Rule                                               | Focus                        | Applicability |
| -------------------------------------------------- | ---------------------------- | ------------- |
| **Privacy Rule** (45 CFR §164.502-534)             | Use/disclosure of PHI        | **Required**  |
| **Security Rule** (45 CFR §164.302-318)            | Safeguards for ePHI          | **Required**  |
| **Breach Notification Rule** (45 CFR §164.400-414) | Notification of breaches     | **Required**  |
| **Enforcement Rule** (45 CFR §160)                 | Penalties for non-compliance | **Required**  |
| **Omnibus Rule** (2013)                            | Business associate liability | **Required**  |

---

## 3. HIPAA Security Rule Gap Analysis

### 3.1 Administrative Safeguards (§164.308)

| Standard                                        | Status      | Evidence                          | Gap                                                     |
| ----------------------------------------------- | ----------- | --------------------------------- | ------------------------------------------------------- |
| §164.308(a)(1)(ii)(A) Risk Analysis             | **Partial** | Risk register (22 STRIDE threats) | Not HIPAA-specific; no PHI-focused risk analysis        |
| §164.308(a)(1)(ii)(B) Risk Management           | **Partial** | Risk acceptance process           | No formal HIPAA risk management plan                    |
| §164.308(a)(1)(ii)(C) Sanction Policy           | **Gap**     | —                                 | No sanction policy for workforce HIPAA violations       |
| §164.308(a)(2) Assigned Security Responsibility | **Gap**     | —                                 | No designated HIPAA Security Officer                    |
| §164.308(a)(3) Workforce Security               | **Partial** | RBAC, tenant isolation            | No workforce clearance/termination procedures per HIPAA |
| §164.308(a)(4) Information Access Management    | **Strong**  | Auth0, RBAC, tenant isolation     | —                                                       |
| §164.308(a)(5)(i) Security Awareness & Training | **Gap**     | —                                 | No HIPAA-specific training program                      |
| §164.308(a)(5)(ii)(A)-(D) Security Reminders    | **Gap**     | —                                 | No phishing simulations, password management guidance   |
| §164.308(a)(6)(i) Security Incident Procedures  | **Partial** | SECURITY.md mentions response     | No HIPAA-specific incident response procedures          |
| §164.308(a)(6)(ii) Response & Reporting         | **Gap**     | —                                 | No breach notification procedures                       |
| §164.308(a)(7) Contingency Plan                 | **Partial** | DR runbook, backup procedures     | No HIPAA-specific contingency plan testing              |
| §164.308(a)(8) Evaluation                       | **Gap**     | —                                 | No periodic HIPAA compliance evaluation                 |

### 3.2 Physical Safeguards (§164.310)

| Standard                                 | Status      | Evidence                              | Gap                                        |
| ---------------------------------------- | ----------- | ------------------------------------- | ------------------------------------------ |
| §164.310(a)(1) Facility Access Controls  | **N/A**     | Cloud-hosted                          | Vendor responsibility (Cloudflare, Civo)   |
| §164.310(b) Workstation Use              | **Gap**     | —                                     | No workstation use policy                  |
| §164.310(c) Workstation Security         | **Gap**     | —                                     | No workstation security controls           |
| §164.310(d)(1) Device & Media Controls   | **Gap**     | —                                     | No device/media disposal procedures        |
| §164.310(d)(2) Disposal                  | **Gap**     | —                                     | No secure media disposal policy            |
| §164.310(d)(2)(ii) Re-Use                | **Gap**     | —                                     | No media re-use procedures                 |
| §164.310(d)(2)(iii) Accountability       | **Partial** | Asset inventory (vendor-inventory.md) | No hardware asset tracking for PHI devices |
| §164.310(d)(2)(iv) Data Backup & Storage | **Strong**  | AES-256-GCM encryption, backups       | —                                          |

### 3.3 Technical Safeguards (§164.312)

| Standard                                      | Status      | Evidence                                   | Gap                                      |
| --------------------------------------------- | ----------- | ------------------------------------------ | ---------------------------------------- |
| §164.312(a)(1) Access Control                 | **Strong**  | Auth0, JWT, RBAC, tenant isolation         | —                                        |
| §164.312(a)(2)(i) Unique User ID              | **Strong**  | Auth0 unique user IDs                      | —                                        |
| §164.312(a)(2)(ii) Emergency Access           | **Partial** | Break-glass mentioned                      | No documented emergency access procedure |
| §164.312(a)(2)(iii) Automatic Logoff          | **Partial** | Session timeouts                           | Not explicitly documented                |
| §164.312(a)(2)(iv) Encryption & Decryption    | **Strong**  | AES-256-GCM, TLS 1.3, FHE                  | —                                        |
| §164.312(b) Audit Controls                    | **Strong**  | Audit logging, provenance tracking, export | —                                        |
| §164.312(c)(1) Integrity                      | **Strong**  | SHA-256 hashing, tamper detection          | —                                        |
| §164.312(c)(2) Mechanism to Authenticate ePHI | **Strong**  | Digital signatures, provenance             | —                                        |
| §164.312(d) Person/Entity Authentication      | **Strong**  | Auth0, API keys, MFA enforcement           | —                                        |
| §164.312(e)(1) Transmission Security          | **Strong**  | TLS 1.3, HSTS                              | —                                        |

---

## 4. HIPAA Privacy Rule Gap Analysis

### 4.1 Uses and Disclosures (§164.502-520)

| Standard                             | Status      | Evidence                     | Gap                                                |
| ------------------------------------ | ----------- | ---------------------------- | -------------------------------------------------- |
| §164.502 General Rules               | **Partial** | Consent management           | No formal use/disclosure policy                    |
| §164.506 Consent                     | **Partial** | Consent management mentioned | No formal consent framework per HIPAA              |
| §164.508 Authorization               | **Gap**     | —                            | No HIPAA-compliant authorization form              |
| §164.510 Uses for TPO                | **Partial** | Data minimization            | No TPO (Treatment, Payment, Operations) policy     |
| §164.512 Permitted Uses              | **Gap**     | —                            | No policy for required by law, public health, etc. |
| §164.514 De-identification           | **Partial** | Anonymization mentioned      | No formal de-identification methodology            |
| §164.520 Notice of Privacy Practices | **Gap**     | —                            | No Notice of Privacy Practices (NPP)               |
| §164.524 Access                      | **Gap**     | —                            | No individual access request procedure             |
| §164.526 Amendment                   | **Gap**     | —                            | No amendment request procedure                     |
| §164.528 Accounting of Disclosures   | **Partial** | Audit logging                | No formal accounting of disclosures process        |

### 4.2 Minimum Necessary (§164.502(b), §164.514(d))

| Standard                     | Status      | Evidence                   | Gap                                       |
| ---------------------------- | ----------- | -------------------------- | ----------------------------------------- |
| Minimum Necessary Use        | **Partial** | RBAC scopes                | No formal minimum necessary determination |
| Minimum Necessary Disclosure | **Gap**     | —                          | No disclosure review procedures           |
| Role-Based Access            | **Strong**  | RBAC with read/write/admin | —                                         |

---

## 5. Breach Notification Rule Gap Analysis

### 5.1 Breach Detection & Assessment (§164.402)

| Standard               | Status      | Evidence                                 | Gap                                                        |
| ---------------------- | ----------- | ---------------------------------------- | ---------------------------------------------------------- |
| Breach Definition      | **Partial** | SECURITY.md mentions unauthorized access | No formal breach definition per HIPAA                      |
| Breach Risk Assessment | **Gap**     | —                                        | No 4-factor breach risk assessment methodology             |
| Breach Presumption     | **Gap**     | —                                        | No policy that acquisition = breach unless low probability |

### 5.2 Notification Requirements (§164.404-414)

| Standard                           | Status  | Evidence | Gap                                                      |
| ---------------------------------- | ------- | -------- | -------------------------------------------------------- |
| Individual Notification (§164.404) | **Gap** | —        | No individual notification procedures                    |
| Media Notification (§164.406)      | **Gap** | —        | No media notification procedures (>500 individuals)      |
| HHS Notification (§164.408)        | **Gap** | —        | No HHS Secretary notification procedures                 |
| 60-Day Timeline                    | **Gap** | —        | No tracking of breach discovery to notification timeline |
| Content Requirements               | **Gap** | —        | No notification templates                                |
| Burden of Proof                    | **Gap** | —        | No documentation of notification efforts                 |

### 5.3 Administrative Requirements (§164.410-412)

| Standard              | Status  | Evidence | Gap                                        |
| --------------------- | ------- | -------- | ------------------------------------------ |
| Burden of Proof       | **Gap** | —        | No documentation requirements              |
| Law Enforcement Delay | **Gap** | —        | No law enforcement delay procedures        |
| Breach Log (<500)     | **Gap** | —        | No annual HHS reporting for small breaches |

---

## 6. Business Associate Agreement (BAA) Gap Analysis

| Requirement           | Status  | Evidence | Gap                                                 |
| --------------------- | ------- | -------- | --------------------------------------------------- |
| BAA Template          | **Gap** | —        | No BAA template                                     |
| BAA Execution Process | **Gap** | —        | No process for executing BAAs with covered entities |
| Subcontractor BAAs    | **Gap** | —        | No requirement for downstream BAAs                  |
| BAA Review Process    | **Gap** | —        | No periodic BAA review                              |
| Vendor BAA Status     | **Gap** | —        | No tracking of which vendors have BAAs              |

---

## 7. Gap Summary & Prioritization

### 7.1 Critical Gaps (Must remediate before any PHI handling)

| #   | Gap                                  | Rule                  | Effort  | Priority |
| --- | ------------------------------------ | --------------------- | ------- | -------- |
| 1   | No HIPAA Security Officer designated | §164.308(a)(2)        | 1 week  | **P0**   |
| 2   | No HIPAA Privacy Officer designated  | §164.530(a)           | 1 week  | **P0**   |
| 3   | No HIPAA risk analysis               | §164.308(a)(1)(ii)(A) | 4 weeks | **P0**   |
| 4   | No breach notification procedures    | §164.404-414          | 2 weeks | **P0**   |
| 5   | No BAA framework                     | Omnibus Rule          | 3 weeks | **P0**   |
| 6   | No HIPAA policies and procedures     | All                   | 4 weeks | **P0**   |

### 7.2 High-Priority Gaps (Should remediate before certification)

| #   | Gap                                    | Rule                  | Effort  | Priority |
| --- | -------------------------------------- | --------------------- | ------- | -------- |
| 7   | No workforce HIPAA training            | §164.308(a)(5)        | 2 weeks | **P1**   |
| 8   | No sanction policy                     | §164.308(a)(1)(ii)(C) | 1 week  | **P1**   |
| 9   | No contingency plan testing            | §164.308(a)(7)        | 2 weeks | **P1**   |
| 10  | No Notice of Privacy Practices         | §164.520              | 2 weeks | **P1**   |
| 11  | No individual access request procedure | §164.524              | 1 week  | **P1**   |
| 12  | No minimum necessary determination     | §164.514(d)           | 1 week  | **P1**   |

### 7.3 Medium-Priority Gaps (Can remediate during implementation)

| #   | Gap                                 | Rule           | Effort  | Priority |
| --- | ----------------------------------- | -------------- | ------- | -------- |
| 13  | No workstation use policy           | §164.310(b)    | 1 week  | **P2**   |
| 14  | No device/media disposal procedures | §164.310(d)    | 1 week  | **P2**   |
| 15  | No amendment request procedure      | §164.526       | 1 week  | **P2**   |
| 16  | No periodic compliance evaluation   | §164.308(a)(8) | Ongoing | **P2**   |
| 17  | No de-identification methodology    | §164.514       | 2 weeks | **P2**   |

---

## 8. Remediation Roadmap

### Phase 1: Governance & Risk (Weeks 1-4)

**Week 1: Designate Officers**

- [ ] Designate HIPAA Security Officer (name, role, responsibilities)
- [ ] Designate HIPAA Privacy Officer (name, role, responsibilities)
- [ ] Document officer roles in organizational chart

**Week 2-3: HIPAA Risk Analysis**

- [ ] Conduct PHI inventory (what data, where stored, who accesses, how
      transmitted)
- [ ] Identify threats to PHI (from existing STRIDE analysis + HIPAA-specific)
- [ ] Assess current controls against HIPAA requirements
- [ ] Calculate risk levels (likelihood × impact for each threat)
- [ ] Document in HIPAA Risk Analysis Report

**Week 4: Core Policies**

- [ ] Draft HIPAA Privacy Policy
- [ ] Draft HIPAA Security Policy
- [ ] Draft Sanction Policy
- [ ] Draft Minimum Necessary Policy

### Phase 2: Breach & BAA (Weeks 5-8)

**Week 5-6: Breach Notification**

- [ ] Define breach per HIPAA (unauthorized use/disclosure compromising PHI)
- [ ] Create 4-factor breach risk assessment methodology
- [ ] Draft individual notification template
- [ ] Draft HHS notification template
- [ ] Draft media notification template (for >500 individuals)
- [ ] Create breach response timeline tracker (60-day clock)

**Week 7-8: BAA Framework**

- [ ] Draft BAA template (per §164.504(e))
- [ ] Create BAA execution process
- [ ] Identify vendors requiring BAAs (Auth0, Cloudflare, Civo, Sentry)
- [ ] Contact vendors for BAA execution
- [ ] Create subcontractor BAA requirement

### Phase 3: Procedures & Training (Weeks 9-12)

**Week 9-10: Individual Rights**

- [ ] Create individual access request procedure (§164.524)
- [ ] Create amendment request procedure (§164.526)
- [ ] Create accounting of disclosures process (§164.528)
- [ ] Draft Notice of Privacy Practices (§164.520)
- [ ] Create de-identification methodology (§164.514)

**Week 11-12: Training & Testing**

- [ ] Develop HIPAA training program (onboarding + annual)
- [ ] Create training materials (slides, video, quiz)
- [ ] Conduct first HIPAA training for all workforce members
- [ ] Document training completion
- [ ] Conduct contingency plan tabletop exercise
- [ ] Test breach notification procedures

### Phase 4: Documentation & Audit (Weeks 13-16)

**Week 13-14: Documentation**

- [ ] Compile all policies into HIPAA Policy Manual
- [ ] Create HIPAA Procedures Manual
- [ ] Document all workforce members with PHI access
- [ ] Create HIPAA compliance checklist
- [ ] Document all BAAs executed

**Week 15-16: Pre-Audit Review**

- [ ] Conduct internal HIPAA compliance self-assessment
- [ ] Engage external HIPAA auditor for readiness review
- [ ] Remediate findings
- [ ] Schedule formal HIPAA certification audit (if pursuing)

---

## 9. Technical Controls Already in Place

The following HIPAA-aligned controls are already implemented and documented:

| Control                    | Implementation                                    | Evidence                  |
| -------------------------- | ------------------------------------------------- | ------------------------- |
| **Encryption at rest**     | AES-256-GCM for all stored data                   | security-baseline.json    |
| **Encryption in transit**  | TLS 1.3, HSTS                                     | security-baseline.json    |
| **FHE for inference**      | Fully Homomorphic Encryption for emotion analysis | Phase 2 implementation    |
| **Access controls**        | Auth0 JWT, RBAC, tenant isolation                 | security-baseline.json    |
| **Audit logging**          | Comprehensive audit trail with provenance         | Phase 3 implementation    |
| **HIPAA gating**           | JITScenarioInjector blocks non-HIPAA scenarios    | Phase 2 implementation    |
| **Data minimization**      | Consent management, minimal data collection       | Existing procedures       |
| **Vulnerability scanning** | Trivy, dependency scanning                        | CI/CD pipelines           |
| **Incident detection**     | Sentry monitoring, anomaly detection              | Existing infrastructure   |
| **Backup & recovery**      | Automated backups, DR runbook                     | docs/enterprise/runbooks/ |

**Assessment:** ~60% of HIPAA technical safeguards already implemented. Primary
gaps are administrative (policies, procedures, training) and organizational
(officers, BAAs).

---

## 10. Cost Estimates

| Phase               | Activities                             | Estimated Cost                                  |
| ------------------- | -------------------------------------- | ----------------------------------------------- |
| Phase 1             | Governance, risk analysis, policies    | Internal (4 weeks)                              |
| Phase 2             | Breach procedures, BAA framework       | Internal (4 weeks) + Legal ($5-10K)             |
| Phase 3             | Training, testing, individual rights   | Internal (4 weeks) + Training materials ($2-5K) |
| Phase 4             | Documentation, pre-audit review        | Internal (4 weeks) + External auditor ($10-20K) |
| HIPAA Certification | External audit (optional)              | $30-50K                                         |
| Annual Maintenance  | Training, monitoring, re-certification | $15-25K/year                                    |

**Total first-year estimate:** $62-110K (including internal time)

---

## 11. BAA Readiness Checklist

Before executing BAAs with covered entities, ensure:

- [ ] HIPAA Security Officer designated
- [ ] HIPAA Privacy Officer designated
- [ ] HIPAA risk analysis completed
- [ ] All P0 gaps remediated
- [ ] BAA template reviewed by legal counsel
- [ ] Vendor BAAs in place (Auth0, Cloudflare, Civo, Sentry)
- [ ] Breach notification procedures documented
- [ ] HIPAA training completed for all workforce members
- [ ] HIPAA policies approved by leadership
- [ ] Contingency plan tested
- [ ] Individual rights procedures documented

---

## 12. PHI Inventory

**Required by HIPAA Security Rule §164.308(a)(1)(ii)(A)**

| Data Element             | PHI Status        | Storage Location      | Access Controls        | Encryption         |
| ------------------------ | ----------------- | --------------------- | ---------------------- | ------------------ |
| Emotion analysis results | **Potential PHI** | SQLite/PostgreSQL     | RBAC, tenant isolation | AES-256-GCM        |
| Conversation transcripts | **Potential PHI** | SQLite/PostgreSQL     | RBAC, tenant isolation | AES-256-GCM        |
| User identifiers         | **PHI**           | Auth0                 | Auth0 access controls  | TLS 1.3 in transit |
| Consent records          | **PHI**           | SQLite/PostgreSQL     | RBAC, audit logging    | AES-256-GCM        |
| Audit logs               | **PHI**           | SQLite/PostgreSQL     | Read-only, audit trail | AES-256-GCM        |
| Scenario configurations  | **Not PHI**       | Configuration files   | RBAC                   | TLS 1.3 in transit |
| API keys                 | **Not PHI**       | Environment variables | Access controls        | Encrypted at rest  |

**Note:** Emotion analysis results may constitute PHI when used in healthcare
contexts (e.g., mental health assessment, patient monitoring). Default
assumption: treat all emotion data as PHI.

---

## 13. Next Steps

1. **Immediate (This Week):**
   - Designate HIPAA Security Officer and Privacy Officer
   - Review this assessment with leadership and legal counsel
   - Prioritize P0 gaps

2. **Week 1:**
   - Begin PHI inventory
   - Begin HIPAA risk analysis
   - Schedule weekly remediation sync

3. **Week 4:**
   - Complete HIPAA risk analysis
   - Complete core policies
   - Begin breach notification procedures

4. **Week 8:**
   - Complete BAA framework
   - Begin vendor BAA execution
   - Begin training development

5. **Week 12:**
   - Complete all procedures
   - Conduct first training
   - Begin documentation compilation

6. **Week 16:**
   - Complete pre-audit review
   - Ready for HIPAA certification audit (if pursuing)

---

## 14. References

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [HIPAA Privacy Rule](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html)
- [HIPAA Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
- [HHS Breach Assessment Tool](https://www.hhs.gov/hipaa/for-professionals/breach-notification/guidance-for-covered-entities-and-business-associates/index.html)
- [NIST HIPAA Security Rule Handbook](https://csrc.nist.gov/publications/detail/nist/800-66-rev-2/final)
- Internal: `docs/linear-audit/risk-register.md`
- Internal: `docs/linear-audit/threat-model-scope.md`
- Internal: `security-baseline.json`

---

## 15. Change Log

| Date       | Author   | Change                                  |
| ---------- | -------- | --------------------------------------- |
| 2026-08-01 | Sisyphus | Initial HIPAA compliance gap assessment |
