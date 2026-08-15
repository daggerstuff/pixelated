---
title: Incident Response Plan
description:
  Pixelated Empathy's incident response plan covering detection, containment,
  eradication, recovery, notification, and post-incident review. SOC2 CC7 and
  HIPAA Breach Notification Rule compliance.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Incident Response Plan

**Pixelated Empathy — Security Incident Response**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose

This plan defines Pixelated Empathy's procedures for detecting, responding to,
and recovering from security incidents. It satisfies SOC2 CC7 (System
Operations) and HIPAA Breach Notification Rule (45 CFR §164.404-414)
requirements.

This plan applies to all security incidents affecting Pixelated Empathy
information systems, customer data, or PHI.

---

## 2. Incident Severity Levels

| Severity          | Definition                                                                             | Response Time       | Notification                                            |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| **P0 — Critical** | Active PHI breach, data exfiltration, ransomware, complete service outage              | Immediate (24/7)    | CSO + Leadership + Customers (if PHI) + HHS (if breach) |
| **P1 — High**     | Confirmed unauthorized access, vulnerability exploitation, partial service degradation | 1 hour              | CSO + Security Team + affected system owner             |
| **P2 — Medium**   | Suspicious activity, potential vulnerability, minor service disruption                 | 4 hours             | Security Team + affected system owner                   |
| **P3 — Low**      | Policy violation, minor configuration issue, informational alert                       | 24 hours (business) | Security Team                                           |

---

## 3. Incident Response Team

| Role                    | Primary                   | Backup           | Responsibility                                                   |
| ----------------------- | ------------------------- | ---------------- | ---------------------------------------------------------------- |
| **Incident Commander**  | CSO (Chad)                | Engineering Lead | Overall coordination, decision authority, external communication |
| **Technical Lead**      | Security Engineering Lead | Senior Engineer  | Technical investigation, containment, eradication                |
| **Communications Lead** | CSO                       | TBD              | Customer notification, media handling, regulatory reporting      |
| **Legal Counsel**       | TBD                       | TBD              | Legal guidance, BAA obligations, breach determination            |
| **Scribe**              | Rotating                  | Rotating         | Timeline documentation, evidence preservation                    |

The Incident Commander may delegate authority but retains ultimate
responsibility for incident resolution.

---

## 4. Incident Response Phases

### Phase 1: Detection and Reporting

**Trigger**: Any workforce member, automated system, or external party
identifies a potential security incident.

**Actions**:

1. **Report immediately** via `security-incidents@pixelatedempathy.com` or Slack
   `#security-incidents` channel.
2. **Do not investigate** unless you are a member of the security team. Preserve
   evidence by not modifying the affected system.
3. **Document initial observations**: what was observed, when, affected systems,
   and any actions already taken.
4. **Security team triages** within 1 hour (P0/P1) or 4 hours (P2/P3).

**Automated Detection**:

- Sentry error monitoring (anomaly detection for error spikes).
- Cloudflare WAF alerts (attack pattern detection).
- Auth0 anomaly detection (impossible travel, brute force).
- Database audit logs (unusual query patterns, bulk data access).
- Trivy/Dependabot (vulnerability discovery).
- OSSEC/host-based IDS (file integrity, unauthorized process execution).

### Phase 2: Triage and Classification

**Owner**: Security Engineering Lead (or Incident Commander for P0).

**Actions**:

1. **Confirm** whether the event is a true incident or false positive.
2. **Classify** severity (P0-P3) using the table in Section 2.
3. **Assign** Incident Commander and response team.
4. **Open** incident ticket in Linear (template: Security Incident).
5. **Activate** incident response channel (Slack `#incident-<id>`).
6. **Begin** incident timeline log (scribe records all actions and decisions).

**Breach Determination** (for incidents involving PHI):

Apply the 4-factor risk assessment per 45 CFR §164.402:

1. Nature and extent of PHI involved (types of identifiers, likelihood of
   re-identification).
2. Unauthorized person who used the PHI or to whom the disclosure was made.
3. Whether the PHI was actually acquired or viewed.
4. Extent to which the risk to the PHI has been mitigated.

If the incident constitutes a breach, activate Phase 6 (Notification).

### Phase 3: Containment

**Owner**: Technical Lead.

**Short-term containment** (immediate):

- Isolate affected systems (network segmentation, security group changes).
- Block malicious IP addresses or domains (Cloudflare WAF rules).
- Revoke compromised credentials (Auth0 user suspension, API key rotation).
- Enable enhanced logging on affected systems.
- Preserve forensic evidence (memory dumps, log snapshots, disk images).

**Long-term containment** (within 24 hours):

- Apply emergency patches or configuration changes.
- Deploy additional monitoring on affected systems.
- Implement temporary access restrictions.
- Verify containment effectiveness (confirm no further unauthorized activity).

**Communication during containment**:

- P0/P1: Incident Commander provides updates every 2 hours to leadership.
- P2: Updates every 4 hours to security team.
- P3: Daily updates until resolved.

### Phase 4: Eradication

**Owner**: Technical Lead.

**Actions**:

1. **Identify root cause** of the incident.
2. **Remove** malware, unauthorized access, or vulnerable components.
3. **Patch** exploited vulnerabilities.
4. **Harden** configurations to prevent recurrence.
5. **Verify** eradication (rescan, penetration test, log review).

**Documentation**:

- Root cause analysis (RCA) document.
- Timeline of attacker activity (if external threat).
- Systems and data affected.
- Evidence collected and preserved.

### Phase 5: Recovery

**Owner**: Technical Lead + affected system owner.

**Actions**:

