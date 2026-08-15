---
title: Penetration Testing Assessment
description: Security assessment program, pentest cadence, methodology, findings framework, and remediation tracking for the Pixelated Empathy platform
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Penetration Testing Assessment

**Enterprise Readiness Program — S1–S9**

Security assessment program covering pre-engagement, reconnaissance,
vulnerability scanning, manual deep-dive testing, post-exploitation,
remediation, and reporting for the Pixelated Empathy platform.

</div>

---

## 1. Purpose & Scope

This runbook defines the **penetration testing program** for Pixelated
Empathy, including assessment cadence, methodology, scope, findings
framework, and remediation tracking.

**Scope**: All production and staging infrastructure, web applications,
APIs, AI/ML services, and third-party integrations comprising the
Pixelated Empathy platform.

**Related documents**:

- [HIPAA Risk Analysis](../hipaa-risk-analysis.md) — threat catalog and
  risk register (pentest findings integrated here)
- [Information Security Policy](../policies/information-security-policy.md)
- [Incident Response Plan](../policies/incident-response-plan.md)
- [Vendor Security Reviews](../vendor-security-reviews.md)
- [SOC2 Readiness Gap Assessment](../soc2-readiness-gap-assessment.md)

**Parent epic**: [PIX-4126](https://linear.app/pixelated/issue/PIX-4126) —
Enterprise Gap: Penetration Testing

---

## 2. Assessment Cadence

| Assessment Type               | Frequency   | Scope                                        | Owner         |
| ----------------------------- | ----------- | -------------------------------------------- | ------------- |
| **External penetration test** | Quarterly   | Public-facing services (Caddy, App, API)     | Security Lead |
| **Internal penetration test** | Semi-annual | Internal network, services, trust boundaries | Security Lead |
| **Application security test** | Quarterly   | Web app, API, AI engine                      | Security Lead |
| **Adversary emulation**       | Annual      | Full Red Team exercise                       | External firm |

### 2.1 Scheduled Assessments

| Quarter | Assessment             | Target Date | Status    | Ticket   |
| ------- | ---------------------- | ----------- | --------- | -------- |
| Q4 2026 | First external pentest | 2026-11-01  | Scheduled | PIX-4136 |
| Q1 2027 | Application security   | 2027-02-01  | Planned   | —        |
| Q2 2027 | Internal pentest       | 2027-05-01  | Planned   | —        |
| Q3 2027 | Adversary emulation    | 2027-08-01  | Planned   | —        |

---

## 3. Assessment Phases

### Phase 1 — Pre-Engagement (S1)

| Step | Description                          | Deliverable          |
| ---- | ------------------------------------ | -------------------- |
| 1.1  | Define scope and rules of engagement | Engagement letter    |
| 1.2  | Identify in-scope assets             | Asset list           |
| 1.3  | Obtain authorization sign-off        | Signed authorization |
| 1.4  | Define communication channels        | Contact list         |
| 1.5  | Schedule testing window              | Calendar invite      |

**Authorization**: VP Engineering must sign the engagement letter before
testing begins. Testing without signed authorization is prohibited.

### Phase 2 — Reconnaissance & Threat Modeling (S2)

| Step | Description              | Tool/Method            |
| ---- | ------------------------ | ---------------------- |
| 2.1  | DNS enumeration          | `amass`, `subfinder`   |
| 2.2  | Port scanning            | `nmap`                 |
| 2.3  | Service fingerprinting   | `nmap -sV`, `whatweb`  |
| 2.4  | TLS configuration review | `testssl.sh`, `sslyze` |
| 2.5  | Threat modeling          | STRIDE per service     |

### Phase 3 — Automated Vulnerability Scanning (S3)

| Scan Type       | Tool                                  | Target                  | Cadence        |
| --------------- | ------------------------------------- | ----------------------- | -------------- |
| Dependency scan | `pnpm audit`, `pip-audit`, Dependabot | All repos               | Weekly (CI)    |
| Container scan  | Trivy                                 | Docker images           | Per build (CI) |
| SAST            | CodeQL, Semgrep                       | Source code             | Per PR (CI)    |
| DAST            | OWASP ZAP                             | Staging endpoints       | Weekly         |
| IaC scan        | Checkov, tfsec                        | Terraform/K8s manifests | Per PR (CI)    |

**CI integration**: Automated scans run in `.github/workflows/security-scanning.yml`
and `.github/workflows/codeql.yml`. Results are published to GitHub Security tab
and must be triaged within 5 business days.

### Phase 4 — Manual Deep-Dive (S4–S6)

#### S4: Authentication Testing

- Session management (cookie security, JWT validation, expiry)
- Password policy enforcement
- Multi-factor authentication bypass attempts
- OAuth/OIDC flow validation
- Privilege escalation (horizontal & vertical)
- Account enumeration and lockout

#### S5: Injection Testing

- SQL injection (all input vectors, including API params)
- NoSQL injection (MongoDB query injection)
- Command injection (SSRF, OS command injection)
- XSS (stored, reflected, DOM-based)
- Template injection (SSTI)
- File upload bypass
- XXE injection
- SSRF via AI model endpoints

#### S6: Business Logic Testing

- Rate limiting / abuse scenarios
- API authorization matrix (IDOR testing)
- Data exposure (excessive fields in API responses)
- Race conditions (TOCTOU)
- Workflow bypass (skipping required steps)
- HIPAA-specific: PHI access logging verification
- AI-specific: prompt injection, model extraction, training data leakage

### Phase 7 — Post-Exploitation (S8)

- Lateral movement assessment
- Persistence mechanisms
- Data exfiltration paths (especially PHI)
- Impact analysis (what could a real attacker achieve?)
- Evidence collection and documentation
- Cleanup and restore systems to pre-test state

### Phase 8 — Remediation, Reporting & Retest (S9)

See §4 and §5 below.

---

## 4. Findings Framework

### 4.1 Severity Classification

| Severity          | CVSS Range | Description                                     | Remediation SLA |
| ----------------- | ---------- | ----------------------------------------------- | --------------- |
| **Critical**      | 9.0–10.0   | Immediate risk to PHI or platform availability  | 7 days          |
| **High**          | 7.0–8.9    | Significant risk requiring prompt action        | 14 days         |
| **Medium**        | 4.0–6.9    | Moderate risk, address in normal sprint cycle   | 30 days         |
| **Low**           | 0.1–3.9    | Minor risk, track and address opportunistically | 90 days         |
| **Informational** | 0.0        | No direct risk, improve security posture        | Best effort     |

### 4.2 Risk Register Integration

All pentest findings are recorded in the HIPAA Risk Analysis threat
catalog (`docs/reference/enterprise/hipaa-risk-analysis.md`) with a
unique finding ID (format: `PT-YYYY-NNN`). Each finding links to:

- **Linear ticket** — for tracking remediation work
- **GitHub PR** — for code fixes
- **Vulnerability scan** — for regression testing

### 4.3 Finding Report Template

```markdown
### PT-2026-001: [Finding Title]

| Field                  | Value                                      |
| ---------------------- | ------------------------------------------ |
| **ID**                 | PT-2026-001                                |
| **Severity**           | Critical                                   |
| **CVSS**               | 9.1                                        |
| **Category**           | Injection                                  |
| **Affected Component** | /api/v1/sessions (POST)                    |
| **Description**        | [Detailed description]                     |
| **Reproduction Steps** | [Step-by-step]                             |
| **Proof of Concept**   | [Payload/screenshot]                       |
| **Remediation**        | [Fix description]                          |
| **Remediation Owner**  | [Engineer]                                 |
| **Remediation Due**    | [Date]                                     |
| **Status**             | Open / In Progress / Remediated / Retested |
| **Linear Ticket**      | [PIX-XXXX]                                 |
```

---

## 5. Remediation Process

1. **Triage** (1 business day): Security Lead reviews finding, assigns
   severity, creates Linear ticket
2. **Assign** (2 business days): Engineering assigns remediation owner
3. **Fix** (per severity SLA): Engineer implements fix, creates PR
4. **Review** (2 business days): Security Lead reviews PR, verifies fix
5. **Deploy**: Fix merged and deployed to staging
6. **Retest** (5 business days): Security Lead retests to confirm fix
7. **Close**: Finding marked "Remediated" in risk register, ticket closed

### 5.1 Metrics

| Metric                                       | Target    | Measurement |
| -------------------------------------------- | --------- | ----------- |
| Mean time to remediate (Critical)            | ≤ 7 days  | PT findings |
| Mean time to remediate (High)                | ≤ 14 days | PT findings |
| % findings remediated before next assessment | ≥ 90%     | Per cycle   |
| Retest pass rate                             | 100%      | Per finding |

---

## 6. Tooling

| Tool              | Purpose                      | License       |
| ----------------- | ---------------------------- | ------------- |
| OWASP ZAP         | DAST scanning                | Open source   |
| Trivy             | Container/IaC scanning       | Open source   |
| CodeQL            | SAST                         | GitHub-native |
| Semgrep           | SAST + policy enforcement    | Open source   |
| Checkov           | IaC scanning                 | Open source   |
| `pnpm audit`      | JS dependency scanning       | Built-in      |
| `pip-audit`       | Python dependency scanning   | Open source   |
| GitHub Dependabot | Dependency update automation | GitHub-native |
| `nmap`            | Network scanning             | Open source   |
| `testssl.sh`      | TLS configuration testing    | Open source   |

---

## 7. References

- **Linear**: [PIX-4126](https://linear.app/pixelated/issue/PIX-4126) —
  Enterprise Gap: Penetration Testing
- **Linear**: [PIX-4135](https://linear.app/pixelated/issue/PIX-4135) —
  S1: Pre-Engagement
- **Linear**: [PIX-4136](https://linear.app/pixelated/issue/PIX-4136) —
  S2: Reconnaissance & Threat Modeling
- **OWASP Testing Guide v4.2**: https://owasp.org/www-project-web-security-testing-guide/
- **NIST SP 800-115**: Technical Guide to Information Security Testing
- **PCI DSS 4.0** §11.4: Penetration testing requirements

---

_Document maintained by: Security Lead_
_Last updated: 2026-08-05_
_Review cadence: Quarterly (after each assessment)_
