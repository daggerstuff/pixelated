# SOC2 Readiness Gap Assessment

**Issue:** PIX-4154 (SOC2-1: Conduct SOC2 Readiness Gap Assessment) **Parent:**
PIX-4130 (Enterprise Gap: SOC2 / HIPAA Certification Readiness) **Project:**
Enterprise Readiness Program **Assessment Date:** 2026-08-01 **Assessor:**
Sisyphus (AI Agent) **Review Status:** Draft — pending external auditor review

---

## 1. Executive Summary

This assessment maps Pixelated Empathy's existing security controls to the SOC2
Trust Services Criteria (TSC) and identifies gaps that must be remediated before
engaging an external auditor for formal SOC2 Type II certification.

**Current State:**

- Strong technical foundation with encryption, audit logging, and access
  controls
- Comprehensive threat model and risk register completed (S2-S3)
- HIPAA-aligned controls in place (FHE encryption, audit trails, consent
  management)
- Active vulnerability scanning and dependency management

**Key Gaps:**

1. No formal SOC2 control mapping or evidence collection framework
2. Missing documented policies for several CC criteria
3. No independent control testing or monitoring program
4. Vendor risk management incomplete (VRA-3 pending)
5. Incident response procedures not tested

**Estimated Remediation Effort:** 8-12 weeks for Type I readiness, 6-12 months
for Type II

---

## 2. SOC2 Trust Services Criteria Overview

SOC2 evaluates controls across five Trust Services Criteria:

| Criterion                      | Focus                                                          | Applicability |
| ------------------------------ | -------------------------------------------------------------- | ------------- |
| **Security (CC1-CC9)**         | Protection against unauthorized access                         | **Required**  |
| **Availability (A1)**          | System availability for operation                              | Optional      |
| **Processing Integrity (PI1)** | Complete, valid, accurate, timely processing                   | Optional      |
| **Confidentiality (C1)**       | Protection of confidential information                         | Optional      |
| **Privacy (P1)**               | Collection, use, retention, disclosure of personal information | Optional      |

**Recommendation:** Pursue **Security + Confidentiality + Privacy** criteria
given PHI-equivalent data handling. Availability and Processing Integrity can be
added in Phase 2.

---

## 3. Control Mapping & Gap Analysis

### 3.1 CC1: Control Environment

**Objective:** Organization demonstrates commitment to integrity and ethical
values; board exercises oversight; management establishes structure, authority,
and responsibility.

| Control                             | Status      | Evidence                                | Gap                                                           |
| ----------------------------------- | ----------- | --------------------------------------- | ------------------------------------------------------------- |
| CC1.1: Integrity and ethical values | **Partial** | SECURITY.md, security-baseline.json     | No formal code of conduct or ethics policy                    |
| CC1.2: Board oversight              | **Gap**     | —                                       | No documented board/leadership security oversight structure   |
| CC1.3: Management structure         | **Partial** | Linear project structure, roles defined | No formal organizational chart with security responsibilities |
| CC1.4: Commitment to competence     | **Partial** | SECURITY.md mentions security training  | No documented security awareness training program             |
| CC1.5: Accountability               | **Partial** | Risk register has owners                | No formal performance metrics tied to security                |

**Remediation:**

- [ ] Draft Information Security Policy (covers ethics, acceptable use,
      confidentiality)
- [ ] Define security governance structure (who owns what)
- [ ] Create security roles and responsibilities matrix
- [ ] Establish security awareness training program (annual + onboarding)
- [ ] Define security KPIs and reporting cadence

---

### 3.2 CC2: Communication and Information

**Objective:** Organization obtains or generates and uses quality information to
support internal control functioning.

| Control                       | Status      | Evidence                               | Gap                                       |
| ----------------------------- | ----------- | -------------------------------------- | ----------------------------------------- |
| CC2.1: Internal communication | **Partial** | Linear issues, GitHub PRs              | No formal security communication policy   |
| CC2.2: External communication | **Partial** | SECURITY.md (vulnerability disclosure) | No formal incident notification procedure |
| CC2.3: Quality of information | **Partial** | Risk register, threat model            | No data quality or classification policy  |

**Remediation:**

- [ ] Draft Security Communication Policy (internal + external)
- [ ] Create data classification scheme (Public, Internal, Confidential,
      Restricted)
- [ ] Define incident notification procedures (who, when, how)
- [ ] Establish security reporting cadence (monthly to leadership, quarterly to
      board)

---

### 3.3 CC3: Risk Assessment

**Objective:** Organization identifies and assesses risks to achievement of
objectives.

