# Penetration Testing & Security Assessment

**Document:** SEC-1 | **Issue:**
[PIX-4126](https://linear.app/pixelated/issue/PIX-4126) **Owner:** Security &
Infrastructure **Last Updated:** 2026-07-30 **Status:** Draft (internal team
execution)

---

## 1. Objective

Establish a recurring security assessment program run by the internal team that
satisfies enterprise customer security requirements, uncovers exploitable
vulnerabilities in production systems, and feeds remediation into the
engineering backlog — without the cost and timeline overhead of a third-party
vendor engagement.

---

## 2. Why This Exists

Enterprise customers require security attestations as a contractual
prerequisite. Without regular pentesting:

- Enterprise sales are blocked at the security questionnaire stage
- SOC 2 / ISO 27001 audits flag "no security testing" as a deficiency
- The platform's PHI risk profile is not independently validated
- Vulnerabilities go undiscovered until they become incidents

An internal team can run these assessments faster, cheaper, and more frequently
than a vendor — the team knows the architecture, has access to source code, and
can iterate on findings without waiting for a vendor report cycle.

---

## 3. Test Scope

### 3.1 In-Scope Assets

| Asset                    | Type              | Notes                                      |
| ------------------------ | ----------------- | ------------------------------------------ |
| `app.pixelated.com`      | Web application   | Marketing site, auth flow, dashboard       |
| `api.pixelated.com`      | REST API          | All `/api/*` endpoints                     |
| `ws.pixelated.com`       | WebSocket service | Therapy chat real-time                     |
| Therapy Session Storage  | Database          | PostgreSQL (anonymized schema for testing) |
| Auth Service             | API               | JWT, OAuth, session management             |
| Admin Dashboard          | Web               | `/admin/*` routes                          |
| Infra (cloud account)    | Cloud             | Network segmentation, IAM, S3 buckets      |
| CI/CD Pipeline           | Build             | Pipeline access, secrets handling          |
| Kubernetes manifests     | Runtime           | RBAC, pod security, network policies       |
| Open-source dependencies | Supply chain      | SCA via Dependabot, pip-audit, npm audit   |

### 3.2 Out-of-Scope (Internal)

| Asset               | Reason                                                      |
| ------------------- | ----------------------------------------------------------- |
| DoS / DDoS testing  | Risk to production; use staging only with explicit approval |
| Production PHI data | Tests use synthetic/anonymized data only                    |
| Employee endpoints  | Covered by MDM program                                      |

### 3.3 Test Environments

| Environment       | Use                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Staging**       | Primary test target (mimics production, no PHI)                                                              |
| **Production**    | Limited: auth flows, API surface, public endpoints — read-only where possible, with explicit approval window |
| **Local/Sandbox** | Source code review, SAST, SCA, container scanning — no network access needed                                 |

---

## 4. Methodology

### 4.1 Test Types

| Type             | Description                                                           | Frequency                                  |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| **Black-box**    | No internal knowledge; external attacker perspective against staging  | Quarterly                                  |
| **Gray-box**     | Authenticated user; insider/compromised account simulation            | Quarterly                                  |
| **White-box**    | Full source code review + dynamic testing                             | Monthly (automated) + per-release (manual) |
| **Targeted**     | Specific feature post-launch (new auth, new payment, new data export) | Per release                                |
| **Supply chain** | Dependency scanning, SBOM analysis, license audit                     | Weekly + per PR                            |

### 4.2 Frameworks

Tests follow:

- **OWASP Top 10** (web application risks)
- **OWASP API Security Top 10** (API-specific risks)
- **NIST SP 800-115** (Technical Guide to Information Security Testing)
- **PTES** (Penetration Testing Execution Standard)
- **MITRE ATT&CK** (adversary tactics for red team scenarios)

### 4.3 Standard Test Categories

Each assessment covers:

- Reconnaissance (DNS, subdomain enumeration, tech fingerprinting)
- Authentication and authorization testing
- Session management (JWT, OAuth, cookie handling)
- Input validation (SQLi, XSS, command injection, SSRF, XXE)
- API security (BOLA, mass assignment, rate limiting, IDOR)
- Cryptographic implementation review
- Business logic flaws
- Error handling and information disclosure
- Cloud config review (IAM, S3, security groups, RBAC)
- Container/k8s security (pod policies, secrets, network policies)
- CI/CD pipeline (secrets exposure, race conditions, artifact integrity)
- Dependency / supply chain (SCA, known CVEs, license compliance)

---

## 5. Internal Toolchain

### 5.1 Tools (Open Source)

| Category         | Tool                                                           | Purpose                                                    |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| **Recon**        | `subfinder`, `amass`, `nmap`                                   | Subdomain discovery, port scanning, service fingerprinting |
| **Web scanning** | `nuclei`, `nikto`, `arachni`                                   | Automated vulnerability scanning of web apps               |
| **API testing**  | `burpsuite community`, `ffuf`, `kiterunner`                    | API fuzzing, parameter discovery, auth testing             |
| **SQLi/XSS**     | `sqlmap`, `XSStrike`                                           | Automated injection testing                                |
| **SAST**         | `semgrep`, `bandit` (Python), `eslint-plugin-security` (TS/JS) | Static analysis on source code                             |
| **SCA**          | `dependabot`, `pip-audit`, `npm audit`, `osv-scanner`          | Dependency vulnerability scanning                          |
| **Container**    | `trivy`, `grype`, `docker-bench-security`                      | Container image + Docker daemon security                   |
| **k8s**          | `kube-bench`, `kube-hunter`                                    | Kubernetes CIS benchmark + attack simulation               |
| **Cloud**        | `prowler` (AWS), `gcp-scanner` (GCP), `scoutsuite`             | Cloud config audit                                         |
| **Source code**  | `gitleaks`, `trufflehog`                                       | Secret scanning in git history                             |
| **Fuzzing**      | `radamsa`, `afl++`                                             | Fuzz testing for input parsers                             |

### 5.2 What You Need From The Team

- 1 engineer with security interest (or the security lead) owns each quarterly
  assessment
- Time allocation: 2–3 days of focused testing per quarterly cycle
- Monthly automated scans (SAST + SCA + container + cloud) run from CI — no
  manual effort

---

## 6. Execution Playbook

### 6.1 Pre-Assessment (Day 0)

1. Create a `SEC-ASSESS-YYYY-QN` Linear epic under PIX-4126
2. Confirm staging environment is clean and available
3. Generate synthetic test data (no PHI) in staging
4. Create synthetic test accounts with various role levels (patient, clinician,
   admin)
5. Document the known architecture for the tester (API routes, auth flows, data
   schema)

### 6.2 Active Testing (Days 1–3)

| Day       | Focus                                    | Tools                                        | Output                    |
| --------- | ---------------------------------------- | -------------------------------------------- | ------------------------- |
| **Day 1** | Recon + auth + API surface               | `nmap`, `nuclei`, `burpsuite`, `ffuf`        | Findings log, screenshots |
| **Day 2** | Injection + logic + cloud/infra          | `sqlmap`, `nuclei`, `prowler`, `kube-hunter` | Findings log, PoC scripts |
| **Day 3** | Source code review + SAST/SCA + write-up | `semgrep`, `trivy`, `gitleaks`               | Findings report draft     |

### 6.3 Findings Report (Day 4)

1. Document each finding with: title, severity, description, reproduction steps,
   affected asset, recommended fix
2. Open Linear tickets for each Critical/High/Medium finding: `SEC-FIND-NNN`,
   severity label, linked to PIX-4126
3. Publish findings report to
   `docs/runbooks/security-assessments/YYYY-QN-findings.md`

### 6.4 Remediation + Retest (Days 5–30)

1. Engineering owners fix findings per severity SLA (Section 7)
2. Tester re-tests each fix in staging
3. Close Linear tickets when fix is deployed + retested

---

## 7. Finding Severity & Remediation SLA

| Severity     | CVSS Score | Examples                                                         | Remediation SLA |
| ------------ | ---------- | ---------------------------------------------------------------- | --------------- |
| **Critical** | 9.0–10.0   | Unauthenticated RCE, PHI exfiltration, full auth bypass          | **7 days**      |
| **High**     | 7.0–8.9    | Authenticated RCE, sensitive data exposure, privilege escalation | **30 days**     |
| **Medium**   | 4.0–6.9    | Stored XSS, SSRF (limited), IDOR on non-sensitive data           | **90 days**     |
| **Low**      | 0.1–3.9    | Reflected XSS, verbose errors, missing headers                   | **180 days**    |
| **Info**     | N/A        | Best-practice recommendations, hardening suggestions             | Next quarter    |

**Critical/High findings require sign-off from the engineering lead before
closure** (not an external vendor — internal accountability).

---

## 8. Recurring Test Cadence

| Test Type                           | Frequency                           | Trigger                            | Effort        |
| ----------------------------------- | ----------------------------------- | ---------------------------------- | ------------- |
| Full assessment (gray-box, staging) | **Quarterly**                       | Calendar (Q1, Q2, Q3, Q4)          | 3 days        |
| Targeted test (per release)         | **Per major release**               | New auth/payment/export feature    | 1 day         |
| SAST + SCA scan                     | **Weekly + per PR**                 | Automated from CI                  | 0 (automated) |
| Cloud config audit                  | **Monthly**                         | Automated (`prowler`/`scoutsuite`) | 0 (automated) |
| Container + k8s scan                | **Monthly**                         | Automated (`trivy` + `kube-bench`) | 0 (automated) |
| Secret scanning                     | **Per PR + quarterly full history** | `gitleaks` in CI                   | 0 (automated) |
| Red team simulation                 | **Optional, annual**                | Post-incident or pre-funding       | 5 days        |

### Annual Calendar

| Quarter      | Activity                                                                     |
| ------------ | ---------------------------------------------------------------------------- |
| Q1 (Jan–Mar) | Full assessment + cloud/k8s audit + annual scope review                      |
| Q2 (Apr–Jun) | Full assessment + targeted test of any new features shipped Q1               |
| Q3 (Jul–Sep) | Full assessment + SAST/SCA pipeline review + secret scan of full git history |
| Q4 (Oct–Dec) | Full assessment + annual report compilation + enterprise attestation         |

### Enterprise Attestation

For enterprise customers who require a third-party security attestation:

- Compile the year's internal findings + remediation into a summary report
- Consider a one-time **lightweight external review** ($5K–$15K from a boutique
  firm) to co-sign the internal findings if a customer contractually requires an
  independent signature
- This is a fraction of the $30K–$80K vendor pentest cost, and only needed when
  a customer contract explicitly demands it

---

## 9. Risk Register Integration

Findings are added to the Security Risk Register (companion to
[vendor-risk-assessment.md](vendor-risk-assessment.md)).

Current gap entries (added this session):

| Risk                                   | Impact   | Likelihood | Mitigation                                                                                                  |
| -------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| No external pentest coverage           | Critical | High       | Quarterly internal assessment per this document; lightweight external review only if contractually required |
| No independent PHI security assessment | Critical | Medium     | Internal white-box testing covers PHI-adjacent code paths; annual review of crypto implementation           |

---

## 10. Internal vs External — When to Escalate

| Situation                                                       | Internal                               | External (cheap review only)              |
| --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| Routine quarterly assessment                                    | Yes                                    | No                                        |
| New feature security review                                     | Yes                                    | No                                        |
| Customer asks "do you pentest?"                                 | Yes (attestation from internal report) | No                                        |
| Customer contract requires "independent third-party assessment" | No — internal doesn't satisfy          | Yes — $5K–$15K lightweight co-sign        |
| Post-breach forensic review                                     | No                                     | Yes — specialized firm                    |
| Regulatory audit (SOC 2, HIPAA)                                 | Internal testing feeds the audit       | Auditor signs off on internal methodology |

**Default: internal. External only when a customer contract or regulatory body
explicitly requires an independent signature.**

---

## 11. References

- [vendor-risk-assessment.md](vendor-risk-assessment.md) — third-party
  dependency inventory (PIX-4151)
- [disaster-recovery.md](disaster-recovery.md) — DR runbook (PIX-4132)
- [service-level-objectives.md](service-level-objectives.md) — SLOs (PIX-4144)
- [OWASP Testing Guide v4](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST SP 800-115](https://csrc.nist.gov/publications/detail/sp/800-115/final)
- [PTES Standard](http://www.pentest-standard.org/)
- [MITRE ATT&CK](https://attack.mitre.org/)
