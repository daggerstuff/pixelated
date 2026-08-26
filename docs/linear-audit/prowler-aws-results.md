# Prowler AWS Cloud Security Scan Results

> **Part of:** S3 — Automated Infrastructure Vulnerability Scanning  
> **Date:** 2026-07-29  
> **Tool:** Prowler v3.11.3 (via Docker)  
> **AWS Account:** 638175140335  
> **Compliance Framework:** SOC2  
> **Status:** ✅ **Complete**

---

## Executive Summary

Prowler assessed 48 AWS security checks against SOC2 compliance framework. The
AWS account scored **54% (26/48) FAIL**, indicating significant configuration
gaps primarily around Bedrock model logging and IAM privilege management.

| Metric       | Count    |
| ------------ | -------- |
| Total checks | 48       |
| ✅ Passed    | 22 (46%) |
| ❌ Failed    | 26 (54%) |
| 🔴 Critical  | 4        |
| 🟠 High      | 12       |
| 🟡 Medium    | 32       |

## Findings by Service

| Service        | Failures | Key Issues                                                        |
| -------------- | -------- | ----------------------------------------------------------------- |
| **bedrock**    | 17       | Model invocation logging disabled across all regions              |
| **cloudwatch** | 8        | Log groups without retention policy; no cross-account sharing     |
| **iam**        | 1        | Inline policy allows privilege escalation via `iam:PutRolePolicy` |

## Notable Findings

### 1. High: Bedrock Model Invocation Logging Disabled (17 regions)

**Status:** ❌ FAIL (in all 17 supported regions)  
**Severity:** Medium (per region), **High (aggregate)**

Bedrock model invocation logging is not enabled in any region. This means:

- No audit trail of model inputs/outputs
- Cannot detect prompt injection or data exfiltration
- Non-compliant with SOC2 CC7.2 (detection), CC7.3 (incident response)
- Non-compliant with HIPAA audit controls requirements

**Remediation:** Enable Bedrock model invocation logging in primary regions
(us-west-2, us-east-1, eu-west-1) with CloudWatch and S3 delivery.

### 2. High: IAM Privilege Escalation via Inline Policy (`pixelated-empathy-github-actions`)

**Status:** ❌ FAIL  
**Severity:** High  
**Resource:** Role `pixelated-empathy-github-actions` / Policy
`pixelated-empathy-github-actions-policy`

The GitHub Actions IAM role has an inline policy that allows
`iam:PutRolePolicy`, which can be used to escalate privileges by creating a new
policy with full admin access.

**Remediation:** Remove `iam:PutRolePolicy` from the inline policy. Replace with
scoped permissions for specific CI/CD actions.

### 3. Medium: CloudWatch Log Group Retention (8 log groups)

**Status:** ❌ FAIL  
**Severity:** Medium  
**Issue:** Log groups without explicit retention policy or with retention < 365
days

Without proper log retention, audit trails may be lost before compliance
requirements are met.

**Remediation:** Set all production log groups to 365-day retention (or longer
for PHI-related logs).

## Passed Controls (Notable)

| Control                                 | SOC2 Ref             | Check                     |
| --------------------------------------- | -------------------- | ------------------------- |
| No roles with `AmazonBedrockFullAccess` | CC6.3                | ✅ PASS (all roles)       |
| No admin-equivalent inline policies     | CC1.3, CC6.3         | ✅ PASS                   |
| Log groups with 365d retention          | CC7.2, CC7.3, CCC1.2 | ✅ PASS (some log groups) |
| SageMaker studio log retention          | CC7.2, CC7.3         | ✅ PASS                   |

---

## 4. Findings Register Entries

The following findings from this scan should be entered into the findings
register:

| ID      | Vulnerability                                    | Severity            | Notes                                    |
| ------- | ------------------------------------------------ | ------------------- | ---------------------------------------- |
| AWS-001 | Bedrock Model Invocation Logging Disabled        | 🟠 High (aggregate) | 17 regions affected — SOC2 CC7.2, HIPAA  |
| AWS-002 | IAM Privilege Escalation via `iam:PutRolePolicy` | 🟠 High             | Role: `pixelated-empathy-github-actions` |
| AWS-003 | CloudWatch Log Group Retention < 365 days        | 🟡 Medium           | 8 log groups affected                    |

---

## Raw Data

- Full CSV output:
  `/tmp/prowler-output/prowler-output-638175140335-20260729195219.csv`
- Full JSON output:
  `/tmp/prowler-output/prowler-output-638175140335-20260729195219.ocsf.json`
- Compliance report: `/tmp/prowler-output/compliance/`

_Generated: 2026-07-29_
