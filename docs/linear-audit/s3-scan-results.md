# S3 Scan Results — Infrastructure Vulnerability Inventory

**Issue:** PIX-4137 (S3: Automated Vulnerability Scanning — Infrastructure)
**Sprint:** 6 (2026-07-28 to 2026-08-11) **Parent:** PIX-4126 **Last scan run:**
2026-07-29

---

## 1. Summary (Verified 2026-07-29)

> ⚠️ **The Sprint Notes claim of "0 critical, 0 high vulnerabilities" is
> INCORRECT for the current `pnpm-lock.yaml` and Trivy database.** This report
> supersedes those notes. Numbers below were re-captured against the working
> tree on 2026-07-29.

| Tool                             | Scope                                           | Critical |   High |       Moderate |            Low | Blocked |
| -------------------------------- | ----------------------------------------------- | -------: | -----: | -------------: | -------------: | ------- |
| Trivy filesystem (CRITICAL+HIGH) | full repo (incl. vendored `.venv`, AI services) |    **1** | **42** | (not in scope) | (not in scope) | —       |
| Trivy config (CRITICAL+HIGH)     | Dockerfile / docker-compose / IaC               |        0 |      0 | (not in scope) | (not in scope) | —       |
| pnpm audit                       | JS/TS dependencies (root lockfile)              |        0 |  **3** |          **1** |          **1** | —       |
| gitleaks (history scan)          | full git history                                |        — |      — |              — |              — | —       |

**Total actionable Critical: 1, High: 42** (Trivy fs is the authoritative count;
all 3 `pnpm audit` HIGH findings — `sharp`, `react-router`, `brace-expansion` —
are a subset of the 42 Trivy HIGH findings and already included in the root
`pnpm-lock.yaml` target scan).

**Verification (2026-07-29):** Trivy fs raw scan counted 1 CRITICAL + 42 HIGH
across 9 affected targets. `pnpm audit --json` reported 3 HIGH (`sharp`,
`react-router`, `brace-expansion`) — all 3 are also reported by Trivy against
`pnpm-lock.yaml` at the root. No double-count in the unique total.

Vendored `.venv/` is excluded from remediation scope (out-of-tree dependencies
controlled by Python packaging). See §6.

---

## 2. CRITICAL — Immediate Action

### CVE-2026-48746 — vllm (Critical authentication bypass in starlette; vLLM exposes unauthorized API access)

- **Package:** `vllm` 0.20.2rc1.dev168+gecd0b60aa.cu129
- **Fixed in:** vllm 0.22.0
- **Source:** `.venv/lib/python3.13/site-packages/art/_vllm_runtime/uv.lock`
- **Scope:** Vendored Python `.venv/` (training/serving stack only, not
  production web runtime)
- **Action:** Bump vllm to ≥0.22.0 in `ai/training` lockfiles; verify no
  production runtime path imports vllm.
- **Status:** **REMEDIATED (2026-07-30, PIX-4163).** Single pinning source was
  `.venv/lib/python3.13/site-packages/art/_vllm_runtime/pyproject.toml` line 9
  (NOT `ai/training` lockfiles — `ai/uv.lock` and `ai/pyproject.toml` do not
  reference vllm). Bumped direct wheel pin to
  `vllm>=0.24.0 ; sys_platform == 'linux'`; `uv lock --project` regenerated
  `uv.lock` and resolved vllm to **0.26.0** (PyPI), pulling **starlette 0.52.1 →
  1.3.1** — the actual auth-bypass fix package. `uv tree` confirms both packages
  present in resolved graph. The same ≥0.24.0 floor also clears the 3 HIGH CVEs
  tracked in §3.1 (CVE-2026-54234, 55514, 55574).
- **TB4 verification (2026-07-30):** vllm is only imported by
  `ai/deployment/modal_app.py` (Modal A100 eval runner) and one
  `hackathon/smoke_tests/` smoke test — neither operates in the production web
  runtime path. TB4 threat-model §6 confirmed: vllm is not reachable from
  production inbound network.
