---
title: Information Security Policy
description:
  Pixelated Empathy's information security policy covering ethics, acceptable
  use, confidentiality, security governance, and workforce responsibilities.
  SOC2 CC1 compliance.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Information Security Policy

**Pixelated Empathy — Enterprise Security Governance**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose

This policy establishes Pixelated Empathy's commitment to information security,
ethical conduct, and the protection of customer data. It defines the security
governance structure, workforce responsibilities, and accountability framework
required for SOC2 Trust Services Criteria CC1 (Control Environment) and HIPAA
Security Rule §164.308(a).

This policy applies to all workforce members (employees, contractors,
consultants, and agents) and all information assets owned, processed, or managed
by Pixelated Empathy.

---

## 2. Commitment to Integrity and Ethical Values

### 2.1 Code of Conduct

All workforce members must:

- Act with honesty and integrity in all business dealings.
- Protect customer data, including PHI, with the highest standard of care.
- Comply with all applicable laws, regulations, and contractual obligations.
- Report suspected security incidents, policy violations, or unethical conduct
  immediately via `security@pixelatedempathy.com`.
- Not use Pixelated Empathy systems or data for personal gain or unauthorized
  purposes.

### 2.2 Confidentiality Obligation

All workforce members must maintain the confidentiality of:

- Customer data, including PHI, emotional analysis results, and conversation
  transcripts.
- Proprietary algorithms, model weights, and trade secrets.
- Security controls, vulnerability information, and incident details.
- Employee and contractor personal information.

Confidentiality obligations survive termination of employment or contract.

### 2.3 Acceptable Use

Pixelated Empathy information systems and assets must be used only for
legitimate business purposes. Prohibited activities include:

- Installing unauthorized software on production or development systems.
- Sharing credentials, API keys, or access tokens.
- Bypassing security controls (encryption, access restrictions, logging).
- Storing PHI on personal devices or unapproved cloud services.
- Transmitting PHI via unencrypted channels.
- Using production systems for personal experimentation without authorization.

---

## 3. Security Governance Structure

### 3.1 Roles and Responsibilities

| Role                             | Owner          | Responsibility                                                                         |
| -------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| **Chief Security Officer (CSO)** | Chad (interim) | Overall security strategy, policy approval, risk acceptance authority, board reporting |
| **HIPAA Security Officer**       | Chad (interim) | HIPAA compliance, PHI risk analysis, BAA management, breach notification               |
| **HIPAA Privacy Officer**        | Chad (interim) | Privacy policy, consent management, individual rights procedures, NPP                  |
| **Security Engineering Lead**    | Chad (interim) | Security tooling, vulnerability management, incident response, pen test coordination   |
| **Engineering Lead**             | TBD            | Secure development practices, code review standards, deployment security               |
| **Compliance Lead**              | TBD            | SOC2/HIPAA audit preparation, evidence collection, control monitoring                  |
| **All Workforce Members**        | Everyone       | Follow this policy, report incidents, complete security training                       |

### 3.2 Security Oversight

- **Monthly**: CSO reviews security metrics, open risks, and incident trends.
- **Quarterly**: CSO presents security posture report to leadership.
- **Annually**: Board (or leadership team) reviews and approves this policy,
  risk appetite, and security budget.

### 3.3 Separation of Duties

No single individual may authorize, implement, and verify the same security
control. Critical operations require dual approval:

- Production deployments: developer + reviewer (PR approval).
- Security policy changes: CSO + Engineering Lead.
- Risk acceptance: CSO + affected system owner.
- Vendor BAA execution: CSO + legal counsel.

---

## 4. Security Awareness and Training

### 4.1 Onboarding Training

All new workforce members must complete security awareness training within 14
days of start date. Training covers:

- This Information Security Policy.
- Data classification and handling requirements.
- PHI identification and protection.
- Incident reporting procedures.
- Acceptable use of information systems.
- Password management and MFA requirements.

Training completion is recorded and tracked. Access to production systems is not
granted until training is complete.

### 4.2 Annual Refresher Training

All workforce members must complete annual security refresher training. Training
covers:

- Policy updates from the prior year.
- Lessons learned from security incidents (anonymized).
- Emerging threats relevant to Pixelated Empathy.
- HIPAA and SOC2 compliance updates.
- Phishing simulation results and best practices.

### 4.3 Role-Specific Training

Workforce members with elevated access (admin, security, DevOps) must complete
additional role-specific training:

