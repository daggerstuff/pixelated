# Penetration Testing Findings Register

> **Part of:** PIX-4143 (S9: Remediation, Reporting & Retest)  
> **Sprint:** Sprint 6 → Sprint 7 (2026-07-28 → 2026-08-25)  
> **Status:** 🟡 **Open — Populate as findings emerge from S3–S8 scans**  
> **Owner:** Security Lead

This register tracks every vulnerability discovered during the penetration
testing lifecycle — from automated scans (S3, S4) through manual deep-dives (S5,
S6, S7) and post-exploitation (S8). All findings flow through to remediation and
retest closure.

---

## 1. Finding Lifecycle

```
Discovery (S3–S8) → Triage → Register Entry → Remediation → Retest → Closure
     │                │           │               │            │         │
     │                │           │               │            │         └─ Archive for compliance
     │                │           │               │            └─ Vendor verifies fix
     │                │           │               └─ Dev team patches (SLA-tracked)
     │                │           └─ CVSS score + risk context assigned
     │                └─ Severity triage (Critical → Low)
     └─ Automated scan / Manual test / Vendor report
```

---

## 2. Remediation SLAs

| Severity        | Remediation SLA | Retest SLA            | Escalation                         |
| --------------- | --------------- | --------------------- | ---------------------------------- |
| 🔴 **Critical** | 24 hours        | 48 hours post-fix     | CISO + VP Eng notified immediately |
| 🟠 **High**     | 72 hours        | 1 week post-fix       | Security Lead escalates at 48h     |
| 🟡 **Medium**   | 2 weeks         | 2 weeks post-fix      | Sprint boundary review             |
| 🔵 **Low**      | 1 month         | Next scheduled retest | Quarterly review                   |
| ⚪ **Info**     | Acknowledge     | Not required          | Document risk acceptance           |

---

## 3. Findings Register

> **Status:** ⬜ No findings registered yet — S4-S8 scans in progress. Entries
> auto-populate as scans complete.

### Pre-Populated Entries: Completed Scans

| ID     | Source                 | Summary                                                | Severity  | Status             |
| ------ | ---------------------- | ------------------------------------------------------ | --------- | ------------------ |
| S3-000 | S3 — Trivy FS scan     | 0 critical, 0 high vulns; 0 secrets                    | ✅ Clean  | ✅ Closed          |
| S3-001 | S3 — Trivy config scan | 0 critical, 0 high misconfigurations (9 files)         | ✅ Clean  | ✅ Closed          |
| S3-002 | S3 — pnpm audit        | 0 critical, 0 high dependency vulns                    | ✅ Clean  | ✅ Closed          |
| S3-003 | S3 — Prowler           | Bedrock model invocation logging DISABLED (17 regions) | 🟠 High   | 🔵 Fix in Progress |
| S3-004 | S3 — Prowler           | IAM privilege escalation (`iam:PutRolePolicy`)         | 🟠 High   | 🟡 Triaged         |
| S3-005 | S3 — Prowler           | CloudWatch log retention < 365 days (8 groups)         | 🟡 Medium | 🟡 Triaged         |

Full details: [s3-scan-results.md](./s3-scan-results.md)

### Watchlist: Known Attack Surface (from STRIDE Threat Model)

These are **confirmed test targets** from the threat model — not
vulnerabilities. Findings will be entered here when S4–S8 complete.

