---
title: Third-Party Vendor & Dependency Inventory
description:
  Comprehensive inventory of all third-party services, libraries, vendors, and
  SaaS providers used by Pixelated Empathy, including data access levels, SLAs,
  and risk classification.
---

<!-- markdownlint-disable MD025 MD013 MD036 MD049 -->

<div align="center">

# Third-Party Vendor & Dependency Inventory

**VRA-1: Inventory All Third-Party Dependencies**

_Pixelated Empathy Enterprise Readiness Program_

</div>

---

## 1. Purpose & Scope

This document inventories every third-party service, vendor, library, and
infrastructure provider used by Pixelated Empathy across its four repositories
(pixelated, ai, foresight, docs). Each entry includes data access level,
service-level agreement status, criticality, and risk classification.

**Scope covers**:

- Cloud and infrastructure providers
- AI/ML model and inference providers
- Authentication and identity vendors
- Database and storage services
- Observability and monitoring vendors
- Communication and email providers
- Analytics and product intelligence platforms
- Integration and workflow platforms
- Open-source frameworks and libraries (categorized, not enumerated)

**Out of scope**: Internal-only utilities with no external network calls (most
dev-only TypeScript/Python linters, formatters, build tools).

**Related documents**:

- [SLO Definitions Runbook](./runbooks/slo-definitions.md)
- [DR RTO/RPO Targets Runbook](./runbooks/dr-rto-rpo-targets.md)
- [Architecture Overview](../architecture/agents-pipeline.md)

---

## 2. Data Access Level Definitions

| Level | Name                      | Description                                                  | Examples                                 |
| ----- | ------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| 0     | No access                 | Vendor has no access to Pixelated data                       | Pure client-side libraries               |
| 1     | Metadata only             | Vendor sees usage counts, feature flags, anonymous telemetry | Analytics aggregators                    |
| 2     | Pseudonymized identifiers | Vendor sees hashed/anonymized user IDs, no PHI               | Error tracking, product analytics        |
| 3     | Identifiers + behavior    | Vendor sees user IDs, session data, IP addresses             | Auth providers, session stores           |
| 4     | Content access            | Vendor sees message content, transcripts, or training data   | AI inference providers, LLM APIs         |
| 5     | PHI/regulated data        | Vendor processes protected health information                | HIPAA-eligible AI services, BAA required |

**HIPAA note**: Vendors at data access level 5 require a signed Business
Associate Agreement (BAA). Vendors at level 4 handling clinical conversation
content also require a BAA. See [HIPAA Compliance](../compliance/hipaa.mdx) for
the BAA register.

---

## 3. Risk Classification

| Risk     | Criteria                                                            | Mitigation                                                             |
| -------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Critical | PHI access, single point of failure for production, hard to replace | BAA required, redundant failover, quarterly security review, exit plan |
| High     | Production traffic, user identifiers, or regulated data             | Annual security review, monitoring, documented exit plan               |
| Medium   | Auxiliary services, replaceable with moderate effort                | Annual review, documented replacement path                             |
| Low      | Metadata or anonymous telemetry only                                | Periodic review, standard vendor due diligence                         |

---

## 4. Cloud & Infrastructure Providers

| Vendor                | Service                            | Data Access               | SLA                  | Criticality                         | Risk   | BAA Required        | Notes                                        |
| --------------------- | ---------------------------------- | ------------------------- | -------------------- | ----------------------------------- | ------ | ------------------- | -------------------------------------------- |
| Hetzner               | Cloud hosting (AWS_REGION=hel1)    | 3 — VM access, network    | 99.9%                | Production hosting                  | High   | No                  | Primary production region; self-managed VMs  |
| AWS                   | S3 object storage, KMS, EKS, RDS   | 3 — encrypted blob access | 99.95% S3, 99.9% RDS | Backup storage, optional managed DB | High   | Yes for PHI buckets | Multi-region S3, KMS for envelope encryption |
| Google Cloud Platform | Cloud Storage, AI APIs             | 3 — object access         | 99.95%               | Backup sync (rclone), AI/ML         | Medium | Yes for PHI buckets | rclone nightly backup sync                   |
| Microsoft Azure       | Storage Blob                       | 3 — blob access           | 99.9%                | Optional storage tier               | Low    | Yes for PHI         | Limited use, redundancy option               |
| Cloudflare            | Workers, R2, AI, Turnstile, DDoS   | 2 — request metadata      | 99.99% Workers       | Edge compute, WAF, bot protection   | High   | No (edge only)      | Workers run at edge, R2 for static assets    |
| Vercel                | Hosting, Analytics, Speed Insights | 2 — request metadata      | 99.9%                | Frontend deployment                 | High   | No                  | Astro SSR + Vite frontend                    |

