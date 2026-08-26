---
title: Control Deficiency Tracking and Escalation Procedure
description:
  Pixelated Empathy's procedure for identifying, tracking, remediating, and
  escalating control deficiencies. SOC2 CC4 compliance.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Control Deficiency Tracking and Escalation Procedure

**Pixelated Empathy — Monitoring and Deficiency Management**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose

This procedure defines how Pixelated Empathy identifies, tracks, remediates, and
escalates control deficiencies. It satisfies SOC2 CC4 (Monitoring Activities)
requirements for deficiency identification, communication, and remediation.

This procedure applies to deficiencies identified through:

- Internal control testing (quarterly assessments).
- External audits (SOC2, HIPAA, penetration tests).
- Automated monitoring (security scans, anomaly detection).
- Incident post-incident reviews.
- Workforce member reports.

---

## 2. Deficiency Classification

| Severity                   | Definition                                                                                                                            | Examples                                                                                            | Remediation SLA                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Material Weakness**      | Deficiency (or combination) that creates reasonable possibility of material misstatement or failure to prevent/detect material breach | No encryption for PHI at rest, no access controls on production database, no incident response plan | 14 days (interim mitigation) + 60 days (full remediation) |
| **Significant Deficiency** | Deficiency important enough to merit attention by those charged with governance                                                       | Incomplete access reviews, missing change approval for some changes, delayed vulnerability patching | 30 days                                                   |
| **Control Deficiency**     | Design or operation of control does not allow normal prevention/detection of errors                                                   | Missing logging on one system, documentation not updated, training completion rate below 100%       | 90 days                                                   |
| **Observation**            | Opportunity for improvement that does not rise to deficiency level                                                                    | Process could be more efficient, additional control would strengthen posture                        | Next review cycle                                         |

---

## 3. Deficiency Identification Sources

| Source                        | Frequency            | Owner                | Output                                   |
| ----------------------------- | -------------------- | -------------------- | ---------------------------------------- |
| Quarterly control testing     | Quarterly            | Compliance Lead      | Control test results report              |
| Automated security scans      | Continuous           | DevOps               | Scan reports (Trivy, Dependabot, CodeQL) |
| Penetration testing           | Annual (external)    | Security Lead        | Pen test report                          |
| Incident post-incident review | Per incident         | Incident Commander   | Post-incident report                     |
| Internal audit (if engaged)   | Annual               | Internal auditor     | Audit report                             |
| Workforce member reports      | Continuous           | Any workforce member | Security incident report or Linear issue |
| Vendor security reviews       | Quarterly (critical) | Security Lead        | Vendor review report                     |

---

## 4. Deficiency Tracking

### 4.1 Deficiency Log

