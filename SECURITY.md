# Pixelated Empathy Security Policy

Pixelated Empathy handles sensitive clinical data and therapeutic training
workflows. We take security seriously and welcome responsible disclosure.

---

## Reporting a Vulnerability

If you discover a security issue:

1. **Do NOT open a public issue.**
2. **Email [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)**
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

| Version | Supported |
|---|---|
| `main` | Yes |
| `develop` | Yes |
| Everything else | No |

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

- **Automated scans**: `pnpm security:scan` runs in CI
- **Code reviews**: Every PR reviewed with security in mind
- **Secrets management**: `.env` files are gitignored; secrets never committed
- **HIPAA compliance**: Audit logging, encryption, and access controls enforced
- **Audit logging**: All suspicious actions logged and monitored

---

## Contact

- **Email**: [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)
- **Twitter**: [@PixelEmpathy](https://twitter.com/PixelEmpathy) (DMs open for
  general inquiries, not vulnerability reports)