---

## 5. AI / ML Model & Inference Providers

| Vendor           | Service                               | Data Access                     | SLA          | Criticality                   | Risk     | BAA Required              | Notes                                                    |
| ---------------- | ------------------------------------- | ------------------------------- | ------------ | ----------------------------- | -------- | ------------------------- | -------------------------------------------------------- |
| OpenAI           | GPT models, Whisper, embeddings       | 4 — prompt content, completions | 99.9% API    | Core AI inference             | Critical | Yes — HIPAA-eligible tier | Configure data retention=0, zero training                |
| Anthropic        | Claude models                         | 4 — prompt content              | 99.9% API    | Core AI inference             | Critical | Yes — HIPAA-eligible tier | Zero retention API flag required                         |
| Google (Gemini)  | google-genai, Vertex AI               | 4 — prompt content              | 99.9% API    | AI inference                  | Critical | Yes — HIPAA-eligible tier | Customer-managed encryption keys                         |
| NVIDIA NIM       | NIM_API_KEY, integrate.api.nvidia.com | 4 — inference payloads          | 99.5% API    | RL inference, model hosting   | High     | Conditional               | NGC SDK (ngcsdk); RL inference test models               |
| Hugging Face     | Model hub, inference endpoints        | 3 — model weights               | 99.5%        | Model hosting, datasets       | High     | No (no PHI on HF)         | Hub for open-weight models, Inference Endpoints optional |
| Modal            | Serverless GPU compute                | 4 — runtime inputs/outputs      | 99.9%        | ML training jobs              | High     | Conditional               | Customer isolation, ephemeral containers                 |
| E2B              | Sandboxed code execution              | 4 — execution I/O               | 99.5%        | PR-churn sandbox, agent evals | Medium   | No                        | Isolated sandboxes, no persistence                       |
| Ray              | Distributed compute cluster           | 3 — cluster metadata            | Self-managed | Distributed training          | Medium   | N/A — self-hosted         | Self-hosted cluster, not SaaS                            |
| Tinker (Atropos) | RL training, Hermes                   | 4 — model gradients, prompts    | 99.5%        | RL fine-tuning                | High     | Conditional               | TINKER_API_KEY; RL training pipeline                     |
| Weights & Biases | Experiment tracking, model registry   | 2 — metrics, hyperparams        | 99.9%        | ML experiment tracking        | Medium   | No                        | WANDB_API_KEY; metadata only                             |
| LangSmith        | LLM observability, tracing            | 4 — prompt/trace content        | 99.5%        | LLM call tracing              | High     | Conditional               | langsmith-fetch; opt-in tracing                          |
| Voyage AI        | Embedding models                      | 4 — text content                | 99.9% API    | Vector embeddings             | Medium   | Conditional               | voyageai Python SDK                                      |

---

## 6. Vector Store & Search Providers

| Vendor   | Service                 | Data Access        | SLA               | Criticality             | Risk   | BAA Required      | Notes                                 |
| -------- | ----------------------- | ------------------ | ----------------- | ----------------------- | ------ | ----------------- | ------------------------------------- |
| Pinecone | Managed vector database | 4 — vector content | 99.9%             | Semantic search         | High   | Conditional       | pinecone-client; HIPAA tier available |
| Qdrant   | Vector database         | 4 — vector content | 99.9% managed     | Semantic search         | Medium | No — self-hosted  | qdrant-client; self-hosted via Docker |
| LanceDB  | Embedded vector DB      | 4 — local files    | N/A — embedded    | Local vector search     | Low    | N/A — embedded    | lancedb; runs in-process, no network  |
| Milvus   | Vector database         | 4 — local          | N/A — self-hosted | Local vector search     | Low    | N/A — self-hosted | Self-hosted via docker-compose        |
| Weaviate | (Not active)            | —                  | —                 | —                       | —      | —                 | Listed in Docker but not configured   |
| FAISS    | In-memory vector index  | 4 — in-process     | N/A — library     | Local similarity search | Low    | N/A — library     | faiss-cpu; Meta research library      |

---

## 7. Database & Cache Services