All deficiencies are tracked in the **Deficiency Log** (Linear project: "Control
Deficiencies" or spreadsheet if Linear not available).

**Required fields**:

- Deficiency ID (sequential: DEF-001, DEF-002, ...).
- Date identified.
- Source (audit, scan, incident, etc.).
- Severity (Material Weakness, Significant Deficiency, Control Deficiency,
  Observation).
- Description (what control is deficient, how it was identified).
- Affected system(s) or process(es).
- Root cause (if known).
- Remediation plan (what will be done).
- Remediation owner (who is responsible).
- Target remediation date (per SLA).
- Current status (Open, In Progress, Remediated, Verified, Risk Accepted).
- Verification evidence (how remediation was confirmed).
- Escalation history (if escalated).

### 4.2 Status Workflow

```
Open → In Progress → Remediated → Verified → Closed
  ↓                     ↓
Risk Accepted       Reopened (if verification fails)
```

- **Open**: Deficiency identified, remediation not yet started.
- **In Progress**: Remediation work underway.
- **Remediated**: Fix implemented, awaiting verification.
- **Verified**: Remediation confirmed effective by independent reviewer.
- **Closed**: Deficiency resolved and verified.
- **Risk Accepted**: CSO has accepted the risk (with justification and review
  date).
- **Reopened**: Verification failed, remediation insufficient.

---

## 5. Remediation Process

### 5.1 Remediation Planning

For each deficiency, the remediation owner develops a remediation plan:

1. **Root cause analysis**: Why does the deficiency exist?
2. **Remediation options**: What can fix it? (preventive, detective, corrective
   controls)
3. **Selected approach**: Which option is most effective and feasible?
4. **Timeline**: When will remediation be complete? (must meet SLA per severity)
5. **Resources**: What is needed? (people, budget, tools)
6. **Interim controls**: What compensating controls mitigate risk until full
   remediation?

### 5.2 Remediation Implementation

Remediation owner implements the plan:

- For material weaknesses: interim controls deployed within 14 days.
- For significant deficiencies: remediation plan approved by CSO.
- For control deficiencies: remediation tracked in quarterly control testing.

### 5.3 Remediation Verification

After remediation is implemented:

1. **Independent verification**: Someone other than the remediation owner
   verifies the fix is effective.
2. **Testing**: Verify control operates as designed (test the control).
3. **Documentation**: Record verification evidence in deficiency log.
4. **Status update**: Mark deficiency as "Verified" if effective, "Reopened" if
   not.

---

## 6. Escalation Procedure

### 6.1 Escalation Triggers

| Trigger                                         | Escalate To                      | Timeline                  |
| ----------------------------------------------- | -------------------------------- | ------------------------- |
| Material weakness identified                    | CSO + Leadership                 | Immediate                 |
| Remediation SLA missed (Material Weakness)      | CSO + Leadership                 | Same day                  |
| Remediation SLA missed (Significant Deficiency) | CSO                              | Within 24 hours           |
| Remediation SLA missed (Control Deficiency)     | Compliance Lead                  | Within 48 hours           |
| Deficiency reopens after verification           | CSO + original remediation owner | Within 24 hours           |
| Risk acceptance requested                       | CSO + Leadership                 | Before acceptance         |
| External audit finding                          | CSO + Compliance Lead            | Within 24 hours of report |

### 6.2 Escalation Communication

**Material Weakness escalation includes**:

- Deficiency description and severity.
- Root cause (if known).
- Business impact (what could go wrong).
- Remediation plan and timeline.
- Interim controls (if any).
- Resources needed.

**Leadership notification**:

- Monthly deficiency summary (all open deficiencies by severity).
- Immediate notification for material weaknesses.
- Quarterly trend analysis (are deficiencies increasing or decreasing?).

### 6.3 Risk Acceptance

If remediation is not feasible or cost-prohibitive, CSO may accept the risk:

**Risk acceptance requires**:

- Written justification (why remediate vs. accept).
- Business impact assessment (what is the residual risk?).
- Compensating controls (what mitigates the risk?).
- Review date (when will this decision be revisited? max 12 months).
- CSO signature + date.
- Leadership notification (for material weaknesses).

**Risk acceptance documentation**: Stored in deficiency log + risk register.

---

## 7. Control Monitoring Program

### 7.1 Quarterly Control Testing

**Frequency**: Quarterly (January, April, July, October). **Owner**: Compliance
Lead. **Scope**: All key controls identified in SOC2 control mapping.

**Procedure**:

1. **Select sample**: For each control, select sample of operations (min 25 or
   10% of population).
2. **Test design**: Is the control designed to achieve its objective?
3. **Test operating effectiveness**: Did the control operate as designed during
   the period?
4. **Document results**: Pass / fail / partial for each control.
5. **Identify deficiencies**: Any failures are deficiencies (classify per
   Section 2).
6. **Report**: Quarterly control testing report to CSO.

**Key controls tested** (non-exhaustive):

| Control                | Test                                              | Sample                      |
| ---------------------- | ------------------------------------------------- | --------------------------- |
| Access provisioning    | Verify new hires have approved access requests    | 25 new hires                |
| Access termination     | Verify terminated users have no active access     | All terminations in quarter |
| Change management      | Verify changes have approval and testing evidence | 25 changes                  |
| Vulnerability patching | Verify critical/high vulns patched within SLA     | All vulns in quarter        |
| Backup and recovery    | Verify backups completed and restore tested       | All critical systems        |
| Incident response      | Verify incidents documented and reviewed          | All incidents in quarter    |
| Security training      | Verify training completion rate                   | All workforce members       |

### 7.2 Continuous Monitoring

Automated monitoring provides continuous control assurance:

| Control                 | Monitoring Tool                | Alert                       |
| ----------------------- | ------------------------------ | --------------------------- |
| Vulnerability detection | Trivy, Dependabot              | CI failure on HIGH/CRITICAL |
| Secret exposure         | gitleaks, Trivy secret scan    | CI failure                  |
| Access anomaly          | Auth0 anomaly detection, OSSEC | PagerDuty alert             |
| System availability     | Prometheus + Alertmanager      | PagerDuty alert             |
| Configuration drift     | Terraform plan (scheduled)     | Slack notification          |
| PHI access              | Database audit logs            | Custom alert on bulk access |

---

## 8. Reporting

### 8.1 Monthly Deficiency Summary

**Audience**: CSO. **Content**:

- Open deficiencies by severity (material weakness, significant, control).
- Deficiencies added this month.
- Deficiencies remediated this month.
- Deficiencies past SLA.
- Risk acceptances this month.

### 8.2 Quarterly Control Testing Report

**Audience**: CSO + Leadership. **Content**:

- Controls tested (count and list).
- Pass / fail / partial results.
- Deficiencies identified.
- Remediation status for prior deficiencies.
- Trend analysis (quarter-over-quarter).

### 8.3 Annual Summary

**Audience**: Board (or leadership team). **Content**:

- Annual deficiency summary (by severity, by source).
- Remediation rates (percentage remediated within SLA).
- Material weaknesses (if any).
- Risk acceptances (if any).
- Year-over-year trend.
- Recommendations for next year.

---

## 9. Related Documents

- [Information Security Policy](./information-security-policy.md)
- [Incident Response Plan](./incident-response-plan.md)
- [Change Management Policy](./change-management-policy.md)
- [Access Control Procedure](./access-control-procedure.md)
- [Risk Register](../../linear-audit/risk-register.md)
- [SOC2 Readiness Gap Assessment](../soc2-readiness-gap-assessment.md)

---

## 10. Change Log

| Date       | Author   | Change                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------ |
| 2026-08-01 | Sisyphus | Initial deficiency tracking procedure for SOC2 CC4 compliance (PIX-4156) |

---

_Document owner: Compliance Lead_ _Review cadence: Annual_ _Next review:
2027-08-01_
