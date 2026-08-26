---
title: Change Management Policy
description:
  Pixelated Empathy's change management policy covering change request, review,
  approval, implementation, and verification. SOC2 CC8 compliance.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Change Management Policy

**Pixelated Empathy — System Change Control**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose

This policy defines Pixelated Empathy's controls for managing changes to
information systems, applications, and infrastructure. It satisfies SOC2 CC8
(Change Management) and HIPAA Security Rule §164.308(a)(8) requirements.

This policy applies to all changes to production systems, including:

- Application code deployments.
- Infrastructure changes (network, servers, databases, cloud resources).
- Configuration changes (security settings, access controls, environment
  variables).
- Third-party service integrations.
- Emergency changes (see Section 6).

---

## 2. Change Categories

| Category      | Definition                                                             | Approval                                           | Examples                                                                 |
| ------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| **Standard**  | Pre-approved, low-risk, routine changes                                | Pre-approved (no per-change approval)              | Dependency updates, documentation changes, non-production config changes |
| **Normal**    | Non-routine changes requiring review and approval                      | Change Advisory Board (CAB) or designated approver | Feature deployments, infrastructure changes, security config changes     |
| **Emergency** | Changes required to resolve a P0/P1 incident or security vulnerability | Incident Commander (retroactive CAB review)        | Hotfixes, security patches, incident containment actions                 |

---

## 3. Change Request Process

### 3.1 Standard Changes

**Pre-approved** — no individual change request required.

**Requirements**:

- Change must be on the pre-approved standard change list (Section 3.4).
- Change must follow documented procedure.
- Change must be logged in change log (automated via CI/CD or manual entry).

**Standard Change List**:

| Change Type                           | Procedure                      | Frequency |
| ------------------------------------- | ------------------------------ | --------- |
| Dependency patch (non-breaking)       | Dependabot PR → CI → merge     | Automated |
| Documentation update                  | PR → review → merge            | As needed |
| Non-production config change          | PR → review → merge            | As needed |
| Monitoring alert threshold adjustment | Security team approval → apply | As needed |
| Log rotation configuration            | DevOps approval → apply        | Quarterly |

### 3.2 Normal Changes

**Requires approval** — submit change request before implementation.

**Procedure**:

1. **Request**: Submit change request via Linear (template: Change Request).
   - Description of change.
   - Reason / business justification.
   - Affected systems and components.
   - Risk assessment (low / medium / high).
   - Rollback plan.
   - Testing evidence (test results, staging validation).
   - Proposed implementation window.

2. **Review**: CAB reviews change request (or designated approver for low-risk
   changes).
   - Technical feasibility.
   - Risk to production systems.
   - Impact on customers.
   - Rollback plan adequacy.
   - Testing evidence sufficiency.

3. **Approve**: CAB approves, rejects, or requests modifications.
   - Low-risk changes: designated approver (Engineering Lead or DevOps Lead).
   - Medium-risk changes: CAB review (weekly meeting).
   - High-risk changes: CAB review + CSO approval.

4. **Implement**: Approved change implemented per plan.
   - During approved maintenance window (if required).
   - With rollback plan ready.
   - With monitoring enabled.

5. **Verify**: Post-implementation verification.
   - Confirm change applied correctly.
   - Verify no adverse effects.
   - Run smoke tests.
   - Monitor for 24 hours (high-risk) or 4 hours (medium-risk).

6. **Close**: Update change request with implementation results.
   - Actual implementation time.
   - Verification results.
   - Any issues encountered.
   - Lessons learned (if applicable).

### 3.3 Emergency Changes

**Expedited approval** — for P0/P1 incidents or critical security
vulnerabilities.

**Procedure**:

1. **Request**: Incident Commander authorizes emergency change.
   - Verbal or Slack approval (documented retroactively).
   - Minimal documentation: what, why, rollback plan.

2. **Implement**: Change implemented immediately.
   - Incident Commander oversees implementation.
   - Rollback plan ready.

3. **Verify**: Post-implementation verification.
   - Confirm incident resolved or mitigated.
   - Monitor for adverse effects.

4. **Retroactive Review**: CAB reviews emergency change within 48 hours.
   - Document in change log.
   - Assess if change should have been standard or normal.
   - Update procedures if needed.

### 3.4 Change Advisory Board (CAB)

**Members**:

- Engineering Lead (chair).
- DevOps Lead.
- Security Engineering Lead.
- Product Manager (rotating).
- CSO (for high-risk changes).

**Meetings**:

- Weekly (Tuesday 10:00 AM) for normal change review.
- Ad-hoc for emergency change retroactive review.

**Quorum**: 3 members (including Engineering Lead or Security Lead).