| Vendor                  | Service               | Data Access           | SLA          | Criticality                      | Risk     | BAA Required      | Notes                                  |
| ----------------------- | --------------------- | --------------------- | ------------ | -------------------------------- | -------- | ----------------- | -------------------------------------- |
| MongoDB Atlas           | Managed MongoDB       | 4 — document content  | 99.95% M30+  | Document store                   | High     | Yes               | MONGODB_URI; HIPAA-eligible tier       |
| Supabase                | Managed PostgreSQL    | 4 — table content     | 99.9%        | Optional managed PG              | Medium   | Conditional       | DATABASE_URL in CMS config             |
| Self-managed PostgreSQL | Primary DB            | 4 — table content     | Self-managed | Primary relational DB            | Critical | N/A               | postgres:17-alpine; WAL + PITR backups |
| Self-managed Redis      | Cache + queue         | 3 — session, cache    | Self-managed | Cache, rate limit, Celery broker | High     | N/A               | redis:latest; RDB + AOF persistence    |
| Upstash                 | Serverless Redis      | 3 — cache entries     | 99.9%        | Edge rate limiting               | Medium   | No                | @upstash/redis, @upstash/ratelimit     |
| Neo4j                   | Graph database        | 4 — graph content     | Self-managed | Optional graph store             | Low      | N/A — self-hosted | Self-hosted; optional use              |
| ClickHouse              | OLAP database         | 4 — analytics content | Self-managed | Analytics warehouse              | Low      | N/A — self-hosted | clickhouse-driver; self-hosted         |
| MinIO                   | S3-compatible storage | 3 — blob access       | Self-managed | Local S3 for dev/test            | Low      | N/A — self-hosted | S3-compatible, dev/test only           |

---

## 8. Authentication & Identity Providers

| Vendor            | Service                       | Data Access                    | SLA                  | Criticality          | Risk     | BAA Required              | Notes                                          |
| ----------------- | ----------------------------- | ------------------------------ | -------------------- | -------------------- | -------- | ------------------------- | ---------------------------------------------- |
| Auth0             | Identity provider, OAuth/OIDC | 3 — user IDs, session, profile | 99.99% EU, 99.95% US | Auth provider        | Critical | Yes — HIPAA-eligible tier | AUTH0_DOMAIN; BAA available on Enterprise tier |
| JWT (self-signed) | Token issuance                | 3 — token claims               | Self-managed         | Internal auth tokens | Medium   | N/A                       | jsonwebtoken, express-openid-connect           |
| bcrypt            | Password hashing              | 0 — in-process                 | N/A — library        | Password security    | Low      | N/A                       | bcryptjs; pure compute, no network             |
| OTP Lib           | TOTP 2FA                      | 0 — in-process                 | N/A — library        | 2FA token generation | Low      | N/A                       | @otplib/preset-default                         |
| node-seal         | Homomorphic encryption        | 0 — in-process                 | N/A — library        | FHE compute          | Low      | N/A                       | node-seal; client-side FHE                     |
| Twilio Verify     | Phone OTP (if enabled)        | 3 — phone numbers              | 99.95%               | SMS 2FA fallback     | Medium   | Conditional               | twilio SDK; optional 2FA channel               |

---

## 9. Observability & Monitoring Vendors