- **Trivy re-run:** Pending — trivy CLI not installed in the remediation
  sandbox. Re-run `trivy fs --severity CRITICAL,HIGH` on the
  `art/_vllm_runtime/` directory after `uv sync` lands the wheels on a runtime
  platform (x86_64 sandbox cannot install `xgrammar 0.2.4` aarch64-only
  transitive wheel — same blocker exists at 0.20.x). Static graph verification
  (vllm 0.26.0 + starlette 1.3.1 resolved from PyPI) is the available evidence
  vector in this environment.

---

## 3. HIGH (42 total — Trivy fs is authoritative)

### 3.1 By package (root JS/TS + AI services)

| Package       | High count | Fix version | Notes                                                                                                                                                                                                                                                                                                                                |
| ------------- | ---------: | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **pillow**    |         10 | 12.3.0      | Image-processing stack — multiple CVEs                                                                                                                                                                                                                                                                                               |
| **gitpython** |          5 | 3.1.55      | Tooling — verify not used in user-facing handlers                                                                                                                                                                                                                                                                                    |
| <<<<<<< HEAD  |
| **vllm**      |          4 | 0.24.0      | See §2 — **REMEDIATED (PIX-4163, 2026-07-30):** vllm bumped 0.20.2rc1 → 0.26.0 (satisfies ≥0.24.0). Clears CVE-2026-48746 (CRITICAL auth bypass via starlette) + CVE-2026-54234, 55514, 55574 (3 HIGH). starlette 0.52.1 → 1.3.1. Trivy re-run pending — CLI not in sandbox; `uv tree` shows vllm 0.26.0 + starlette 1.3.1 in graph. |
| =======       |
| **vllm**      |          4 | 0.24.0      | See §2                                                                                                                                                                                                                                                                                                                               |

> > > > > > > 9c21ef945573bf7d20a11a3f77fde29d2ada27d5 | **postcss** | 4 |
> > > > > > > 8.5.18 | Build-time only — low runtime impact | | **mcp** | 3 |
> > > > > > > 1.28.1 | AI agent context — verify scope | | **python-multipart**
> > > > > > > | 2 | 0.0.30 | Form parsing — relevant to API endpoints.
> > > > > > > **Resolution path:** downstream of `mcp>=1.28.1` bump (Tier 2);
> > > > > > > `mcp==1.27.0` is the only consumer in the vendored
> > > > > > > `_vllm_runtime/uv.lock`. All 3 production `uv.lock` files
> > > > > > > (`uv.lock`, `ai/uv.lock`, `foresight/uv.lock`) already at
> > > > > > > `python-multipart 0.0.32`. No direct `import multipart` anywhere
> > > > > > > in tracked Python source. Trivy finds `python-multipart 0.0.24`
> > > > > > > only inside the local `.venv/.../art/_vllm_runtime/uv.lock`
> > > > > > > (gitignored upstream wheel). See PIX-4160. | | **starlette** | 2 |
> > > > > > > 1.3.1 | FastAPI/uvicorn stack | | **urllib3** | 2 | 2.7.0 | HTTP
> > > > > > > client | | **brace-expansion** | 2 | 5.0.8 | Build-time glob
> > > > > > > expansion | | **pyasn1** | 2 | 0.6.4 | Crypto | | cryptography | 1
> > > > > > > | 48.0.1 | Crypto | | pyjwt | 1 | 2.13.0 | **JWT validation —
> > > > > > > directly relevant to threat model §5**. **Resolution path:**
> > > > > > > downstream of `mcp>=1.28.1` bump (Tier 2); `mcp==1.27.0` is the
> > > > > > > only consumer in the vendored `_vllm_runtime/uv.lock`. All 4
> > > > > > > production `uv.lock` files (`uv.lock`, `ai/uv.lock`,
> > > > > > > `foresight/uv.lock`,
> > > > > > > `src/lib/ai/bias-detection/python-service/uv.lock`) already at
> > > > > > > `pyjwt 2.13.0`. Trivy finds `pyjwt 2.12.1` only inside the local
> > > > > > > `.venv/.../art/_vllm_runtime/uv.lock` (gitignored upstream wheel).
> > > > > > > See PIX-4159. | | httplib2 | 1 | 0.32.0 | Python HTTP | |
> > > > > > > react-router | 1 | 8.3.0 | Frontend | | sharp | 1 | 0.35.0 | Image
> > > > > > > processing | | golang.org/x/text | 1 | 0.39.0 | Used by some
> > > > > > > tooling |