**Decisions**: Majority vote. Engineering Lead has tiebreaker.

---

## 4. Change Testing Requirements

| Change Risk | Testing Required                                                   | Evidence                                                 |
| ----------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| **Low**     | Unit tests pass, CI green                                          | CI pipeline results                                      |
| **Medium**  | Unit tests + integration tests + staging validation                | CI results + staging test report                         |
| **High**    | Full test suite + staging validation + load test + security review | All above + load test results + security review sign-off |

**Staging environment** must mirror production configuration (infrastructure,
data volume, network topology) to the extent practicable.

---

## 5. Deployment Controls

### 5.1 Deployment Pipeline

All production deployments must pass through the CI/CD pipeline:

1. **Code review**: PR approved by at least one reviewer (two reviewers for
   security-sensitive code).
2. **Automated tests**: Unit, integration, security scans all pass.
3. **Staging deployment**: Change deployed to staging, validated.
4. **Production deployment**: Change deployed to production via blue/green or
   canary deployment.
5. **Post-deployment verification**: Smoke tests pass, monitoring confirms no
   degradation.

### 5.2 Deployment Windows

| Change Risk | Allowed Deployment Windows                                                         |
| ----------- | ---------------------------------------------------------------------------------- |
| Low         | Any business hours (Mon-Fri 9 AM - 5 PM local)                                     |
| Medium      | Business hours with on-call engineer available                                     |
| High        | Approved maintenance window (weekend or off-peak, customer notification 48h prior) |
| Emergency   | Any time (Incident Commander authorization)                                        |

### 5.3 Rollback Procedures

Every normal and high-risk change must have a documented rollback plan:

- **Application changes**: Revert to previous version (blue/green swap or git
  revert).
- **Infrastructure changes**: Terraform state rollback or manual reversion.
- **Configuration changes**: Restore previous configuration from version
  control.
- **Database changes**: Migration rollback script or database restore from
  backup.

Rollback must be tested in staging before production deployment (for high-risk
changes).

---

## 6. Configuration Management

### 6.1 Configuration Baseline

All production system configurations are version-controlled:

- Infrastructure: Terraform modules in `infra/` directory.
- Application: Environment variables in `.env.example` (no secrets).
- Kubernetes: Helm charts in `infra/helm/`.
- Cloud resources: Infrastructure-as-code (no manual console changes).

### 6.2 Configuration Changes

All configuration changes must:

- Be submitted as PRs (version-controlled).
- Be reviewed and approved.
- Be deployed via CI/CD pipeline (no manual changes).
- Be documented in change log.

### 6.3 Secrets Management

Secrets (API keys, database credentials, encryption keys) are managed via:

- Cloud provider secret managers (AWS Secrets Manager, GCP Secret Manager).
- Kubernetes secrets (encrypted at rest, RBAC-controlled).
- No secrets in code, logs, or version control.

Secret rotation:

| Secret Type          | Rotation Frequency | Method                                |
| -------------------- | ------------------ | ------------------------------------- |
| Database credentials | 90 days            | Automated rotation via secret manager |
| API keys             | 180 days           | Manual rotation + deployment          |
| Encryption keys      | 365 days           | KMS automatic rotation                |
| Service tokens       | 90 days            | Manual rotation + deployment          |

---

## 7. Change Logging

All changes are logged in the change log (Linear issues + CI/CD audit trail).

**Required fields**:

- Change ID (Linear issue number).
- Requestor.
- Approver.
- Description.
- Risk level.
- Implementation date/time.
- Implementer.
- Verification results.
- Rollback (if executed).

**Retention**: Change logs retained for 6 years (HIPAA requirement).

---

## 8. Prohibited Changes

The following changes are prohibited without explicit CSO approval:

- Disabling security controls (encryption, logging, access controls).
- Modifying audit log configuration (retention, integrity checks).
- Granting elevated privileges without approval.
- Deploying untested code to production.
- Manual production changes (bypassing CI/CD).
- Sharing or hardcoding secrets.

---

## 9. Related Documents

- [Information Security Policy](./information-security-policy.md)
- [Access Control Procedure](./access-control-procedure.md)
- [Incident Response Plan](./incident-response-plan.md)
- [Security Architecture](../../compliance/security.mdx)
- [Risk Register](../../linear-audit/risk-register.md)

---

## 10. Change Log

| Date       | Author   | Change                                                              |
| ---------- | -------- | ------------------------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial change management policy for SOC2 CC8 compliance (PIX-4156) |

---

_Document owner: Engineering Lead_ _Review cadence: Annual (or after any
change-related incident)_ _Next review: 2027-08-01_