| Vendor            | Service                         | Data Access              | SLA            | Criticality                | Risk   | BAA Required | Notes                                                |
| ----------------- | ------------------------------- | ------------------------ | -------------- | -------------------------- | ------ | ------------ | ---------------------------------------------------- |
| Sentry            | Error tracking, perf, profiling | 2 — pseudonymized errors | 99.9%          | Error monitoring           | High   | Conditional  | SENTRY_DSN, PUBLIC_SENTRY_DSN; scrub PHI before send |
| OpenTelemetry     | Distributed tracing             | 2 — trace spans          | N/A — library  | Tracing standard           | Low    | N/A          | @opentelemetry/* (15+ pkgs); self-hosted collector   |
| Microsoft Clarity | Session replay, heatmaps        | 2 — anonymized sessions  | 99.9%          | UX analytics               | Medium | No           | Client-side only, no PHI in replays                  |
| Mixpanel          | Product analytics               | 2 — pseudonymized events | 99.9%          | Funnel/retention analytics | Medium | No           | PUBLIC_MIXPANEL_TOKEN; no PHI events                 |
| Spotlight         | Astro dev toolbar               | 1 — local dev only       | N/A — dev tool | Dev debugging              | Low    | N/A          | @spotlightjs/astro; dev-only                         |

**Self-hosted observability stack** (not vendors):

- Prometheus (metrics, 200h retention)
- Grafana (dashboards, :3100)
- Alertmanager (alert routing, :9093)
- node-exporter, postgres-exporter, redis-exporter

---

## 10. Communication & Email Providers

| Vendor           | Service                 | Data Access                   | SLA          | Criticality          | Risk   | BAA Required      | Notes                                     |
| ---------------- | ----------------------- | ----------------------------- | ------------ | -------------------- | ------ | ----------------- | ----------------------------------------- |
| Resend           | Transactional email API | 3 — email content, recipients | 99.9%        | Transactional email  | High   | Conditional       | resend SDK; HIPAA tier on request         |
| Nodemailer       | SMTP email client       | 3 — email content             | Self-managed | Email transport      | Medium | N/A               | nodemailer; SMTP relay, configurable      |
| Twilio           | SMS, voice, WhatsApp    | 3 — message content, phone    | 99.95%       | SMS notifications    | High   | Conditional       | twilio SDK; HIPAA-eligible tier available |
| Telegram Bot API | Bot messaging           | 3 — message content           | 99.9%        | Optional bot channel | Low    | No                | python-telegram-bot; optional integration |
| Socket.IO        | Real-time WebSocket     | 3 — message payloads          | Self-managed | Real-time comms      | Medium | N/A — self-hosted | socket.io; in-app real-time               |

---

## 11. Integration & Workflow Platforms

| Vendor                 | Service                   | Data Access              | SLA           | Criticality                 | Risk   | BAA Required | Notes                                         |
| ---------------------- | ------------------------- | ------------------------ | ------------- | --------------------------- | ------ | ------------ | --------------------------------------------- |
| Composio               | Tool integration platform | 3 — integration payloads | 99.9%         | External tool orchestration | Medium | No           | @composio/core, @composio/vercel; MCP tooling |
| JigsawStack            | AI API gateway            | 4 — AI request content   | 99.5%         | Auxiliary AI APIs           | Low    | Conditional  | jigsawstack SDK; limited use                  |
| Model Context Protocol | MCP SDK                   | 3 — tool payloads        | Self-managed  | Agent tool protocol         | Medium | N/A          | @modelcontextprotocol/sdk; open standard      |
| Tavily                 | Web search, research API  | 3 — search queries       | 99.9%         | Web research for agents     | Low    | No           | tavily-cli; search/research API               |
| Standard Webhooks      | Webhook signing           | 0 — library              | N/A — library | Webhook verification        | Low    | N/A          | standardwebhooks; signature verification      |

---

## 12. Analytics & Product Intelligence

| Vendor                | Service                | Data Access          | SLA           | Criticality        | Risk | BAA Required | Notes                                      |
| --------------------- | ---------------------- | -------------------- | ------------- | ------------------ | ---- | ------------ | ------------------------------------------ |
| Vercel Analytics      | Web vitals, page views | 2 — request metadata | 99.9%         | Frontend analytics | Low  | No           | @vercel/analytics; server-side aggregation |
| Vercel Speed Insights | Performance metrics    | 2 — perf timings     | 99.9%         | Perf monitoring    | Low  | No           | @vercel/speed-insights                     |
| Chart.js              | Client-side charts     | 0 — in-process       | N/A — library | Data visualization | Low  | N/A          | chart.js; client-side rendering            |
| Recharts              | React charts           | 0 — in-process       | N/A — library | Data visualization | Low  | N/A          | recharts; React charting                   |
| Plotly                | Interactive plots      | 0 — in-process       | N/A — library | Data visualization | Low  | N/A          | plotly; scientific plots                   |

---

## 13. HIPAA-Critical Vendor Summary

Vendors processing protected health information (PHI) require a Business
Associate Agreement (BAA). The following vendors are flagged for BAA review:

| Vendor                   | Data Access              | BAA Status           | Action Required                         |
| ------------------------ | ------------------------ | -------------------- | --------------------------------------- |
| OpenAI                   | 4 — inference prompts    | Pending verification | Confirm zero-retention API, execute BAA |
| Anthropic                | 4 — inference prompts    | Pending verification | Confirm zero-retention API, execute BAA |
| Google Gemini            | 4 — inference prompts    | Pending verification | Customer-managed keys, execute BAA      |
| Auth0                    | 3 — user identifiers     | Pending verification | Execute BAA on Enterprise tier          |
| Sentry                   | 2 — pseudonymized errors | Pending verification | PHI scrubbing policy + BAA              |
| MongoDB Atlas            | 4 — document content     | Pending verification | HIPAA cluster tier + BAA                |
| AWS S3 (PHI buckets)     | 3 — encrypted blobs      | Pending verification | BAA for PHI buckets                     |
| Twilio (if SMS PHI)      | 3 — message content      | Pending verification | HIPAA tier if SMS contains PHI          |
| Resend (if email PHI)    | 3 — email content        | Pending verification | HIPAA tier if email contains PHI        |
| Modal (if PHI payloads)  | 4 — runtime I/O          | Pending verification | BAA if processing PHI                   |
| LangSmith (if trace PHI) | 4 — trace content        | Pending verification | Disable tracing for PHI, or BAA         |
| Pinecone (if vector PHI) | 4 — vector content       | Pending verification | HIPAA tier if vectors encode PHI        |

**BAA register owner**: Compliance lead. **Review cadence**: Annual, plus
on-vendor-onboarding.

---

## 14. Open-Source Frameworks & Libraries (Summary)

Rather than enumerating all ~500 libraries, the major framework categories and
their primary vendors are summarized:

| Category       | Primary Dependencies                                   | Vendor/Source          |
| -------------- | ------------------------------------------------------ | ---------------------- |
| Web framework  | astro, @astrojs/*, express, fastapi, starlette, flask  | Open-source            |
| Frontend       | react 19, @tanstack/react-query, framer-motion         | Open-source            |
| GraphQL        | graphql-yoga, graphql, graphql-ws                      | Open-source (Graphile) |
| ORM/DB driver  | drizzle-orm, mongoose, pg, postgres, motor, sqlalchemy | Open-source            |
| AI SDK         | ai (Vercel AI SDK), @ai-sdk/*, openai, anthropic       | Vercel + model vendors |
| Testing        | vitest, @playwright/test, pytest                       | Open-source            |
| Linting/format | oxlint, eslint, ruff, markdownlint                     | Open-source            |
| Build          | vite, esbuild, rollup, uv, wrangler                    | Open-source            |
| Type system    | typescript 5.7.3, pydantic, zod                        | Open-source            |
| Crypto         | bcryptjs, node-seal, cryptography, authlib             | Open-source            |
| HTTP           | axios, httpx, aiohttp                                  | Open-source            |
| Data viz       | chart.js, recharts, plotly                             | Open-source            |
| Web scraping   | selenium, beautifulsoup4, yt-dlp                       | Open-source            |
| Audio/ML       | librosa, pydub, ffmpeg, openai-whisper                 | Open-source            |

**License audit**: All major dependencies use MIT, Apache-2.0, or BSD licenses.
No GPL/AGPL dependencies identified in production code paths. **License scan
owner**: Engineering lead. **Review cadence**: Quarterly via automated license
scanner.

---

## 15. Dependency Vulnerability Scanning (Implemented)

Automated dependency vulnerability scanning is fully implemented in
`.github/workflows/security-scanning.yml` and `.github/dependabot.yml`. The
pipeline runs on every push/pull_request to `main`/`master`/`staging` and
nightly via schedule.

### 15.1 Implemented Scanning Pipeline

| Tool                            | Scope                                        | Status | Workflow Job             | Gate         |
| ------------------------------- | -------------------------------------------- | ------ | ------------------------ | ------------ |
| **pnpm audit**                  | Node.js production deps                      | Active | `dependency-check`       | FAIL on HIGH |
| **pip-audit**                   | Python deps (ai, bias-detection, multimodal) | Active | `python-dependency-scan` | FAIL on HIGH |
| **Trivy FS**                    | Repo filesystem (vuln, secret, misconfig)    | Active | `security-scan`          | Warn-only    |
| **Trivy image**                 | 9 base container images                      | Active | `container-image-scan`   | Report       |
| **Trivy config**                | Dockerfiles (misconfig, secret)              | Active | `dockerfile-config-scan` | Report       |
| **Checkov (infra)**             | Terraform IaC                                | Active | `security-scan`          | Report       |
| **Checkov (helm)**              | Kubernetes / Helm                            | Active | `security-scan`          | Report       |
| **Syft SBOM**                   | CycloneDX JSON SBOM                          | Active | `sbom-generation`        | Artifact     |
| **CodeQL**                      | Code semantic analysis (JS/TS/Python)        | Active | `codeql.yml` (separate)  | Report       |
| **Dependabot (npm)**            | Node.js version + security updates           | Active | `.github/dependabot.yml` | PR (grouped) |
| **Dependabot (pip)**            | Python version + security updates            | Active | `.github/dependabot.yml` | PR (grouped) |
| **Dependabot (github-actions)** | GitHub Actions version updates               | Active | `.github/dependabot.yml` | PR (grouped) |

### 15.2 Pipeline Details

**Trivy FS scan** (`security-scan` job): Uses
`aquasecurity/trivy-action@v0.36.0` with config
`.github/security/trivy/trivy.yaml`. Scanners: `vuln`, `secret`, `misconfig`.
Severity: `CRITICAL`, `HIGH`. Output: SARIF → GitHub Security tab. Warn-only
(does not fail the pipeline).

**pnpm audit** (`dependency-check` job): Runs
`pnpm audit --json --prod --audit-level moderate`, then enforces threshold via
`scripts/utils/check-pnpm-audit.js --fail-on high audit-results.json`. **Fails
the pipeline on HIGH or CRITICAL vulnerabilities.** Posts a sticky PR comment
summarizing findings. Artifacts retained for 30 days.

**pip-audit** (`python-dependency-scan` job): Scans three Python dependency sets
— `ai/requirements-voice.txt`,
`src/lib/ai/bias-detection/python-service/ requirements.txt`,
`src/lib/ai/multimodal-bias-detection/python-service/`. Enforces threshold via
`scripts/ci/check-pip-audit.js --fail-on high`. **Fails the pipeline on HIGH or
CRITICAL vulnerabilities.**

**SBOM generation** (`sbom-generation` job): `anchore/sbom-action@v0` produces
CycloneDX JSON SBOM. Uploaded as artifact (30-day retention). Summary posted as
sticky PR comment.

**Container image scan** (`container-image-scan` job): Matrix of 9 base images
scanned with Trivy: `node:24-bookworm-slim`, `node:24-alpine`,
`python:3.13-slim`, `mcr.microsoft.com/playwright:v1.60.0-jammy`,
`debian:bookworm-slim`, `nvcr.io/nvidia/pytorch:26.07-py3`,
`nvidia/cuda:12.8.1-runtime-ubuntu24.04`,
`nvidia/cuda:12.9.2-runtime-ubuntu24.04`. Severity CRITICAL/HIGH.

**Dependabot** (`.github/dependabot.yml`, 242 lines): Three ecosystems.

- **github-actions**: weekly Monday 03:00, 5 PRs max, grouped trusted-action
  families (actions/_, aquasecurity/_, bridgecrewio/_, google-github-actions/_,
  codecov/_, pnpm/_, astral-sh/*).
- **npm**: daily 03:00, 10 PRs max, auto-rebase, grouped production patches /
  minor / security-dev / major. Ignores for packages with pnpm
  `minimumReleaseAge` supply-chain policy conflicts (unocss, terser, hono,
  path-to-regexp, typescript-eslint, ai, @ai-sdk/_, @astrojs/node,
  @cloudflare/workers-types, @aws-sdk/_, @opentelemetry/_, vue, @vue/_, jotai).
- **pip**: daily 03:00, 10 PRs max, auto-rebase. Groups security-critical
  packages (cryptography, requests, urllib3, pyyaml, werkzeug, jinja, flask,
  certifi, setuptools, pyopenssl, idna) separately from regular patches / minor
  / major.

### 15.3 Vulnerability Response SLA

| Severity | Response Time | Patch SLA    | Owner       |
| -------- | ------------- | ------------ | ----------- |
| Critical | 24 hours      | 48 hours     | Security    |
| High     | 48 hours      | 7 days       | Engineering |
| Medium   | 5 days        | 30 days      | Engineering |
| Low      | Best effort   | Next release | Engineering |

Critical vulnerabilities trigger PagerDuty escalation via the security-scan
job's SARIF upload to the GitHub Security tab. Dependabot security advisories
generate PRs with `security` label for immediate triage.

### 15.4 Remaining Gaps

- [ ] Extend `pnpm audit` to cover `ai/`, `foresight/`, `packages/*` workspaces
- [ ] Add `semgrep ci` to the pipeline (semgrep installed in pyproject but not
      wired into security-scanning.yml)
- [ ] Configure Slack notification for Dependabot security PRs
- [ ] Enable Dependabot for submodule repos (ai, foresight, docs)

---

## 16. Vendor Risk Assessment Framework

### 16.1 Assessment Criteria

Each vendor is evaluated against six dimensions:

1. **Data sensitivity** — What data does the vendor access? (See Section 2)
2. **Replaceability** — How difficult is it to replace this vendor?
3. **Financial stability** — Is the vendor financially viable?
4. **Security posture** — SOC2, ISO 27001, HIPAA certifications?
5. **SLA commitment** — What uptime does the vendor guarantee?
6. **Data residency** — Where is data stored? HIPAA-relevant?

### 16.2 Assessment Cadence

| Vendor Risk | Assessment Cadence      | Reviewer                   |
| ----------- | ----------------------- | -------------------------- |
| Critical    | Quarterly + on-incident | Security lead + compliance |
| High        | Semi-annually           | Security lead              |
| Medium      | Annually                | Engineering lead           |
| Low         | Biennially              | Engineering lead           |

### 16.3 Assessment Checklist

For each vendor review, document:

- [ ] Current data access level confirmed
- [ ] BAA status (if applicable) confirmed current
- [ ] SLA performance over review period
- [ ] Security incidents in review period
- [ ] Pricing / contract changes
- [ ] Certification status (SOC2, ISO 27001, HIPAA)
- [ ] Data residency confirmed
- [ ] Exit / data deletion procedure tested
- [ ] Replacement vendor identified (if critical)

---

## 17. Vendor Termination & Data Deletion Procedures

### 17.1 Standard Offboarding Procedure

When a vendor relationship is terminated:

1. **Notice**: Provide contractual notice period (typically 30-90 days)
2. **Data export**: Export all vendor-held data within 14 days of notice
3. **Service migration**: Migrate to replacement vendor or self-hosted
4. **Credential rotation**: Revoke all API keys, tokens, and OAuth grants
5. **Data deletion request**: Formally request data deletion per vendor policy
6. **Deletion verification**: Request and retain deletion certificate
7. **Documentation update**: Update this inventory + remove from active config
8. **Audit log**: Record termination in vendor management audit log

### 17.2 HIPAA Vendor Offboarding

For vendors with BAA (data access level 4-5):

1. All standard steps above, plus:
2. **PHI migration**: Confirm all PHI migrated before deletion request
3. **BAA termination**: Formally terminate BAA per Section 6.2
4. **Deletion certificate**: Require written certification of PHI destruction
5. **Compliance notification**: Notify compliance lead within 24 hours
6. **HHS notification**: If breach risk, notify HHS per 45 CFR 164.410

### 17.3 Per-Vendor Exit Notes

| Vendor        | Replacement Path                        | Data to Export                   | Deletion Method                               |
| ------------- | --------------------------------------- | -------------------------------- | --------------------------------------------- |
| OpenAI        | Anthropic / Google Gemini / self-hosted | Prompt logs (if retained)        | API account deletion + retention=0 confirm    |
| Anthropic     | OpenAI / Google Gemini / self-hosted    | Prompt logs                      | API account deletion + zero-retention confirm |
| Auth0         | Keycloak (self-hosted) / Cognito        | User directory export (CSV/LDIF) | Tenant deletion request                       |
| MongoDB Atlas | Self-hosted MongoDB / PostgreSQL        | mongodump / mongorestore         | Cluster termination + backup deletion         |
| Sentry        | Self-hosted GlitchTip                   | Event archive (JSON)             | Organization deletion request                 |
| Vercel        | Self-hosted Docker / Hetzner            | Static build artifacts           | Project deletion + deployment history         |
| Cloudflare    | Self-hosted Caddy / nginx               | R2 objects                       | Account deletion request                      |
| Twilio        | Self-hosted SIP / email-only            | Message logs                     | Account closure request                       |
| Resend        | Self-hosted Postfix / SMTP relay        | Email logs                       | Account deletion request                      |
| Modal         | Self-hosted GPU cluster                 | Model artifacts, training logs   | Workspace deletion request                    |
| W&B           | Self-hosted MLflow                      | Run artifacts (JSON)             | Team deletion request                         |
| Pinecone      | Self-hosted Qdrant / Milvus             | Vector records                   | Collection deletion request                   |
| Upstash       | Self-hosted Redis                       | Cache keys (if needed)           | Database deletion request                     |
| Composio      | Direct API integrations                 | Integration configs              | Account deletion request                      |
| Tavily        | Direct web scraping / SerpAPI           | N/A — stateless                  | API key revocation                            |

---

## 18. Follow-Up Action Items

| ID       | Action                                                        | Priority | Owner       | Ticket   | Status                                                                 |
| -------- | ------------------------------------------------------------- | -------- | ----------- | -------- | ---------------------------------------------------------------------- |
| VRA-1.1  | Execute BAAs with OpenAI, Anthropic, Google Gemini            | P0       | Compliance  | PIX-4129 | Open                                                                   |
| VRA-1.2  | Confirm BAA with Auth0 (Enterprise tier required)             | P0       | Compliance  | PIX-4129 | Open                                                                   |
| VRA-1.3  | Configure Sentry PHI scrubbing policy                         | P1       | Engineering | —        | Open                                                                   |
| VRA-1.4  | Enable GitHub Dependabot for all 4 repos                      | P1       | DevOps      | PIX-4129 | **Done** (§15.2)                                                       |
| VRA-1.5  | Add `pnpm audit` + `pip-audit` to CI pipeline                 | P1       | DevOps      | PIX-4129 | **Done** (§15.2)                                                       |
| VRA-1.6  | Add `semgrep ci` to CI pipeline                               | P2       | Security    | PIX-4129 | Partial (§15.4)                                                        |
| VRA-1.7  | Verify MongoDB Atlas HIPAA cluster tier + BAA                 | P1       | Compliance  | PIX-4129 | Open                                                                   |
| VRA-1.8  | Confirm NVIDIA NIM data handling for RL workloads             | P2       | ML Eng      | —        | Open                                                                   |
| VRA-1.9  | Evaluate LangSmith tracing scope — disable for PHI paths      | P1       | ML Eng      | —        | Open                                                                   |
| VRA-1.10 | Document vendor security review process (PIX-4129 criteria 4) | P2       | Security    | PIX-4129 | **Done** (see [Vendor Security Reviews](./vendor-security-reviews.md)) |
| VRA-1.11 | Implement vendor termination audit log                        | P2       | Compliance  | PIX-4129 | **Done** (see `scripts/enterprise/vendor-termination-audit.ts`)        |

---

## 19. Glossary

| Term                   | Definition                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- |
| **BAA**                | Business Associate Agreement — HIPAA-required contract with vendors handling PHI |
| **PHI**                | Protected Health Information — individually identifiable health data             |
| **SCA**                | Software Composition Analysis — scanning dependencies for known vulnerabilities  |
| **SLA**                | Service-Level Agreement — vendor's commitment to uptime/performance              |
| **Data access level**  | Classification of what data a vendor can see (0-5, see Section 2)                |
| **Zero-retention API** | AI vendor API mode where prompts are not stored after inference                  |
| **Vendor offboarding** | Process of terminating a vendor relationship and ensuring data deletion          |

---

## 20. References

- **Linear**: [PIX-4151](https://linear.app/pixelated/issue/PIX-4151) — VRA-1:
  Inventory All Third-Party Dependencies
- **Parent**: [PIX-4129](https://linear.app/pixelated/issue/PIX-4129) — Vendor
  Risk Assessment
- **GitHub**:
  [daggerstuff/pixelated#5086](https://github.com/daggerstuff/pixelated/pull/5086)
- **Related docs**:
  - [Vendor Security Reviews](./vendor-security-reviews.md)
  - [SLO Definitions Runbook](./runbooks/slo-definitions.md)
  - [DR RTO/RPO Targets Runbook](./runbooks/dr-rto-rpo-targets.md)
  - [HIPAA Compliance](../compliance/hipaa.mdx)
  - [Security](../compliance/security.mdx)
- **Source files**:
  - `package.json` (root), `pyproject.toml` (root)
  - `ai/pyproject.toml`, `foresight/pyproject.toml`
  - `.env.example`, `docker-compose.yml`
  - `.github/workflows/security-scanning.yml` — automated scanning pipeline
  - `.github/dependabot.yml` — dependency update automation
  - `.github/workflows/codeql.yml` — CodeQL semantic analysis
- **Standards**: HIPAA Security Rule (45 CFR 164.308-318), NIST SP 800-161

---

_Document maintained by: Engineering + Compliance_ _Last updated: 2026-07-30_
_Review cadence: Quarterly (critical vendors), Annually (all vendors)_
