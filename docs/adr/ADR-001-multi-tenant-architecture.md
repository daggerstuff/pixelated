# ADR-001: Multi-Tenant Database Architecture & Compliance

**Status**: Accepted  
**Date**: 2025-06-06  
**Author**: Backend Platform Engineer

## Context

Pixelated Empathy is a B2B SaaS clinical simulation platform serving healthcare
education institutions (medical schools, nursing programs, teaching hospitals).
The platform must:

- Support multiple institutions (tenants) on shared infrastructure
- Enforce strict data isolation between tenants
- Comply with HIPAA requirements (zero PHI stored)
- Support metered billing (seats, simulation hours, inference tokens)
- Provide immutable audit trails for SOC 2 / ISO 27001 certification
- Be operationally efficient to manage

## Decision 1: Tenant Isolation — Row-Level Security (RLS)

**Chosen**: Row-Level Security (RLS) with a shared PostgreSQL schema  
**Rejected**: Schema-per-tenant

### Rationale

| Criteria               | RLS (Shared Schema)              | Schema-per-Tenant                   |
| ---------------------- | -------------------------------- | ----------------------------------- |
| Isolation strength     | Strong (row-level policies)      | Strongest (separate tables)         |
| Migration complexity   | Single migration for all tenants | Must migrate N schemas              |
| Connection pooling     | Efficient (one pool)             | Poor (many schemas)                 |
| Cross-tenant analytics | Possible with tenant_id filter   | Requires union across schemas       |
| Operational overhead   | Low                              | High (schema management per tenant) |
| Row count scaling      | Requires good indexing           | Naturally partitioned               |
| Tenant data deletion   | Soft delete + RLS policy         | Schema drop                         |

**Verdict**: RLS provides sufficient isolation for healthcare training data
(which is not PHI per our zero-PHI design). Schema-per-tenant adds operational
complexity without proportional security benefit. We use PostgreSQL native RLS
with `tenant_id` column on every tenant-scoped table.

### Implementation

- Every tenant-scoped table has a `tenant_id UUID NOT NULL` column
- An RLS policy `tenant_isolation_policy` is applied:
  `(tenant_id = current_setting('app.tenant_id')::UUID)`
- The `app.tenant_id` is set at connection/session start after JWT
  authentication
- A `bypass_rls` role exists for system admin operations (audited separately)

## Decision 2: Authentication — JWT with Session Tokens

**Chosen**: JWTs for stateless auth + short-lived refresh tokens  
**Rejected**: Session-only (stateful)

### Rationale

- JWTs allow stateless tenant context propagation to the DB session
- `current_setting('app.tenant_id')` is set from JWT claims on each request
- Short TTL (15 min access tokens, 7-day refresh tokens) balances security and
  UX
- Refresh tokens stored hashed in DB (not PHI)

## Decision 3: Authorization — RBAC with Role Hierarchy

**Chosen**: Role-Based Access Control with hierarchy (Institution Admin →
Manager → Educator → Learner)  
**Rejected**: ABAC (Attribute-Based, too complex for initial version)

### Roles

| Role                | Scope  | Permissions                                    |
| ------------------- | ------ | ---------------------------------------------- |
| `super_admin`       | Global | System configuration, all-tenants read         |
| `institution_admin` | Tenant | User management, billing, analytics            |
| `manager`           | Tenant | Scenario creation, persona config, user groups |
| `educator`          | Tenant | Run simulations, view learner results          |
| `learner`           | Tenant | Participate in simulations only                |

## Decision 4: Encryption Strategy

**Chosen**: Layered encryption — TLS 1.3 in-transit + AES-256 at-rest +
application-level field encryption for sensitive metadata  
**Rejected**: Single-layer encryption

### At-Rest (PostgreSQL)

- PostgreSQL TDE (Transparent Data Encryption) via filesystem/dm-crypt or
  cloud-native encryption (RDS/Aurora encrypted storage)
- Application-level encryption for any PII-adjacent fields (email, name) using
  pgcrypto with `pgp_sym_encrypt()`

### In-Transit

- TLS 1.3 minimum for all API and database connections
- Certificate pinning for internal service-to-service communication
- mTLS for inter-service RPC (Celery workers ↔ API)

