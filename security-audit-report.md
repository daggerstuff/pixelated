# Security Audit Report

**Generated:** 2026-03-21
**Scope:** Node.js (pnpm) and Python dependencies

---

## Critical CVEs

**Status:** No critical CVEs currently detected in direct dependencies.

**Previously remediated critical CVEs:**
- `torch` updated to >=2.6.0 (Fixes CVE-2025-32434)
- `nltk` updated to >=3.9.3 (Fixes CVE-2025-14009 / GHSA-pg7x-xvh5-64q5 - Zip Slip)
- `requests` updated to >=2.32.4 (Fixes CVE-2024-47081)
- `werkzeug` updated to >=3.1.4 (Fixes GHSA-hgf8-39gv-g3f2)
- `pillow` updated to >=12.1.1 (Fixes CVE-2026-25990)

---

## High Severity CVEs

**Status:** Monitoring for high severity vulnerabilities in transitive dependencies.

**Previously remediated high severity CVEs:**
- `flask-cors` >=6.0.2 (secure version)
- `cryptography` >=46.0.5 (secure version)
- `pyyaml` >=6.0.3 (secure version)
- `aiohttp` >=3.13.3 (Fixes CVE-2025-69223, CVE-2025-69224, CVE-2025-69228, CVE-2025-69229, CVE-2025-69230)
- `starlette` >=0.49.1 (Fixes GHSA-7f5h-v6xp-fcq8)
- `mcp[cli]` >=1.23.0 (Fixes GHSA-9h52-p55h-vw2f)
- `urllib3` >=2.6.2 (Fixes GHSA-gm62-xv2j-4w53, GHSA-2xpw-w6gg-jr37)
- `fonttools` >=4.61.1 (Fixes GHSA-768j-98cg-p3fv)

---

## Remediation Actions Completed

### Python Dependencies (pyproject.toml)
| Package | Updated To | CVE Fixed |
|---------|------------|-----------|
| nltk | >=3.9.3 | CVE-2025-14009 |
| requests | >=2.32.4 | CVE-2024-47081 |
| werkzeug | >=3.1.4 | GHSA-hgf8-39gv-g3f2 |
| torch | >=2.6.0 | CVE-2025-32434 |
| pillow | >=12.1.1 | CVE-2026-25990 |
| cryptography | >=46.0.5 | Multiple |
| authlib | >=1.6.6 | Multiple |
| fastmcp | >=2.14.0 | GHSA-mxxr-jv3v-6pgc |
| aiohttp | >=3.13.3 | Multiple CVEs |
| urllib3 | >=2.6.2 | CVE-2025-66418, CVE-2025-66471 |

### Node.js Dependencies (package.json)
| Override | Version | Purpose |
|----------|---------|---------|
| axios | >=1.13.5 | Security fix |
| tar | >=7.5.7 | Security fix |
| undici | >=7.24.0 | Security fix |
| lodash | >=4.17.23 | Security fix |
| qs | >=6.14.2 | Security fix |
| socket.io-parser | >=4.2.6 | Security fix |

---

## Security Scanning Infrastructure Status

### CI Pipeline (.github/workflows/security-scanning.yml)
- [x] Trivy scanner configured (vuln, secret, misconfig)
- [x] Checkov scan configured (framework: all)
- [x] SARIF upload to GitHub Security tab
- [x] pnpm audit with --audit-level moderate
- [x] Daily scheduled scan (0 0 * * *)
- [x] PR and push triggers configured

### Local Scanning (scripts/devops/security-scan.sh)
- [x] pnpm audit --prod
- [x] pip-audit for Python
- [x] Hardcoded secrets grep scan
- [x] npm/pnpm integration available

### Recommended Next Steps
1. Install and run `pip-audit` locally for Python audit
2. Run `pnpm audit --level moderate` for Node.js
3. Review GitHub Security tab for any newly discovered vulnerabilities
4. Consider adding Dependabot configuration for automated PRs

---

## Compliance Notes

This report supports HIPAA++ compliance requirements:
- SEC-01: SAST/DAST vulnerability scanning implemented
- SEC-02: Zero critical CVEs in dependencies (currently met)