| Control                        | Status      | Evidence                                        | Gap                                          |
| ------------------------------ | ----------- | ----------------------------------------------- | -------------------------------------------- |
| CC3.1: Objective specification | **Partial** | Enterprise Readiness Program                    | No formal enterprise risk appetite statement |
| CC3.2: Risk identification     | **Strong**  | Risk register (22 STRIDE threats), threat model | —                                            |
| CC3.3: Fraud risk assessment   | **Gap**     | —                                               | No fraud risk assessment                     |
| CC3.4: Risk analysis           | **Strong**  | Risk register with likelihood/impact scoring    | —                                            |
| CC3.5: Risk response           | **Partial** | Risk acceptance process defined                 | No formal risk treatment plan                |

**Remediation:**

- [ ] Document enterprise risk appetite and tolerance levels
- [ ] Conduct fraud risk assessment (financial, data theft, insider threat)
- [ ] Create formal risk treatment plan (mitigate, transfer, accept, avoid)
- [ ] Establish quarterly risk review cadence

---

### 3.4 CC4: Monitoring Activities

**Objective:** Organization selects, develops, and performs ongoing and/or
separate evaluations to ascertain whether components of internal control are
present and functioning.

| Control                          | Status      | Evidence                                | Gap                                                   |
| -------------------------------- | ----------- | --------------------------------------- | ----------------------------------------------------- |
| CC4.1: Ongoing monitoring        | **Partial** | CI/CD security scans, Sentry monitoring | No formal control monitoring program                  |
| CC4.2: Separate evaluations      | **Gap**     | —                                       | No internal audit or independent control testing      |
| CC4.3: Deficiency identification | **Partial** | Risk register tracks open items         | No formal deficiency tracking or remediation workflow |
| CC4.4: Deficiency communication  | **Partial** | Linear issues                           | No formal deficiency escalation policy                |

**Remediation:**

- [ ] Establish control monitoring program (automated + manual tests)
- [ ] Define control testing schedule (quarterly for key controls)
- [ ] Create deficiency tracking system (severity, owner, target date)
- [ ] Draft deficiency escalation policy (when to notify leadership/board)
- [ ] Consider engaging internal audit function or outsourced provider

---

### 3.5 CC5: Control Activities

**Objective:** Organization selects and develops control activities that
contribute to mitigation of risks to achievement of objectives to acceptable
levels.

| Control                           | Status      | Evidence                               | Gap                               |
| --------------------------------- | ----------- | -------------------------------------- | --------------------------------- |
| CC5.1: Control activity selection | **Strong**  | security-baseline.json, SECURITY.md    | —                                 |
| CC5.2: Technology controls        | **Strong**  | CSP, HSTS, encryption, MFA enforcement | —                                 |
| CC5.3: Deployment controls        | **Partial** | CI/CD pipelines, blue/green deployment | No formal change approval process |
| CC5.4: Segregation of duties      | **Partial** | RBAC scopes (read/write/admin)         | No formal SoD matrix              |

**Remediation:**

- [ ] Document all control activities in a control catalog
- [ ] Create change management policy (request, review, approve, implement,
      verify)
- [ ] Define segregation of duties matrix (who can do what, approval
      requirements)
- [ ] Establish configuration management baseline (what's tracked, how changes
      are approved)

---

### 3.6 CC6: Logical and Physical Access Controls

**Objective:** Organization restricts logical and physical access to information
assets to authorized personnel.

| Control                                | Status      | Evidence                                    | Gap                                        |
| -------------------------------------- | ----------- | ------------------------------------------- | ------------------------------------------ |
| CC6.1: Logical access security         | **Strong**  | Auth0 JWT, API keys, RBAC, tenant isolation | —                                          |
| CC6.2: User registration/authorization | **Strong**  | Auth0, scope-based permissions              | —                                          |
| CC6.3: Remote access security          | **Partial** | Cloudflare Tunnel, oauth2-proxy             | No formal remote access policy             |
| CC6.4: Physical access                 | **N/A**     | Cloud-hosted (Cloudflare, Civo)             | Vendor manages physical security           |
| CC6.5: System component removal        | **Gap**     | —                                           | No decommissioning procedure               |
| CC6.6: Access provisioning             | **Partial** | Auth0 user management                       | No formal access request/approval workflow |
| CC6.7: Periodic access review          | **Gap**     | —                                           | No quarterly access review process         |
| CC6.8: Access modification             | **Partial** | Auth0 role management                       | No formal role change approval process     |
| CC6.9: Access termination              | **Partial** | Auth0 user deactivation                     | No formal offboarding checklist            |