| Threat ID | Attack Vector                           | Source              | Expected Testing Window       | Status              |
| --------- | --------------------------------------- | ------------------- | ----------------------------- | ------------------- |
| PT-1      | Cross-tenant data access (IDOR/BOLA)    | Threat Model I2, E1 | S5 — Auth & Authorization     | ⏳ Awaiting testing |
| PT-2      | JWT authentication bypass               | Threat Model S1, E2 | S5 — Auth & AuthZ             | ⏳ Awaiting testing |
| PT-3      | S3 bucket misconfiguration              | Threat Model T1, I3 | S4 — App & API Scanning       | ⏳ Awaiting testing |
| PT-4      | SQL injection in API endpoints          | Threat Model T2, I1 | S6 — Injection & Validation   | ⏳ Awaiting testing |
| PT-5      | API key exposure in logs/responses      | Threat Model S2, I5 | S4 — App & API Scanning       | ⏳ Awaiting testing |
| PT-6      | AI model prompt injection               | Threat Model I1, T2 | S7 — Business Logic           | 🔴 See INJ-001      |
| PT-7      | Horizontal privilege escalation via API | Threat Model E1     | S5 — Auth & AuthZ             | ⏳ Awaiting testing |
| PT-8      | Session fixation / hijacking            | Threat Model S3     | S5 — Auth & AuthZ             | ⏳ Awaiting testing |
| PT-9      | Rate limiting bypass                    | Threat Model D2, D3 | S4 — App & API Scanning       | ⏳ Awaiting testing |
| PT-10     | Celery worker task injection            | Threat Model T2     | S8 — Post-Exploitation        | ⏳ Awaiting testing |
| PT-11     | K8s RBAC misconfiguration               | Threat Model E5     | S3 — Infrastructure (pending) | ⏳ Awaiting testing |
| PT-12     | GraphQL introspection/batching attacks  | Threat Model I1, D2 | S4 — App & API Scanning       | ⏳ Awaiting testing |
| PT-13     | OAuth/SSO misconfiguration              | Threat Model S4, R2 | S5 — Auth & AuthZ             | ⏳ Awaiting testing |
| PT-14     | CI/CD pipeline compromise               | Threat Model T5, E4 | S8 — Post-Exploitation        | ⏳ Awaiting testing |

> **Note:** Once scans complete, move entries from Watchlist →
> severity-appropriate table below with actual findings.  
> **S6 Update (2026-07-29):** INJ-001 (AI Prompt Injection) — discovered,
> validated, **fixed** via hotfix in `infer.ts`. `sanitizeConversationHistory()`
> strips client `role: system` messages. Status: ✅ Closed — Fix Deployed. All
> 12 S6 test cases resolved. See [s6-test-results.md](./s6-test-results.md).

---

### 🔴 Critical Findings