### 3.2 Prioritized remediation (S3 → S9 hand-off)

Tier 1 — fix before vendor engagement starts:

- **pyjwt 2.12.1 → 2.13.0** — JWT validation library; threat-model §7 calls this
  out as a Critical focus area (#7). Vendor will probe JWT validation.
- **python-multipart 0.0.24 → 0.0.30** — form parsing on public API
- ~~**starlette 0.52.1 → 1.3.1** — HTTP framework~~ ✅ **RESOLVED** (PIX-4161,
  2026-07-30)

Tier 2 — fix during engagement:

- **vllm (training stack)** — see §2
- **gitpython** — bump to ≥3.1.55 across all consumers
- **urllib3 / cryptography / pyasn1** — single line bumps, low risk
- **mcp** — bump to ≥1.28.1

Tier 3 — fix in next maintenance window:

- **pillow** — bulk bump to 12.3.0; coordinate with image-processing PRs
- **postcss** — build-only, schedule with next dep bump PR
- **react-router 7 → 8** — major bump, plan migration

---

## 4. pnpm audit (JS/TS deps) — CORRECTED 2026-07-29

> **Correction:** Initial Sprint Notes / S3 draft incorrectly attributed all 3
> HIGH findings to `@babel/core` transitive via `@tarquinen/opencode-dcp`.
> Actual `pnpm audit --json` output for 2026-07-29:

| Severity | Count | Package(s)                                                             | Notes                                                                                                                                                                            |
| -------- | ----: | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical |     0 | —                                                                      | —                                                                                                                                                                                |
| High     |     3 | `sharp`, `react-router`, `brace-expansion`                             | **NOT @babel/core** (see below)                                                                                                                                                  |
| Moderate |     1 | `@hono/node-server`                                                    | (CVE GHSA-1124006)                                                                                                                                                               |
| Low      |     1 | `@babel/core` (GHSA-1123528, arbitrary file read via sourceMappingURL) | Affected range ≤7.29.0; fixed in ≥7.29.1. **Remediated by PIX-4162** via `pnpm.overrides` → `@babel/core: ^7.29.7` (lockfile regenerated 2026-07-29, audit count dropped 5 → 3). |

**Original ticket PIX-4162 was based on a misread.** The `@babel/core` finding
is LOW severity, not HIGH. Re-baselined HIGH distribution:

- `sharp` 0.34.5 → 0.35.0 (CVE GHSA-1124066) — _image processing; build-time
  risk_
- `react-router` 7.18.2 → 8.3.0 (CVE GHSA-1124282) — _major bump; migration
  planning_
- `brace-expansion` 1.1.16 → 5.0.8 (CVE GHSA-1124334) — _glob expansion; already
  in `resolutions` at 5.0.6 but pin not applied — needs investigation_

**Action items per corrected findings:**

1. `@babel/core` LOW — **DONE** via PIX-4162 (`pnpm.overrides`).
2. `sharp` HIGH — bump in next maintenance window (build-time, lower runtime
   impact).
3. `react-router` HIGH — bump to v8 in S8 (major migration; plan separately).
4. `brace-expansion` HIGH — investigate why existing `resolutions: 5.0.6` pin
   did not apply; possibly stale lockfile or wrong field name.
5. `@hono/node-server` MODERATE — bump in Tier 2 remediation batch.

---

## 5. gitleaks (secret scan)

| Metric             | Count |
| ------------------ | ----: |
| Total raw findings |  2585 |
| After triage       |       |

### Triage buckets

| Bucket                                                                              | Count | Description                                                                |
| ----------------------------------------------------------------------------------- | ----: | -------------------------------------------------------------------------- |
| Export archives (exports/, .beads/, copilot-session, stats.html, oxlint, kilo-code) |  1532 | Vendor report exports / local dev artifacts — **out of remediation scope** |
| Test fixtures (`__tests__/`, `test-*.ts`, `tests/`)                                 |   357 | Synthetic test data — **verify no real secrets**                           |
| K8s / cluster backups (`cluster-backup-*`, `core/pipelines/*/k8s/`)                 |   168 | **Real cluster snapshots in git history — investigate**                    |
| Other / misc                                                                        |   313 | Manual review needed                                                       |
| Docs / markdown                                                                     |   196 | Documentation examples — verify placeholders                               |
| Infra YAML (`infra/sinker/`, `docker-compose*.yml`, `caddy/`)                       |    14 | **Real infra — must remediate**                                            |
| Real source (`src/`)                                                                |     5 | **Real source — must remediate**                                           |

### Top rule hits (full history)

| Rule                               | Count | Bucket                                        |
| ---------------------------------- | ----: | --------------------------------------------- |
| asana-client-id                    |  1174 | Mostly false-positive in Linear/issue exports |
| generic-api-key                    |  1057 | Distributed across all buckets                |
| curl-auth-header                   |   131 | Mostly docs / getting-started examples        |
| jwt                                |    68 | Test fixtures + examples                      |
| private-key                        |    59 | Test fixtures + 1 cluster backup              |
| kubernetes-secret-yaml             |    53 | Cluster backups (real risk)                   |
| stripe-access-token                |    13 | Test fixtures                                 |
| sentry-org-token                   |    10 | Some in source                                |
| gitlab-runner-authentication-token |     2 | Real                                          |
| linear-api-key                     |     2 | Real                                          |
| azure-ad-client-secret             |     2 | Real                                          |
| github-fine-grained-pat            |     2 | Real                                          |

### Real source findings (actionable)

```
generic-api-key | src/components/auth/AuthProvider.tsx : 6
generic-api-key | src/components/auth/AuthProvider.tsx : 12
generic-api-key | src/components/auth/AuthProvider.tsx : 6  (duplicate)
generic-api-key | src/components/auth/AuthProvider.tsx : 12 (duplicate)
generic-api-key | src/components/auth/AuthProvider.tsx : 6  (duplicate)
```

5 distinct locations, all in `AuthProvider.tsx`. **Verified false positive** on
inspection: line 6 = `'/api/auth/auth0-callback'` (a callback URL path, not a
credential), line 12 = `getEnvVariable` function declaration. gitleaks rule
`generic-api-key` is matching the string `auth0-callback`. No action needed;
will request rule tuning (`gitleaks:allow` or custom config) to suppress this
fingerprint.

### Infra YAML findings (actionable)

```
generic-api-key | infra/sinker/caddy/docker-compose.yml : 13
generic-api-key | infra/sinker/run_20260629T123000Z_infra-fix-oauth2-proxy-healthcheck.json : 11, 43
generic-api-key | infra/sinker/run_2026-06-29T11:16:31Z_infra-prep-auth0-credentials-emission.json : 17
generic-api-key | infra/cloud/qa/enterprise_validator.py : 229
generic-api-key | infra/config/emergency_security_config.json : 2
generic-api-key | infra/config/production/production_config/emergency.json : 2
generic-api-key | infra/config/production/production_config/security.json : 4
generic-api-key | infra/config/production/production_config/monitoring.json : 12
private-key     | infra/config/security/y : 1
```

**Action:** rotate any production secrets referenced in `infra/sinker/` /
`infra/config/production/`; check git log for unintended commits. Likely these
are infrastructure-as-code artifacts referencing secret stores, but verify.

### K8s cluster backups

48 findings in `cluster-backup-20251019-203844/resources.yaml`. **This is a full
Kubernetes resource dump** that may contain ConfigMaps/Secrets.

**Action:** Investigate why a cluster backup is committed to the repo. Confirm
the backup is sanitized or remove from history. Likely added by infra/sinker
automation.

---

## 6. Out-of-Scope Findings (Excluded)

These classes are excluded from the actionable inventory above:

- `.venv/` and `ai/.venv/` — vendored Python deps, controlled by lockfile
- `.env`, `.env.bak.*`, `alloy-key.json` — local developer working-tree files,
  not committed
- `yt_dlp/extractor/shahid.py` secret matches — vendored library, false positive
- Test fixture secrets (357) — synthetic data, manual verification only

---

## 7. Pending Scans (Blocked on External Dependencies)

| Scan             | Tool                    | Blocker                        | Owner  | Next step                                                                   |
| ---------------- | ----------------------- | ------------------------------ | ------ | --------------------------------------------------------------------------- |
| External network | Nmap, masscan           | Public IP ranges not provided  | DevOps | Request list of public-facing IPs                                           |
| K8s cluster      | kube-bench, kube-hunter | Cluster access (Civo)          | DevOps | Provision read-only kubeconfig                                              |
| Cloud config     | Prowler (AWS)           | AWS credentials + account ID   | DevOps | Confirm if AWS is in scope at all — see threat-model §2 reconciliation note |
| Web app scanner  | Burp Suite Pro, ZAP     | S4 scope (separate engagement) | Vendor | Tracked under S4                                                            |
| Container image  | Trivy image scan        | Built images not yet available | DevOps | Tag + push a test image to scan                                             |

---

## 8. Hand-off to S4 (Application Scanning)

Inputs S4 needs:

- This scan results document
- `docs/linear-audit/threat-model-scope.md` — STRIDE model + 14 focus areas
- ~~Tier 1 remediation PRs for: `pyjwt`, `python-multipart`, `starlette`~~
  (starlette ✅ PIX-4161)
- Confirmation that Tier 2-3 vulns are tracked in a follow-up issue

---

## 9. Change Log

<<<<<<< HEAD

| Date       | Author   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-29 | Chad     | Re-baselined all numbers; superseded Sprint Notes claim of "0 high"                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-29 | Chad     | Categorized 2585 gitleaks findings into actionable buckets                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-29 | Chad     | Identified 5 actionable source findings + 14 actionable infra findings                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-29 | Chad     | Corrected HIGH double-count: all 3 pnpm audit HIGHs (sharp/react-router/brace-expansion) are inside Trivy's 42 — unique actionable HIGH = 42, not 45                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-29 | Chad     | Traced pyjwt 2.12.1 to mcp 1.27.0 transitive dep; production lockfiles already at 2.13.0; remediation resolves via mcp>=1.28.1 bump (PIX-4159 follow-up)                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-29 | Chad     | Same scope finding for python-multipart 0.0.24 — downstream of mcp 1.27.0 in vendored lock; production lockfiles at 0.0.32; closes via mcp bump (PIX-4160 follow-up)                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-30 | Chad     | PIX-4163: Remediated CVE-2026-48746 + 3 HIGH vllm CVEs (54234/55514/55574). Single pinning source was `.venv/.../art/_vllm_runtime/pyproject.toml` line 9 (not `ai/training/` — those lockfiles do not reference vllm). Bumped direct wheel pin to `vllm>=0.24.0`; `uv lock` resolved vllm→0.26.0 + starlette 0.52.1→1.3.1. TB4 confirmed: vllm not reachable from production network. Trivy fs re-run pending — trivy CLI not installed in sandbox; `uv tree` confirms fix packages present in resolved graph. |
| =======    |
| Date       | Author   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-29 | Chad     | Re-baselined all numbers; superseded Sprint Notes claim of "0 high"                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-29 | Chad     | Categorized 2585 gitleaks findings into actionable buckets                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-29 | Chad     | Identified 5 actionable source findings + 14 actionable infra findings                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-29 | Chad     | Corrected HIGH double-count: all 3 pnpm audit HIGHs (sharp/react-router/brace-expansion) are inside Trivy's 42 — unique actionable HIGH = 42, not 45                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-29 | Chad     | Traced pyjwt 2.12.1 to mcp 1.27.0 transitive dep; production lockfiles already at 2.13.0; remediation resolves via mcp>=1.28.1 bump (PIX-4159 follow-up)                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-29 | Chad     | Same scope finding for python-multipart 0.0.24 — downstream of mcp 1.27.0 in vendored lock; production lockfiles at 0.0.32; closes via mcp bump (PIX-4160 follow-up)                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-30 | Sisyphus | RESOLVED starlette 0.52.1 → 1.3.1 — bumped ai/pyproject.toml constraint to `>=1.3.1`, re-locked, all production lockfiles already at 1.3.1 (PIX-4161)                                                                                                                                                                                                                                                                                                                                                           |

> > > > > > > 9c21ef945573bf7d20a11a3f77fde29d2ada27d5