**Remediation:**

- [ ] Draft Access Control Policy (logical + physical, remote access)
- [ ] Create user access request/approval workflow (form, manager approval, IT
      provisioning)
- [ ] Establish quarterly access review process (review all users, roles,
      permissions)
- [ ] Define role change approval process (who approves, documentation required)
- [ ] Create offboarding checklist (revoke access, transfer data, confirm
      completion)
- [ ] Document system decommissioning procedure (data retention, access
      revocation, disposal)

---

### 3.7 CC7: System Operations

**Objective:** Organization operates systems to support achievement of
objectives.

| Control                          | Status      | Evidence                                   | Gap                                             |
| -------------------------------- | ----------- | ------------------------------------------ | ----------------------------------------------- |
| CC7.1: System monitoring         | **Strong**  | Sentry, audit logging, provenance tracking | —                                               |
| CC7.2: Anomaly detection         | **Partial** | Crisis detection, bias detection           | No formal anomaly detection for security events |
| CC7.3: Incident response         | **Partial** | SECURITY.md mentions 48h response          | No formal incident response plan                |
| CC7.4: Incident analysis         | **Gap**     | —                                          | No post-incident review process                 |
| CC7.5: Incident response testing | **Gap**     | —                                          | No tabletop exercises or IR drills              |

**Remediation:**

- [ ] Draft Incident Response Plan (IRP) with roles, procedures, communication
      plan
- [ ] Create security monitoring playbook (what to monitor, thresholds,
      escalation)
- [ ] Establish post-incident review process (root cause, lessons learned,
      remediation)
- [ ] Conduct quarterly tabletop exercises (simulate incidents, test IRP)
- [ ] Define incident severity levels and response time targets (already in
      security-baseline.json)

---

### 3.8 CC8: Change Management

**Objective:** Organization authorizes, designs, develops, and acquires changes
to systems to support achievement of objectives.

| Control                     | Status      | Evidence                                      | Gap                                          |
| --------------------------- | ----------- | --------------------------------------------- | -------------------------------------------- |
| CC8.1: Change authorization | **Partial** | GitHub PRs, code review                       | No formal change request process             |
| CC8.2: Change design        | **Partial** | Architecture docs, RFCs                       | No formal design review process              |
| CC8.3: Change development   | **Strong**  | CI/CD, automated testing, security scans      | —                                            |
| CC8.4: Change testing       | **Strong**  | Unit tests, integration tests, security tests | —                                            |
| CC8.5: Change approval      | **Partial** | PR approval required                          | No formal CAB (Change Advisory Board)        |
| CC8.6: Change deployment    | **Strong**  | Blue/green deployment, automated rollback     | —                                            |
| CC8.7: Change documentation | **Partial** | Git history, PR descriptions                  | No formal change log or release notes policy |

**Remediation:**

- [ ] Create formal change management policy (request, review, approve, test,
      deploy)
- [ ] Establish Change Advisory Board (CAB) or define approval authority
- [ ] Define change categories (standard, normal, emergency) with different
      approval paths
- [ ] Create change request template (impact, risk, rollback plan, testing
      evidence)
- [ ] Establish release notes policy (what to document, where to publish)

---

### 3.9 CC9: Risk Mitigation (Vendor Risk Management)

**Objective:** Organization identifies, selects, and develops activities to
reduce risk from vendors and business partners.

| Control                           | Status          | Evidence                             | Gap                                                 |
| --------------------------------- | --------------- | ------------------------------------ | --------------------------------------------------- |
| CC9.1: Vendor risk assessment     | **In Progress** | VRA-1 (inventory), VRA-2 (framework) | VRA-3 (vendor reviews) pending                      |
| CC9.2: Vendor monitoring          | **Gap**         | —                                    | No ongoing vendor monitoring program                |
| CC9.3: Vendor contract management | **Partial**     | SLA contract terms                   | No formal vendor security requirements in contracts |
| CC9.4: Third-party audit          | **Gap**         | —                                    | No right-to-audit clauses in vendor contracts       |

**Remediation:**

- [ ] Complete VRA-3: Conduct Tier 1 vendor security reviews (Auth0, Cloudflare,
      Civo, Sentry)
- [ ] Establish ongoing vendor monitoring program (annual reviews, continuous
      monitoring)
- [ ] Add security requirements to vendor contracts (encryption, access
      controls, incident notification)
- [ ] Include right-to-audit clauses in critical vendor contracts
- [ ] Create vendor risk register (track vendor risks separately from internal
      risks)

---

## 4. Additional Criteria Assessment