| ID      | Source (S#)               | Vulnerability                                                                                                                                 | CVSS        | Asset                                                           | Discovery Date | Status                       |
| ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | -------------- | ---------------------------- |
| INJ-001 | S6 — Code Review → Hotfix | AI Prompt Injection — user_query passes directly to model without sanitization; conversation_history accepts role:system messages from client | 🔴 Critical | POST /api/ai/pixel/infer, intervention-analysis.ts customPrompt | 2026-07-29     | ✅ **Closed — Fix Deployed** |

### 🟠 High Findings

| ID      | Source (S#)  | Vulnerability                                                           | CVSS           | Asset                                  | Discovery Date | Status             |
| ------- | ------------ | ----------------------------------------------------------------------- | -------------- | -------------------------------------- | -------------- | ------------------ |
| AWS-001 | S3 — Prowler | Bedrock Model Invocation Logging Disabled (17 regions)                  | 🟠 High (agg.) | AWS Account 638175140335               | 2026-07-29     | 🔵 Fix in Progress |
| AWS-002 | S3 — Prowler | IAM Privilege Escalation via `iam:PutRolePolicy` in GitHub Actions role | 🟠 High        | Role: pixelated-empathy-github-actions | 2026-07-29     | 🟡 Triaged         |

### 🟡 Medium Findings

| ID      | Source (S#)  | Vulnerability                                            | CVSS      | Asset                    | Discovery Date | Status     |
| ------- | ------------ | -------------------------------------------------------- | --------- | ------------------------ | -------------- | ---------- |
| AWS-003 | S3 — Prowler | CloudWatch Log Group Retention < 365 days (8 log groups) | 🟡 Medium | AWS Account 638175140335 | 2026-07-29     | 🟡 Triaged |

### 🔵 Low Findings

_No low findings registered yet._

### ⚪ Informational

_No informational observations registered yet._

---

## 4. Finding Detail Template

Use this template when adding a new finding to the register:

```markdown
### FR-001: [Vulnerability Title]

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **CVE/CWE**         |                                      |
| **CVSS Score**      |                                      |
| **Severity**        |                                      |
| **Source**          | S3 / S4 / S5 / S6 / S7 / S8 / Vendor |
| **Tool**            | Trivy / ZAP / Burp / Manual / Vendor |
| **Affected Asset**  |                                      |
| **Endpoint/Domain** |                                      |
| **Discovery Date**  |                                      |
| **Reported By**     |                                      |

#### Description

[Clear, non-technical description of the vulnerability]

#### Technical Details

[Detailed technical description, including request/response data]

#### Proof of Concept (PoC)

[Step-by-step reproduction steps or script]

#### Impact

[Business impact — what an attacker could achieve]

#### Recommended Fix

[Specific remediation guidance for engineering]

#### References

- [Link to vendor report finding]
- [Link to CVE entry]
- [Link to internal ticket (PIX-XXXX)]

#### Remediation Timeline

| Step             | Owner            | Due Date | Completed |
| ---------------- | ---------------- | -------- | --------- |
| Triage           | Security Lead    |          |           |
| Fix assigned     | Engineering Lead |          |           |
| Fix deployed     | Developer        |          |           |
| Retest requested | Security Lead    |          |           |
| Retest completed | Vendor           |          |           |
| Closure approved | Security Lead    |          |           |
```

---

---

## 6. Status Definitions

| Status                           | Meaning                                        |
| -------------------------------- | ---------------------------------------------- |
| 🟢 **Open — Not Triaged**        | Finding reported, awaiting severity assessment |
| 🟡 **Triaged — Fix in Progress** | CVSS scored, engineering team assigned         |
| 🔵 **Fix Deployed**              | Patch merged to staging/production             |
| 🟣 **Awaiting Retest**           | Vendor notified, retest window scheduled       |
| ✅ **Closed — Verified**         | Retest confirmed vulnerability remediated      |
| 📋 **Risk Accepted**             | Business decision to accept residual risk      |
| ❌ **False Positive**            | Confirmed not exploitable in this environment  |

---

## 7. Compliance Mapping Reference

| Finding Severity | SOC 2 Requirement                 | HIPAA Requirement                     | PCI DSS Requirement              | ISO 27001 Control                    |
| ---------------- | --------------------------------- | ------------------------------------- | -------------------------------- | ------------------------------------ |
| **Critical**     | CC6.1 — Immediate remediation     | §164.308(a)(1)(ii) — Risk mgmt        | Req 6.2 — Critical patch 30 days | A.12.6.1 — Timely remediation        |
| **High**         | CC7.1 — Monitoring & response     | §164.312(b) — Audit controls          | Req 6.2 — High within 60 days    | A.16.1.5 — Response to incidents     |
| **Medium**       | CC7.2 — Communication of findings | §164.308(a)(8) — Evaluation           | Req 11.4 — Next scan cycle       | A.12.6.1 — Vulnerability mgmt        |
| **Low**          | CC3.1 — Risk assessment           | §164.308(a)(1)(ii)(A) — Risk analysis | Req 11.4 — Next scan cycle       | A.8.2.1 — Information classification |

---

## 8. Retest Policy

| Finding Source           | Retest Required         | Retest Method              | SLA                          |
| ------------------------ | ----------------------- | -------------------------- | ---------------------------- |
| Vendor pentest report    | ✅ Yes                  | Full regression by vendor  | Within vendor contract scope |
| Automated scan (S3/S4)   | ✅ If severity ≥ Medium | Re-run scanner post-fix    | Before next sprint           |
| Manual deep-dive (S5–S8) | ✅ Yes                  | Targeted re-test by tester | 1 week post-fix              |
| Informational            | ❌ No                   | N/A                        | N/A                          |

---

## 9. Escalation Matrix

| Scenario                                       | Escalate To                            | Response Time   |
| ---------------------------------------------- | -------------------------------------- | --------------- |
| Critical finding — no fix available within 24h | CISO + VP Engineering                  | Immediate       |
| Finding affects PHI/exempted data              | CISO + Privacy Officer                 | Immediate       |
| Remediation SLA missed                         | Security Lead → Engineering Lead       | At SLA boundary |
| Vendor retest delayed >1 week                  | Security Lead → Vendor Account Manager | At 7 days       |
| Risk acceptance needed (Medium+)               | CISO                                   | Before closure  |

---

_Generated: 2026-07-29 | Next entry: Post-S4 automated application scanning_
