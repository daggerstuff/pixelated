---
title: Access Control Procedure
description:
  Pixelated Empathy's access control procedure covering user provisioning,
  access review, role management, offboarding, and system decommissioning. SOC2
  CC6 compliance.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Access Control Procedure

**Pixelated Empathy — Logical Access Management**

Version 1.0 · Effective Date: 2026-08-01

</div>

---

## 1. Purpose

This procedure defines Pixelated Empathy's controls for managing logical access
to information systems, customer data, and PHI. It satisfies SOC2 CC6 (Logical
and Physical Access Controls) and HIPAA Security Rule §164.312(a) requirements.

This procedure applies to all workforce members, contractors, vendors, and third
parties who require access to Pixelated Empathy systems or data.

---

## 2. Access Control Principles

### 2.1 Least Privilege

All access is granted at the minimum level required to perform job functions.
Access beyond minimum privilege requires documented justification and manager
approval.

### 2.2 Need-to-Know

Access to sensitive data (PHI, customer data, security configurations) is
granted only to individuals who require the data to perform their job functions.

### 2.3 Separation of Duties

Critical operations require dual approval. No single individual may:

- Provision and approve their own access.
- Deploy code to production without peer review.
- Modify security configurations without security team approval.
- Access PHI logs without compliance team authorization.

### 2.4 Default Deny

All access is denied by default. Access must be explicitly granted through the
provisioning process (Section 4).

---

## 3. Access Levels

### 3.1 Role Definitions

| Role                   | Scope                                  | Access                                                        | Approval                               |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| **Public**             | Unauthenticated users                  | Public pages only                                             | None                                   |
| **Authenticated User** | Registered customers                   | Own tenant data, own profile                                  | Self-registration + email verification |
| **Tenant Admin**       | Customer tenant administrators         | Tenant configuration, user management within tenant           | Customer organization admin            |
| **Platform User**      | Pixelated workforce members (standard) | Non-production systems, documentation, internal tools         | Manager + IT                           |
| **Platform Admin**     | Pixelated workforce members (elevated) | Production systems, customer data (limited), configuration    | Manager + CSO                          |
| **Security Admin**     | Security team members                  | Security tools, audit logs, incident data, all systems (read) | CSO                                    |
| **Super Admin**        | CSO + designated backup                | Full system access, emergency break-glass                     | CSO + CEO                              |

### 3.2 RBAC Scopes (Application Level)

The Pixelated Empathy application enforces the following scopes:

| Scope            | Permissions                               | Granted To                     |
| ---------------- | ----------------------------------------- | ------------------------------ |
| `read`           | Read-only access to tenant data           | All authenticated users        |
| `write`          | Create, update, delete tenant data        | Tenant admins, platform admins |
| `admin`          | Full tenant management, user provisioning | Tenant admins only             |
| `platform:read`  | Read access to platform-wide data         | Platform users and above       |
| `platform:write` | Write access to platform-wide data        | Platform admins only           |
| `security:audit` | Access to audit logs and security tools   | Security admins only           |

---

## 4. Access Provisioning

### 4.1 New Workforce Member Onboarding

**Requestor**: Hiring manager. **Approver**: IT (for standard access) or CSO
(for elevated access).

**Procedure**:

1. Hiring manager submits access request via Linear (template: New Hire Access).
2. Request includes: role, required access levels, systems needed,
   justification.
3. IT reviews and approves (standard) or CSO approves (elevated).
4. IT provisions access in Auth0 (identity), GitHub (code), Linear (project
   management), and system-specific tools.
5. IT confirms provisioning and notifies hiring manager.
6. New hire completes security awareness training (Section 4 of Information
   Security Policy) before accessing production systems.
7. IT records provisioning in access log (spreadsheet or automated system).

**Timeline**: Standard access provisioned within 2 business days. Elevated
access within 5 business days (requires additional approval).

### 4.2 Access Change (Role Modification)

**Requestor**: Employee's manager. **Approver**: IT (for lateral moves) or CSO
(for privilege elevation).

**Procedure**:

1. Manager submits access change request via Linear (template: Access Change).
2. Request includes: current access, requested access, justification, effective
   date.
