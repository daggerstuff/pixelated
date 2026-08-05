# Container Image Scanning Suppression Policy

## Overview

This document defines the process for suppressing false positives and accepting
known risks in container image vulnerability scanning results.

## Scanning Tools

| Tool                | Scope                                   | Job                      |
| ------------------- | --------------------------------------- | ------------------------ |
| Trivy (image scan)  | Base image OS + library vulnerabilities | `container-image-scan`   |
| Trivy (config scan) | Dockerfile misconfigurations + secrets  | `dockerfile-config-scan` |

## Suppression Criteria

A vulnerability may be suppressed if **ALL** of the following are true:

1. **Not exploitable**: The vulnerable package is not reachable in the container
   runtime
2. **Mitigated**: A compensating control exists (e.g., network policy, read-only
   filesystem)
3. **Documented**: The suppression includes a justification and review date
4. **Time-bounded**: Suppressions expire after 90 days unless renewed

## Suppression Process

### For Trivy Image Scan Results

1. Identify the vulnerability in the scan artifact (`container-scan-*`
   artifacts)
2. Verify the vulnerability is not exploitable in the container context
3. Add the vulnerability to the accepted risks table below
4. Create a `.trivyignore` file or use `--ignore-unfixed` flag
5. Document the suppression in the PR description

### For Trivy Config Scan Results

1. Review the SARIF results in GitHub Security tab (category:
   `trivy-dockerfile-config`)
2. For each finding, determine if the configuration is intentional
3. Add `#trivy:ignore:<rule-id>` comment to the Dockerfile line
4. Document the rationale in the accepted risks table

## Accepted Risks

| Dockerfile       | Image | CVE/Rule | Severity | Justification | Review Date | Expires |
| ---------------- | ----- | -------- | -------- | ------------- | ----------- | ------- |
| _none currently_ |       |          |          |               |             |         |

## Blocking Policy

| Severity | Action                                                    |
| -------- | --------------------------------------------------------- |
| CRITICAL | **Blocks deployment** — must fix or suppress before merge |
| HIGH     | **Blocks deployment** — must fix or suppress before merge |
| MEDIUM   | Warning — does not block, but should be reviewed          |
| LOW      | Informational only                                        |

## Review Cadence

- **Suppressions**: Reviewed quarterly (every 90 days)
- **Base images**: Reviewed monthly — check for newer image tags
- **Policy**: Reviewed annually or after any security incident

## Escalation

- CRITICAL vulnerabilities found in production images → page on-call engineer
- HIGH vulnerabilities found in production images → create Linear issue
  (priority: High)
- Any vulnerability in a PHI-handling container → notify security team
  immediately

## Related Documents

- [Vulnerability Suppression Policy](./vulnerability-suppression.md) —
  npm/Python dependency scanning
- [Security Scanning Workflow](../../workflows/security-scanning.yml) — CI
  pipeline
- [Dependabot Configuration](../../dependabot.yml) — automated dependency
  updates
