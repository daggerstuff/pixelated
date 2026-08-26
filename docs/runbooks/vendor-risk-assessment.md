# Vendor Risk Assessment — Third-Party Dependency Inventory

**Document:** VRA-1 | **Issue:**
[PIX-4151](https://linear.app/pixelated/issue/PIX-4151) **Owner:** Security &
Infrastructure **Last Updated:** 2026-07-30 **Status:** Final

---

## 1. Overview

This document inventories every third-party dependency used by the Pixelated
Empathy platform, classifies each by data access level, and records applicable
SLAs and risk posture.

The inventory covers:

- **Infrastructure services** provisioned at runtime (databases, caches, queues)
- **Third-party APIs** called over the network
- **Open-source libraries** with significant data access or security impact
- **Vendors** with contractual agreements

### Methodology

Dependencies were identified by scanning `package.json`, `pnpm-lock.yaml`
(resolved), `pyproject.toml`, `uv.lock` (resolved), `Dockerfile` references,
`docker-compose.yml` service definitions,
`monitoring/docker-compose.monitoring.yml`, and `k8s/` manifests. Data access
levels are based on code-review analysis of how each dependency interacts with
customer or patient data.

---

## 2. Data Access Classification

| Level        | Definition                                                          | Examples                             |
| ------------ | ------------------------------------------------------------------- | ------------------------------------ |
| **None**     | No access to any platform data; purely infrastructure or build-time | Load balancers, CI/CD tools, linting |
| **Indirect** | Processes metadata or aggregate metrics; no raw user data           | Monitoring dashboards, log shippers  |
| **Direct**   | Processes or stores user data but not PHI                           | Session metadata, feature flags      |
| **PHI**      | Processes, stores, or transmits Protected Health Information        | Database, therapy session storage    |
| **PII**      | Processes personally identifiable information                       | Auth provider, user profiles         |

---

## 3. Infrastructure Services

| Service             | Version/Image            | Purpose                                                        | Data Access                      | SLA Tier                      | Risk     |
| ------------------- | ------------------------ | -------------------------------------------------------------- | -------------------------------- | ----------------------------- | -------- |
| PostgreSQL 17       | `postgres:17-alpine`     | Primary relational DB (user accounts, sessions, clinical data) | **PHI**                          | Self-managed; no external SLA | Critical |
| Redis               | `redis:latest`           | Caching, session store, Celery broker/backend                  | **Direct** (session tokens)      | Self-managed                  | High     |
| Prometheus          | `prom/prometheus`        | Metrics collection & alerting                                  | **Indirect** (aggregate metrics) | Self-managed                  | Medium   |
| Grafana             | `grafana/grafana`        | Dashboard visualization                                        | **Indirect** (aggregate metrics) | Self-managed                  | Medium   |
| Alertmanager        | `prom/alertmanager`      | Alert routing (PagerDuty, Slack, Email)                        | **Indirect** (alert metadata)    | Self-managed                  | Medium   |
| Node Exporter       | `prom/node-exporter`     | System metrics                                                 | **None**                         | Self-managed                  | Low      |
| PostgreSQL Exporter | `prom/postgres-exporter` | DB metrics                                                     | **Indirect** (query stats)       | Self-managed                  | Low      |
| Redis Exporter      | `prom/redis-exporter`    | Redis metrics                                                  | **Indirect** (key stats)         | Self-managed                  | Low      |
| Nginx               | Docker container         | Reverse proxy, TLS termination                                 | **Direct** (request metadata)    | Self-managed                  | Medium   |
| MinIO               | SDK integration          | Object storage (training data, exports)                        | **PHI** (backup data)            | Self-managed; S3-compatible   | Critical |
| ClickHouse          | Client library           | OLAP analytics                                                 | **Direct** (usage analytics)     | Self-managed                  | Medium   |

---

## 4. Third-Party APIs & Services

| Service                      | Purpose                                 | Data Access                                       | SLA                               | Risk     |
| ---------------------------- | --------------------------------------- | ------------------------------------------------- | --------------------------------- | -------- |
| **OpenAI API**               | AI model inference (chat, embeddings)   | **PHI** (therapy session text sent for inference) | OpenAI Platform SLA: 99.9% uptime | Critical |
| **HuggingFace Hub**          | Model registry, dataset hosting         | **None** (model weights only)                     | Best-effort                       | Low      |
| **Weights & Biases (wandb)** | Experiment tracking, model monitoring   | **Indirect** (training metrics)                   | W&B SLA: 99.9%                    | Low      |
| **Sentry**                   | Error tracking & performance monitoring | **Direct** (error stack traces, user IDs)         | Sentry SLA: 99.95%                | Medium   |
| **PagerDuty**                | Incident alerting & on-call             | **None** (alert metadata only)                    | PagerDuty SLA: 99.99%             | Low      |
| **Slack Webhook**            | Alert notifications                     | **None** (notification text only)                 | Best-effort                       | Low      |
| **Google API (Drive, Auth)** | Drive file transfers, OAuth             | **PII** (user email, OAuth tokens)                | Google SLA: 99.9%+                | Medium   |
| **Kaggle API**               | Dataset sourcing for training           | **None** (public datasets)                        | Best-effort                       | Low      |
| **YouTube Transcript API**   | Academic dataset sourcing               | **None** (public transcripts)                     | Best-effort                       | Low      |
| **E2B (e2b.dev)**            | Sandboxed code execution                | **None** (ephemeral sandbox)                      | E2B SLA: 99.9%                    | Low      |
| **S3 (MinIO/Boto3)**         | Object storage                          | **PHI** (stored export/training data)             | Self-managed                      | High     |
| **Neo4j (AuraDB?)**          | Graph database (knowledge graphs)       | **Direct** (knowledge graph entities)             | Self-managed                      | Medium   |
| **LanceDB**                  | Vector store                            | **Direct** (embeddings vectors)                   | Self-managed                      | Medium   |
| **Ray**                      | Distributed compute                     | **Indirect** (job metadata)                       | Self-managed                      | Medium   |

---

## 5. Key Open-Source Libraries with Data Access

| Library                         | Language   | Purpose                                   | Data Access                               | Notes     |
| ------------------------------- | ---------- | ----------------------------------------- | ----------------------------------------- | --------- |
| `transformers` (HuggingFace)    | Python     | LLM inference & training                  | **PHI** (text passed to models)           | v5.0.0rc3 |
| `sentence-transformers`         | Python     | Embedding generation                      | **PHI** (text converted to embeddings)    |           |
| `torch` (PyTorch)               | Python     | ML model runtime                          | **PHI** (tensors from clinical text)      | v2.13.0   |
| `scikit-learn`                  | Python     | ML pipelines (classification, clustering) | **Direct** (feature vectors)              |           |
| `fairlearn`                     | Python     | Fairness/bias assessment                  | **Direct** (model predictions)            |           |
| `shap`                          | Python     | Model explainability                      | **Direct** (feature importance)           |           |
| `spaCy`                         | Python     | NLP pipeline                              | **Direct** (text for linguistic analysis) |           |
| `cryptography`                  | Python     | Encryption, key management                | **PHI** (encryption of PHI)               | v46.x     |
| `pyjwt`                         | Python     | JWT auth tokens                           | **Direct** (auth tokens)                  |           |
| `sentry-sdk`                    | Python/TS  | Error reporting                           | **Direct** (error context)                |           |
| `openai` (Python SDK)           | Python     | OpenAI API client                         | **PHI** (API call payloads)               |           |
| `motor`                         | Python     | Async MongoDB driver                      | **PHI** (MongoDB data)                    |           |
| `neo4j` (driver)                | Python     | Neo4j graph DB driver                     | **Direct** (graph queries)                |           |
| `lancedb`                       | Python     | Vector database client                    | **Direct** (embeddings)                   |           |
| `google-genai`                  | Python     | Google AI API                             | **PHI** (sent text)                       |           |
| `fastmcp`                       | Python     | MCP protocol server                       | **Direct** (tool call args)               |           |
| `redis` (Python)                | Python     | Redis client                              | **Direct** (session data)                 |           |
| `httpx`                         | Python     | HTTP client                               | **Direct** (request payloads)             |           |
| `astro`                         | TypeScript | Web framework (SSR)                       | **Direct** (HTTP request data)            |           |
| `express` (via backend/ server) | TypeScript | REST API server                           | **Direct** (API request data)             |           |
| `passport` / `next-auth`        | TypeScript | Authentication middleware                 | **PII** (user credentials flow)           |           |
| `socket.io`                     | TypeScript | WebSocket real-time communication         | **Direct** (therapy session messages)     |           |

---

## 6. Major Vendors

| Vendor                   | Service             | Contract Status      | Data Access  | SLA          | Notes                  |
| ------------------------ | ------------------- | -------------------- | ------------ | ------------ | ---------------------- |
| **OpenAI**               | GPT model API       | Direct usage         | **PHI**      | 99.9% uptime | Requires DPA for HIPAA |
| **HuggingFace**          | Model registry      | Free tier            | **None**     | Best-effort  |                        |
| **Sentry**               | Error monitoring    | Self-hosted or cloud | **Direct**   | 99.95%       | DPA in place           |
| **PagerDuty**            | Incident management | Active subscription  | **None**     | 99.99%       |                        |
| **Google**               | OAuth, Drive API    | Free tier            | **PII**      | 99.9%+       |                        |
| **Weights & Biases**     | ML tracking         | Free tier            | **Indirect** | 99.9%        |                        |
| **E2B**                  | Sandbox             | Free tier            | **None**     | 99.9%        |                        |
| **Sentry** (self-hosted) | Monitoring          | Self-hosted option   | **Direct**   | Self-managed |                        |

---

## 7. Data Access Matrix

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                  DATA ACCESS LEVEL                        │
                    ├──────────┬──────────┬──────────┬──────────┬──────────────┤
                    │   None   │ Indirect │  Direct  │   PII    │     PHI      │
├───────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ PostgreSQL        │          │          │          │          │      ✓       │
│ OpenAI API        │          │          │          │          │      ✓       │
│ HuggingFace       │    ✓     │          │          │          │              │
│ Transformers lib  │          │          │          │          │      ✓       │
│ Redis             │          │          │    ✓     │          │              │
│ Sentry            │          │          │    ✓     │          │              │
│ MinIO / S3        │          │          │          │          │      ✓       │
│ Google API        │          │          │          │    ✓     │              │
│ PagerDuty         │    ✓     │          │          │          │              │
│ Slack Webhook     │    ✓     │          │          │          │              │
│ Prometheus        │          │    ✓     │          │          │              │
│ Grafana           │          │    ✓     │          │          │              │
│ MongoDB (motor)   │          │          │          │          │      ✓       │
│ Neo4j             │          │          │    ✓     │          │              │
│ LanceDB           │          │          │    ✓     │          │              │
│ Celery            │          │          │    ✓     │          │              │
│ W&B               │          │    ✓     │          │          │              │
└───────────────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
```

---

## 8. SLA Summary

| Tier                  | Definition                     | Services                                  | Target Uptime |
| --------------------- | ------------------------------ | ----------------------------------------- | ------------- |
| **Tier 1 — Critical** | PHI data processing or storage | PostgreSQL, OpenAI API, MinIO/S3, MongoDB | 99.95%        |
| **Tier 2 — High**     | Direct user data but not PHI   | Redis, Neo4j, LanceDB, Sentry, Auth       | 99.9%         |
| **Tier 3 — Standard** | Metadata or aggregate data     | Prometheus, Grafana, Celery, Google API   | 99.5%         |
| **Tier 4 — Support**  | No user data exposure          | PagerDuty, Slack, W&B, E2B, Kaggle        | Best-effort   |

---

## 9. Risk Register

| Risk                                               | Dependency                  | Impact   | Likelihood | Mitigation                                                                                                                                                             |
| -------------------------------------------------- | --------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI API outage blocks AI features               | OpenAI                      | High     | Low        | Fallback model; queue for retry                                                                                                                                        |
| PHI exposure via API payload                       | OpenAI, Transformers, Torch | Critical | Low        | DPA review; data minimization; encryption in transit                                                                                                                   |
| Supply-chain attack on Python/JS lib               | All OSS                     | Critical | Low        | Lock files, SBOM, Dependabot, SCA scanning                                                                                                                             |
| Sentry leak of error context                       | Sentry                      | High     | Low        | Filter sensitive fields before sending                                                                                                                                 |
| PostgreSQL data loss                               | PostgreSQL                  | Critical | Low        | Automated backups, replication, DR plan                                                                                                                                |
| Third-party API deprecation                        | OpenAI, HuggingFace, E2B    | Medium   | Medium     | Abstract behind provider interface                                                                                                                                     |
| No external pentest coverage                       | Platform (all services)     | Critical | High       | Quarterly internal assessment per [penetration-testing-assessment.md](penetration-testing-assessment.md); lightweight external review only when contractually required |
| No independent security assessment of PHI handling | Platform (therapy, storage) | Critical | Medium     | Internal white-box testing bi-annually; SOC 2 Type II audit                                                                                                            |

---

## 10. Review Cadence

- **Quarterly**: Full dependency inventory review and update
- **Monthly**: Dependabot security updates review
- **Per-release**: New dependency vetting and data-access classification
- **Annual**: Vendor SLA compliance audit