3. IT reviews and approves (lateral) or CSO approves (elevation).
4. IT modifies access in Auth0 and system-specific tools.
5. IT confirms modification and notifies manager.
6. IT updates access log.

**Timeline**: Lateral changes within 2 business days. Elevation within 5
business days.

### 4.3 Temporary Access

**Requestor**: Any workforce member. **Approver**: System owner + CSO.

**Procedure**:

1. Requestor submits temporary access request via Linear (template: Temporary
   Access).
2. Request includes: system, access level, justification, duration (max 30
   days).
3. System owner and CSO approve.
4. IT provisions time-limited access (auto-expiration configured).
5. IT confirms and notifies requestor.
6. Access automatically revoked at expiration.

**Timeline**: Temporary access provisioned within 1 business day.

---

## 5. Access Review

### 5.1 Quarterly Access Review

**Frequency**: Quarterly (January, April, July, October). **Owner**: Security
Engineering Lead. **Reviewer**: System owners and managers.

**Procedure**:

1. Security team generates access report from Auth0 (all users, roles, last
   login).
2. Report distributed to system owners and managers.
3. Reviewers verify each user's access is still required and appropriate.
4. Reviewers flag:
   - Users who no longer require access (termination, role change).
   - Users with excessive privileges (violation of least privilege).
   - Dormant accounts (no login in 90+ days).
   - Shared accounts (violates unique user ID requirement).
5. Security team consolidates flags and creates remediation tickets.
6. IT executes approved access modifications within 5 business days.
7. Security team verifies remediation and documents results.

**Documentation**: Quarterly access review report stored in
`docs/enterprise/access-reviews/YYYY-QN.md`.

### 5.2 Annual Privileged Access Review

**Frequency**: Annually (Q1). **Owner**: CSO. **Reviewer**: CSO + Security
Engineering Lead.

**Procedure**:

1. Generate report of all privileged accounts (Platform Admin, Security Admin,
   Super Admin).
2. CSO reviews each privileged account for:
   - Business justification.
   - Appropriate scope (no excessive privileges).
   - Recent activity (active use).
   - MFA enrollment (mandatory for all privileged accounts).
3. CSO approves, modifies, or revokes each privileged account.
4. IT executes changes within 5 business days.
5. CSO documents review and signs off.

---

## 6. Access Termination (Offboarding)

### 6.1 Voluntary Termination (Resignation)

**Trigger**: Employee submits resignation. **Owner**: HR + IT.

**Procedure**:

1. HR notifies IT of resignation and last working day.
2. IT schedules access revocation for end of last working day.
3. On last working day:
   - IT revokes Auth0 access (disable user account).
   - IT revokes GitHub access (remove from organization).
   - IT revokes Linear access (deactivate user).
   - IT revokes all other system access (cloud providers, SaaS tools).
   - IT collects company devices (laptop, phone, tokens).
   - IT verifies access revocation (attempt login to each system).
4. IT confirms revocation to HR.
5. IT updates access log (termination date, systems revoked).
6. Manager transfers any owned data/documents to successor.

**Timeline**: All access revoked within 4 hours of last working day.

### 6.2 Involuntary Termination

**Trigger**: Employee is terminated. **Owner**: HR + IT + Security.

**Procedure**:

1. HR notifies IT and Security immediately before termination meeting.
2. IT prepares access revocation (pre-staged for immediate execution).
3. At time of termination:
   - IT immediately revokes all access (Auth0, GitHub, Linear, all systems).
   - IT disables active sessions (force logout).
   - IT revokes API keys and tokens associated with the user.
   - IT collects company devices (escorted if on-site).
4. IT verifies revocation (attempt login to each system).
5. IT confirms revocation to HR and Security.
6. Security reviews terminated user's recent activity (last 30 days) for
   suspicious behavior (data exfiltration, unusual access patterns).
7. IT updates access log.

**Timeline**: All access revoked within 15 minutes of termination.

### 6.3 Contractor/Vendor Termination

**Trigger**: Contract ends or is terminated. **Owner**: Contract manager + IT.

**Procedure**:

1. Contract manager notifies IT 5 business days before contract end.
2. IT schedules access revocation for contract end date.
3. On contract end date:
   - IT revokes all access.
   - IT verifies revocation.
4. Contract manager confirms data return/deletion per vendor termination
   procedure (see vendor-inventory.md Section 17).
5. IT updates access log.

---

## 7. System Decommissioning

When a system is decommissioned:

1. **Data retention**: Identify data requiring retention (legal, regulatory,
   business). Export and archive per retention schedule.
2. **Access revocation**: Remove all user access to the system.
3. **Credential rotation**: Rotate any credentials, API keys, or certificates
   associated with the system.
4. **Data destruction**: Securely delete data not requiring retention
   (crypto-shredding for encrypted data, secure wipe for physical media).
5. **Documentation**: Update system inventory, access control lists, and
   architecture diagrams.
6. **Verification**: Confirm system is inaccessible and data is destroyed.

---

## 8. Remote Access Security

### 8.1 Remote Access Requirements

All remote access to Pixelated Empathy systems must:

- Use encrypted channels (VPN or Cloudflare Tunnel).
- Require MFA (multi-factor authentication).
- Use company-managed devices with endpoint protection.
- Connect from approved geographic regions (US, EU, allied nations).

### 8.2 Prohibited Remote Access

- Public Wi-Fi without VPN.
- Shared or public computers.
- Personal devices without endpoint protection.
- Countries on OFAC sanctions lists.

### 8.3 Privileged Remote Access

Privileged access (admin, security) from remote locations requires:

- VPN + MFA (hardware token preferred).
- Session recording (for audit).
- Just-in-time access (temporary elevation, auto-revoked).

---

## 9. Authentication Requirements

### 9.1 Password Policy

- Minimum length: 12 characters.
- Complexity: uppercase, lowercase, number, special character.
- History: cannot reuse last 12 passwords.
- Maximum age: 90 days (forced rotation).
- Lockout: 5 failed attempts → 30-minute lockout.

### 9.2 Multi-Factor Authentication (MFA)

MFA is **mandatory** for:

- All workforce members (all systems).
- Customer tenant admins.
- All privileged accounts (hardware token required).

**Accepted MFA methods**:

- Hardware security key (YubiKey, preferred for privileged accounts).
- TOTP (Google Authenticator, Authy).
- SMS (allowed but discouraged due to SIM-swap risk).

### 9.3 Session Management

- Access tokens: 15-minute lifetime, memory-only storage.
- Refresh tokens: 7-day lifetime, secure HTTP-only cookie, rotated on use.
- Idle timeout: 30 minutes (forced re-authentication).
- Concurrent sessions: limited to 3 per user.

---

## 10. Monitoring and Audit

### 10.1 Access Logging

All access events are logged:

- Authentication events (login, logout, failed attempts, MFA challenges).
- Authorization events (access granted, access denied, privilege escalation).
- Administrative actions (user creation, role changes, access revocation).
- Data access (PHI access, bulk data export, configuration changes).

Logs are retained for 6 years (HIPAA requirement) and stored in tamper-evident
storage (append-only, integrity-verified).

### 10.2 Anomaly Detection

Automated monitoring detects:

- Impossible travel (login from two distant locations in short time).
- Brute force attempts (multiple failed logins).
- Unusual access patterns (accessing data outside normal scope).
- Privilege escalation attempts.
- Access from unusual locations or devices.

Anomalies trigger P2/P3 security incidents per the Incident Response Plan.

---

## 11. Related Documents

- [Information Security Policy](./information-security-policy.md)
- [Incident Response Plan](./incident-response-plan.md)
- [Security Architecture](../../compliance/security.mdx)
- [Vendor Risk Register](../../linear-audit/vendor-register.md)
- [HIPAA Compliance](../../compliance/hipaa.mdx)

---

## 12. Change Log

| Date       | Author   | Change                                                              |
| ---------- | -------- | ------------------------------------------------------------------- |
| 2026-08-01 | Sisyphus | Initial access control procedure for SOC2 CC6 compliance (PIX-4156) |

---

_Document owner: Chief Security Officer_ _Review cadence: Annual (or after any
access-related incident)_ _Next review: 2027-08-01_
