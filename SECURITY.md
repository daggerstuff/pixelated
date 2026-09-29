# Pixelated Empathy Security Policy

Pixelated Empathy handles sensitive clinical data and therapeutic training
workflows. We take security seriously and welcome responsible disclosure.

---

## Reporting a Vulnerability

If you discover a security issue:

1. **Do NOT open a public issue.**
2. **Email
   [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)**
   - Subject: `Security Flaw Discovered by [Your Name]`
   - Include:
     - Detailed description of the vulnerability
     - Steps to reproduce (screenshots, logs welcome)
     - Potential impact assessment
     - Your contact info (anonymous reports accepted)
3. **PGP key available on request** for encrypted communication.

We aim to respond within **48 hours**.

---

## Supported Versions

| Version         | Supported |
| --------------- | --------- |
| `main`          | Yes       |
| `develop`       | Yes       |
| Everything else | No        |

---

## Security Principles

- **Zero Trust**: No implicit trust between services or users.
- **Least Privilege**: Minimal permissions at every layer.
- **Encryption Everywhere**: Data at rest and in transit.
- **Dependency Vigilance**: Regular audits and prompt updates.
- **OWASP Top 10**: Actively monitored and mitigated.

---

## Responsible Disclosure

When you report a vulnerability, we will:

- Acknowledge receipt within 48 hours
- Patch the issue ASAP
- Credit you in our Hall of Fame (unless you prefer anonymity)

---

## Known Security Risks & Mitigations

We transparently track risks that cannot be addressed by simple upgrades.

- **DiskCache (CVE-2025-69872)**
  - **Issue**: Uses `pickle` for serialization, unsafe for untrusted data.
  - **Status**: No official patch as of February 2026.
  - **Mitigation**: Cache directories are strictly isolated with OS-level
    permissions. No untrusted user input reaches DiskCache storage paths.

---

## Security Tools & Practices

- **Two-lane scanning**: every push runs the fast lane (`security.yml`) — the
  Security Regression Gate (required by branch protection, fails on reintroduced
  CVEs) plus npm and Python dependency audits. Heavyweight scanners (CodeQL,
  Trivy filesystem, Checkov infra/Helm, SBOM, container base images, Dockerfile
  config) run nightly and on infra-path pushes in `security-deep.yml`.
- **DAST**: OWASP ZAP baseline scans the served production build (weekly and on
  app/docker changes).
- **Local scans**: `pnpm security:scan` and `pnpm security:check` run the same
  tooling locally.
- **Secrets management**: `.env` files are gitignored; a secret scanner runs on
  every commit; cluster secrets applied from GitHub Actions secrets only.
- **Alerting**: production health probes (`scripts/ci/health-alerts.mjs`)
  classify failures CRITICAL/HIGH/WARN and route to Slack — CRITICAL pages
  `@here` and fails the run. Failed core workflows on staging automatically open
  triageable issues (Error Insight workflow).
- **Code reviews**: Every PR reviewed with security in mind.
- **HIPAA compliance**: Audit logging, encryption, and access controls enforced;
  compliance gate in CI.

---

## Contact

- **Email**:
  [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)
- **Twitter**: [@PixelEmpathy](https://twitter.com/PixelEmpathy) (DMs open for
  general inquiries, not vulnerability reports)