### 4.1 Confidentiality (C1)

**Objective:** Information designated as confidential is protected.

| Control                              | Status      | Evidence                                      | Gap                                  |
| ------------------------------------ | ----------- | --------------------------------------------- | ------------------------------------ |
| C1.1: Confidentiality classification | **Partial** | Data classification mentioned in threat model | No formal data classification policy |
| C1.2: Confidentiality controls       | **Strong**  | AES-256-GCM, TLS 1.3, FHE                     | —                                    |
| C1.3: Confidentiality disposal       | **Gap**     | —                                             | No data disposal/destruction policy  |

**Remediation:**

- [ ] Draft Data Classification Policy (Public, Internal, Confidential,
      Restricted)
- [ ] Define handling requirements per classification level
- [ ] Create data disposal policy (secure deletion, certificate of destruction)
- [ ] Implement data loss prevention (DLP) controls (already partially in place
      via encryption)

### 4.2 Privacy (P1)

**Objective:** Personal information is collected, used, retained, and disclosed
in conformity with commitments.

| Control                       | Status      | Evidence                       | Gap                                           |
| ----------------------------- | ----------- | ------------------------------ | --------------------------------------------- |
| P1.1: Privacy notice          | **Gap**     | —                              | No privacy policy or notice                   |
| P1.2: Consent                 | **Partial** | Consent management mentioned   | No formal consent management framework        |
| P1.3: Data minimization       | **Partial** | PHI handling procedures        | No formal data minimization policy            |
| P1.4: Retention               | **Partial** | Audit log retention (365 days) | No comprehensive data retention policy        |
| P1.5: Access to personal data | **Gap**     | —                              | No data subject access request (DSAR) process |
| P1.6: Data disposal           | **Gap**     | —                              | No data disposal policy                       |

**Remediation:**

- [ ] Draft Privacy Policy / Privacy Notice (what data is collected, how it's
      used, rights)
- [ ] Create consent management framework (opt-in, opt-out, withdrawal)
- [ ] Define data minimization principles (collect only what's needed, anonymize
      when possible)
- [ ] Establish data retention schedule (per data type, legal requirements,
      disposal dates)
- [ ] Create DSAR process (how users request access, correction, deletion)
- [ ] Implement data disposal procedures (secure deletion, anonymization)

---

## 5. Gap Summary & Prioritization

### 5.1 Critical Gaps (Must remediate before audit)

| #   | Gap                                | Criteria | Effort  | Priority |
| --- | ---------------------------------- | -------- | ------- | -------- |
| 1   | No Information Security Policy     | CC1      | 2 weeks | **P0**   |
| 2   | No Incident Response Plan          | CC7      | 2 weeks | **P0**   |
| 3   | No Access Control Policy           | CC6      | 1 week  | **P0**   |
| 4   | No Change Management Policy        | CC8      | 1 week  | **P0**   |
| 5   | No formal access review process    | CC6      | Ongoing | **P0**   |
| 6   | Incomplete vendor risk assessments | CC9      | 4 weeks | **P0**   |

### 5.2 High-Priority Gaps (Should remediate before audit)

| #   | Gap                             | Criteria | Effort  | Priority |
| --- | ------------------------------- | -------- | ------- | -------- |
| 7   | No data classification policy   | C1, P1   | 1 week  | **P1**   |
| 8   | No privacy policy               | P1       | 2 weeks | **P1**   |
| 9   | No control monitoring program   | CC4      | 3 weeks | **P1**   |
| 10  | No deficiency tracking system   | CC4      | 2 weeks | **P1**   |
| 11  | No segregation of duties matrix | CC5      | 1 week  | **P1**   |
| 12  | No post-incident review process | CC7      | 1 week  | **P1**   |

### 5.3 Medium-Priority Gaps (Can remediate during audit preparation)

| #   | Gap                             | Criteria | Effort    | Priority |
| --- | ------------------------------- | -------- | --------- | -------- |
| 13  | No security awareness training  | CC1      | Ongoing   | **P2**   |
| 14  | No tabletop exercises           | CC7      | Quarterly | **P2**   |
| 15  | No formal change advisory board | CC8      | Ongoing   | **P2**   |
| 16  | No vendor monitoring program    | CC9      | Ongoing   | **P2**   |
| 17  | No DSAR process                 | P1       | 2 weeks   | **P2**   |

---

## 6. Remediation Roadmap

### Phase 1: Foundation (Weeks 1-4) — Critical Policies

**Week 1-2: Core Policies**