### Key Management

- Cloud KMS (AWS KMS / GCP Cloud KMS) for master keys
- Envelope encryption: data keys encrypted with master key, stored alongside
  data
- Key rotation: automatic every 90 days for data keys, manual for master keys
  (with grace period)

## Decision 5: Zero-PHI Compliance

**Chosen**: Multi-layer deterministic guard design  
**Rejected**: Relying solely on developer discipline

### Guard Layers

1. **Schema-level enforcement**: No PHI-specific columns (SSN, DOB, diagnosis
   codes) in schema design. Character set validation on all text fields.
2. **Input sanitization middleware**: Regex patterns strip common PHI patterns
   (email, phone, SSN, MRN) from **simulation content and free-text fields**
   (messages, scenario descriptions, persona prompts) before storage. Rejects
   with 400 if PHI detected. Structured identity fields encrypted per Decision 4
   (email_ciphertext, display_name) are explicitly exempt from this middleware.
3. **Output scan on API responses**: Response middleware scans for residual PHI
   patterns post-render.
4. **Audit trail**: Any detection event is logged with timestamp, endpoint,
   tenant, and action taken.
5. **Pre-commit CI check**: Automated scanner in CI pipeline flags any DDL or
   code containing PHI field patterns.
6. **Periodic scan**: Weekly cron job scans stored data for PHI pattern matches.

### PHI Pattern Detection

```python
PHI_PATTERNS = {
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "email": r"\b[\w\.-]+@[\w\.-]+\.\w+\b",
    "phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    "mrn": r"(?i)\b(mrn|medical.?record)\s*[:#]?\s*\d{4,10}\b",
}
```

## Decision 6: Audit Log — Append-Only with Hash Chain

**Chosen**: Immutable append-only audit log with cryptographic hash chaining  
**Rejected**: Simple timestamped log (mutable, no integrity verification)

### Design

- `audit_log` table is INSERT-only (no UPDATE, no DELETE)
- TRIGGER prevents any UPDATE/DELETE on the table (via `RAISE EXCEPTION`)
- Each row includes a `prev_hash` pointing to SHA-256 of the previous row
- Periodically compute merkle root for integrity verification
- Fields: `id`, `tenant_id`, `actor_id`, `actor_role`, `action`,
  `resource_type`, `resource_id`, `payload (JSONB)`, `ip_address`, `user_agent`,
  `created_at`, `prev_hash`, `row_hash`

## Decision 7: Metering — Event-Driven Ingestion

**Chosen**: Event-driven metering with idempotent processing  
**Rejected**: Synchronous metering (couples billing to critical path)

### Design

- Metering events emitted asynchronously (Celery task or message queue)
- Idempotency key per event prevents double-counting
- Three metering dimensions:
  - **Seats**: Count of active licensed users per billing period
  - **Simulation Hours**: Wall-clock time of active simulation sessions (sampled
    every 60s)
  - **Inference Tokens**: Token count per LLM inference call (summed per
    session)
- Daily rollup job aggregates raw events into billing-period summaries
- Stale event handling: events older than 24h are rejected

## Consequences

### Positive

- RLS with shared schema enables efficient operations and simple migrations
- Zero-PHI guard layers provide defense-in-depth without relying on developer
  discipline
- Immutable audit log with hash chains supports SOC 2 audit requirements
- Event-driven metering keeps simulation critical path lean
- Layered encryption covers all compliance requirements

### Negative

- RLS adds query planning overhead (PostgreSQL evaluates policy on every row)
- Hash-chain audit log requires careful archive/rotation planning
- Zero-PHI guards may require tuning to avoid false positives
- Metering is eventually consistent (24h window for stale events)

### Mitigations

- RLS performance: benchmark with realistic data volumes, use `security_barrier`
  policies, monitor query plans
- Audit log: partition by month, archive partitions older than 7 years
- PHI guard tuning: maintain allowlist for legitimate clinical terms that match
  PHI patterns
- Metering: provide near-real-time estimates via in-memory counters +
  reconciliation from event store

## Related Decisions

- ADR-002 (pending): Service architecture (Flask vs FastAPI)
- ADR-003 (pending): Celery task queue configuration
- ADR-004 (pending): LLM inference pipeline integration