- **Administrators**: Privileged access management, least privilege, audit
  logging.
- **Security team**: Incident response procedures, forensic investigation,
  vulnerability management.
- **DevOps**: Infrastructure security, secrets management, deployment security.
- **AI/ML team**: PHI handling in model training, FHE usage, data minimization.

### 4.4 Security Communications

- **Monthly**: Security bulletin distributed to all workforce members (new
  threats, policy updates, training reminders).
- **Ad-hoc**: Security alerts for critical vulnerabilities or active threats.
- **Phishing simulations**: Quarterly phishing simulations for all workforce
  members. Results tracked and used to target additional training.

---

## 5. Security Accountability

### 5.1 Performance Metrics

Security performance is incorporated into workforce member evaluations:

- **All members**: Incident reporting timeliness, training completion, policy
  compliance.
- **Engineering**: Secure coding practices, code review security feedback,
  vulnerability remediation SLA adherence.
- **DevOps**: Patch management SLA adherence, infrastructure security posture,
  secrets rotation.
- **Security team**: Incident response time, vulnerability discovery rate, audit
  finding remediation.

### 5.2 Sanctions Policy

Violations of this policy may result in disciplinary action, up to and including
termination of employment or contract. The severity of sanctions is proportional
to the violation:

| Violation Severity | Examples                                                                     | Sanction                               |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------- |
| **Minor**          | Late training completion, minor policy deviation                             | Verbal warning + remediation plan      |
| **Moderate**       | Sharing credentials, bypassing security controls, failure to report incident | Written warning + mandatory retraining |
| **Serious**        | Unauthorized PHI access, willful policy violation, security negligence       | Suspension + formal investigation      |
| **Critical**       | Intentional data theft, malicious activity, fraud                            | Immediate termination + legal action   |

All sanctions are documented and retained for 3 years. Repeated minor violations
escalate to the next severity level.

### 5.3 Whistleblower Protection

Workforce members who report suspected violations in good faith are protected
from retaliation. Reports may be made anonymously via
`security@pixelatedempathy.com`.

---

## 6. Risk Appetite and Tolerance

### 6.1 Risk Appetite Statement

Pixelated Empathy maintains a **low risk appetite** for security risks that
could result in:

- Unauthorized access to PHI or customer data.
- Loss of data integrity affecting clinical validity.
- System unavailability impacting customer operations.
- Regulatory non-compliance (HIPAA, SOC2).

Pixelated Empathy maintains a **moderate risk appetite** for:

- Development and experimentation risks (contained in non-production
  environments).
- Innovation in security tooling and techniques.
- Acceptable vulnerability remediation timelines per the vulnerability response
  SLA.

### 6.2 Risk Tolerance Levels

| Risk Category            | Tolerance          | Escalation Trigger                      |
| ------------------------ | ------------------ | --------------------------------------- |
| Critical vulnerabilities | 48-hour patch SLA  | Auto-escalate to CSO if SLA missed      |
| High vulnerabilities     | 7-day patch SLA    | Escalate to Security Lead if SLA missed |
| PHI exposure             | Zero tolerance     | Immediate incident response activation  |
| Data loss                | Zero tolerance     | Immediate DR activation                 |
| Audit findings           | 30-day remediation | Escalate to CSO if remediation delayed  |

---

## 7. Policy Review and Updates

This policy is reviewed annually by the CSO and updated as needed. Major changes
require leadership approval. Minor clarifications may be made by the CSO with
notification to leadership.

All workforce members are notified of policy changes and must acknowledge
updated policies within 14 days.

---

## 8. Related Documents

- [Security Architecture](../../compliance/security.mdx)
- [HIPAA Compliance](../../compliance/hipaa.mdx)
- [Data Privacy](../../compliance/data-privacy.mdx)
- [Ethics Policy](../../compliance/ethics.mdx)
- [Access Control Procedure](./access-control-procedure.md)
- [Incident Response Plan](./incident-response-plan.md)
- [Change Management Policy](./change-management-policy.md)
- [Vendor Risk Register](../../linear-audit/vendor-register.md)
- [Risk Register](../../linear-audit/risk-register.md)

---

## 9. Change Log

| Date       | Author   | Change                                                    |
| ---------- | -------- | --------------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial policy created for SOC2 CC1 compliance (PIX-4156) |

---

_Document owner: Chief Security Officer_ _Review cadence: Annual_ _Next review:
2027-08-01_