- [ ] Information Security Policy (CC1)
- [ ] Access Control Policy (CC6)
- [ ] Incident Response Plan (CC7)
- [ ] Change Management Policy (CC8)

**Week 3-4: Operational Controls**

- [ ] Access request/approval workflow (CC6)
- [ ] Quarterly access review process (CC6)
- [ ] Deficiency tracking system (CC4)
- [ ] Post-incident review process (CC7)

### Phase 2: Data & Privacy (Weeks 5-8)

**Week 5-6: Data Management**

- [ ] Data Classification Policy (C1, P1)
- [ ] Data Retention Schedule (P1)
- [ ] Data Disposal Policy (C1, P1)

**Week 7-8: Privacy**

- [ ] Privacy Policy / Notice (P1)
- [ ] Consent Management Framework (P1)
- [ ] DSAR Process (P1)

### Phase 3: Vendor & Monitoring (Weeks 9-12)

**Week 9-10: Vendor Risk**

- [ ] Complete VRA-3: Tier 1 vendor reviews (CC9)
- [ ] Vendor security requirements for contracts (CC9)
- [ ] Right-to-audit clauses (CC9)

**Week 11-12: Monitoring & Testing**

- [ ] Control monitoring program (CC4)
- [ ] Control testing schedule (CC4)
- [ ] First tabletop exercise (CC7)
- [ ] First quarterly access review (CC6)

### Phase 4: Audit Preparation (Weeks 13-16)

**Week 13-14: Evidence Collection**

- [ ] Create evidence repository (where to store proof of control operation)
- [ ] Define evidence requirements per control
- [ ] Collect initial evidence (policies, procedures, configurations)

**Week 15-16: Pre-Audit Review**

- [ ] Internal control self-assessment (walk through all controls)
- [ ] Engage external auditor for readiness review (optional but recommended)
- [ ] Remediate any findings from readiness review
- [ ] Schedule formal SOC2 Type I audit

---

## 7. Type I vs Type II

**Type I:** Point-in-time assessment of control design (are controls in place?)
**Type II:** Period assessment of control operating effectiveness (do controls
work over time?)

**Recommendation:**

1. **Start with Type I** after Phase 1-3 completion (Week 12)
2. **Observe for 3-6 months** to collect operating effectiveness evidence
3. **Pursue Type II** after observation period (Week 24-36)

Type I is faster and cheaper, establishes baseline. Type II is the gold standard
enterprise customers expect.

---

## 8. Cost Estimates

| Phase         | Activities                                 | Estimated Cost                                  |
| ------------- | ------------------------------------------ | ----------------------------------------------- |
| Phase 1-3     | Policy development, control implementation | Internal (8-12 weeks of engineering time)       |
| Phase 4       | Evidence collection, pre-audit review      | Internal (4 weeks) + External auditor ($10-20K) |
| Type I Audit  | External audit                             | $30-50K                                         |
| Type II Audit | External audit (after observation)         | $50-80K                                         |
| Ongoing       | Annual audits, continuous monitoring       | $30-50K/year                                    |

**Total first-year estimate:** $120-170K (including internal time)

---

## 9. Success Criteria

**Type I Readiness:**

- [ ] All P0 gaps remediated
- [ ] All P1 gaps remediated or have remediation plan
- [ ] Evidence collected for all controls
- [ ] External auditor confirms readiness

**Type II Success:**

- [ ] Zero material weaknesses
- [ ] Zero significant deficiencies
- [ ] Minor deficiencies < 10% of controls tested
- [ ] Clean opinion from auditor

---

## 10. Next Steps

1. **Immediate (This Week):**
   - Review this assessment with leadership
   - Prioritize P0 gaps
   - Assign owners to each remediation item

2. **Week 1:**
   - Begin drafting Information Security Policy
   - Begin drafting Incident Response Plan
   - Schedule weekly remediation sync

3. **Week 4:**
   - Complete Phase 1 policies
   - Begin Phase 2 (data & privacy)
   - Engage external auditor for scoping call

4. **Week 12:**
   - Complete all policy development
   - Begin evidence collection
   - Schedule Type I audit

---

## 11. References

- [SOC2 Trust Services Criteria](https://www.aicpa.org/topic/audit-assurance/audit-quality/soc-2)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Controls](https://www.iso.org/isoiec-27001-information-security.html)
- Internal: `docs/linear-audit/risk-register.md`
- Internal: `docs/linear-audit/threat-model-scope.md`
- Internal: `security-baseline.json`

---

## 12. Change Log

| Date       | Author   | Change                                                          |
| ---------- | -------- | --------------------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial gap assessment based on existing security documentation |