1. **Restore** affected systems from clean backups (if data corruption).
2. **Rebuild** compromised systems from known-good images.
3. **Rotate** all credentials that may have been exposed.
4. **Monitor** recovered systems closely for 72 hours (enhanced logging).
5. **Verify** system integrity and functionality.
6. **Lift** containment measures only after verification.

**Customer impact**:

- If customer-facing services were affected, coordinate with Communications Lead
  on customer notification.
- Verify SLA commitments and calculate service credits if applicable.

### Phase 6: Notification (Breach Incidents Only)

**Owner**: Communications Lead + Legal Counsel.

**HIPAA Breach Notification Requirements**:

| Notification Target                        | Timeline                           | Content                                                                                 | Responsible         |
| ------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------- |
| **Individuals** (affected customers)       | 60 days from discovery             | Description of breach, types of PHI, steps individuals should take, contact information | Communications Lead |
| **HHS Secretary**                          | 60 days from discovery             | Breach report form, number of individuals affected                                      | Legal Counsel       |
| **Media** (if >500 individuals in a state) | 60 days from discovery             | Press release, prominent media outlets in affected state(s)                             | Communications Lead |
| **Business Associates** (if we are the BA) | Per BAA terms (typically 72 hours) | Notification to covered entity                                                          | CSO                 |

**Notification templates** are maintained in `docs/enterprise/templates/`.

**State breach notification laws**: Some states have additional requirements
(shorter timelines, specific content). Legal Counsel must review applicable
state laws for each breach.

### Phase 7: Post-Incident Review

**Owner**: Incident Commander.

**Timeline**: Within 14 days of incident closure.

**Actions**:

1. **Conduct** post-incident review meeting (all response team members).
2. **Document** lessons learned:
   - What went well?
   - What could be improved?
   - Were response time targets met?
   - Were communication procedures effective?
3. **Identify** remediation actions to prevent recurrence:
   - Policy updates.
   - Control enhancements.
   - Training needs.
   - Tooling improvements.
4. **Assign** remediation owners and due dates.
5. **Update** this Incident Response Plan if procedures need revision.
6. **File** post-incident report in `docs/enterprise/incident-reports/`.

**Post-incident report template**:

```markdown
# Incident Report: [INCIDENT-ID]

## Summary

- **Date**: [date]
- **Severity**: P0/P1/P2/P3
- **Duration**: [start to resolution]
- **Impact**: [systems affected, customers impacted, data exposed]

## Timeline

[chronological log of events]

## Root Cause

[technical root cause analysis]

## Response Assessment

- Detection time: [time from incident start to detection]
- Containment time: [time from detection to containment]
- Eradication time: [time from containment to eradication]
- Recovery time: [time from eradication to full recovery]

## Lessons Learned

[what went well, what needs improvement]

## Remediation Actions

| Action | Owner | Due Date | Status |
| ------ | ----- | -------- | ------ |
```

---

## 5. Incident Response Testing

### 5.1 Tabletop Exercises

- **Frequency**: Quarterly.
- **Participants**: Incident response team + relevant system owners.
- **Scenarios**: Rotate through P0 scenarios (PHI breach, ransomware, DDoS,
  insider threat, supply chain compromise).
- **Outcome**: After-action report with lessons learned and procedure updates.

### 5.2 Live Drills

- **Frequency**: Annually (or after major infrastructure changes).
- **Scope**: Simulated P1 incident with live containment actions (in staging).
- **Outcome**: Validate detection, response time, and communication procedures.

---

## 6. Evidence Preservation

All incident evidence must be preserved for a minimum of 6 years (HIPAA
requirement) or as required by legal hold.

**Evidence types**:

- Log files (system, application, network, audit).
- Memory dumps and disk images.
- Network traffic captures (PCAP).
- Screenshots and screen recordings.
- Email and communication records.
- Malware samples (quarantined).

**Chain of custody**: All evidence must be logged with collector name, date,
time, and storage location. Evidence must be stored in a secure,
access-controlled location.

---

## 7. External Coordination

### 7.1 Law Enforcement

If the incident involves criminal activity (theft, fraud, unauthorized access):

1. **Do not contact law enforcement** without Legal Counsel approval.
2. **Preserve** all evidence (do not modify affected systems beyond
   containment).
3. **Coordinate** with Legal Counsel on law enforcement engagement.
4. **Document** all law enforcement interactions.

### 7.2 Third-Party Vendors

If the incident involves a third-party vendor:

1. **Notify** the vendor per BAA or contract terms (typically 72 hours).
2. **Request** vendor incident report and remediation plan.
3. **Assess** impact on Pixelated Empathy systems and data.
4. **Document** vendor response in the incident report.

### 7.3 Cyber Insurance

If the incident may trigger cyber insurance coverage:

1. **Notify** insurance carrier within 72 hours of confirmed incident.
2. **Follow** carrier's incident response guidance.
3. **Document** all costs related to the incident (for claim purposes).

---

## 8. Related Documents

- [Information Security Policy](./information-security-policy.md)
- [Access Control Procedure](./access-control-procedure.md)
- [Disaster Recovery Plan](../runbooks/infra-disaster-recovery.md)
- [SLA Breach Response Runbook](../runbooks/sla-breach-response.md)
- [Risk Register](../../linear-audit/risk-register.md)
- [Vendor Risk Register](../../linear-audit/vendor-register.md)

---

## 9. Change Log

| Date       | Author   | Change                                                                                          |
| ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial incident response plan for SOC2 CC7 and HIPAA Breach Notification compliance (PIX-4156) |

---

_Document owner: Chief Security Officer_ _Review cadence: Annual (or after any
P0/P1 incident)_ _Next review: 2027-08-01_
