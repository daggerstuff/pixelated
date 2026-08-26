# S8: Post-Exploitation & Lateral Movement — Test Plan

**Issue:** PIX-4142 — **Status:** 🏃 In Progress **Priority:** 🟡 High (2)  
**Est. Effort:** 3 days **Sprint:** Sprint 6  
**Dependencies:** S3 (Infrastructure scans), S6 (Injection findings), S7
(Multi-tenancy)

---

## 1. Objective

Assess the blast radius of a successful initial compromise — what can an
attacker do after gaining a foothold? This test plan evaluates **privilege
escalation**, **lateral movement**, **data exfiltration**, **persistence
mechanisms**, **container breakout**, **cloud metadata access**, and **pivot
paths**.

---

## 2. Attack Surface Overview

### Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                 │
└──────────────────┬──────────────────────────────┬───────────────┘
                   │                              │
    ┌──────────────▼──────────┐    ┌──────────────▼──────────┐
    │  Astro SSR (port 4321)  │    │   AI Service (port 8002)│
    │  (User-facing website)  │    │   (Raw HTTP, no auth)   │
    └──────┬──────────┬───────┘    └──────────────┬──────────┘
           │          │                           │
    ┌──────▼───┐ ┌────▼────┐           ┌─────────▼─────────┐
    │ Auth0    │ │ Postgres │           │ Pixel API (8001)  │
    │ (SSO)    │ │ (DB)    │           │ (Python FastAPI)  │
    └──────────┘ └─────────┘           └───────────────────┘
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      │                     │                     │
               ┌──────▼──────┐    ┌─────────▼──────┐   ┌─────────▼──────┐
               │ Celery      │    │ Qdrant (Vector) │   │ MinIO (S3)     │
               │ (Workers)   │    │                  │   │ (Storage)      │
               └─────────────┘    └──────────────────┘   └────────────────┘
```

### Auth Boundaries

| Layer             | Mechanism                    | Notes                                    |
| ----------------- | ---------------------------- | ---------------------------------------- |
| User → Astro      | Auth0 + Session tokens       | JWT in httpOnly cookies                  |
| Service → Service | No explicit service auth     | Microservices trust network              |
| AI Service (8002) | **No authentication**        | Raw HTTP server — client IP only         |
| Pixel API (8001)  | `PIXEL_API_KEY` Bearer token | Single shared key                        |
| Postgres          | Network isolation            | No auth on internal network              |
| AWS               | IAM roles (pods)             | Prowler found IAM privesc risk (AWS-002) |

---

## 3. Test Cases

### PE-1: Privilege Escalation (user → admin → super-admin)

**Objective:** From a standard authenticated user session, attempt to elevate to
admin/super-admin roles.

**Test Vectors:**

```http
# Test 1: Role manipulation in JWT
POST /api/auth/session
{"role": "admin", "userId": "attacker-test"}

# Test 2: API endpoint role bypass
GET /api/v1/admin/users
Authorization: Bearer <standard_user_token>

# Test 3: RBAC metadata injection
PATCH /api/auth/profile
{"appMetadata": {"roles": ["admin"]}}

# Test 4: Direct role claim in session
POST /api/auth/session/update
{"claims": {"roles": ["super_admin"]}}
```

**Expected:** Non-admin users get 401/403 on admin endpoints. Role claims from
client are rejected.

### PE-2: Lateral Movement Between Microservices

**Objective:** From a compromised pod/container, probe internal service
endpoints for unprotected access.

**Test Vectors:**

```bash
# Test 1: Probe AI service (no auth)
curl http://ai-service:8002/health
curl -X POST http://ai-service:8002/chat -d '{"messages":[{"role":"user","content":"test"}]}'

# Test 2: Probe Pixel API (behind shared API key)
curl http://pixel-api:8001/status
curl http://pixel-api:8001/infer -H "Authorization: Bearer <leaked_key>"

# Test 3: Probe Celery (Redis/RabbitMQ)
curl http://celery-broker:6379/
curl http://celery-broker:15672/

# Test 4: Probe Qdrant
curl http://qdrant:6333/collections

# Test 5: Probe MinIO
curl http://minio:9000/
```

**Expected:** AI service returns 200 without auth (confirmed — no auth layer).
Pixel API requires API key. Celery, Qdrant, MinIO may be unprotected on internal
network.

### PE-3: Data Exfiltration Vectors

**Objective:** Assess an attacker's ability to extract sensitive data from a
compromised position.

**Test Vectors:**

```bash
# Test 1: Database dump (from compromised pod with DB access)
pg_dump -h postgres-service -U pixelated -d pixelated_production > /tmp/exfil.sql

# Test 2: File download from export endpoint
curl http://astronomer:4321/api/export/download/<export-id>

# Test 3: API scraping — batch session data
curl "http://astronomer:4321/api/sessions?limit=1000"
curl "http://astronomer:4321/api/sessions?offset=1000&limit=1000"

# Test 4: MinIO bucket listing (if credentials leaked)
mc ls pixelated-storage/

# Test 5: Qdrant collection export (vector embeddings may contain PHI)
curl http://qdrant:6333/collections/therapy-sessions/points/export
```

**Expected:** Database exports blocked by network policy. Export endpoint
guarded by `checkExportAccess()`. Session scraping limited by rate limiting +
pagination.

### PE-4: Persistence Mechanisms

**Objective:** Identify ways an attacker could maintain access after initial
compromise.

**Test Vectors:**

- **Backdoor accounts:** Can a user create additional accounts linked to the
  same identity?
- **API token leakage:** Are long-lived API tokens exposed in client-side code,
  logs, or error responses?
- **Webhook persistence:** Can webhooks be configured to exfiltrate data on a
  timer?
- **SSH keys:** Are SSH keys or deployment keys exposed in the container or
  CI/CD artifacts?

**Expected:** API tokens from env vars (not client-side). Webhook creation
requires admin. No SSH keys in containers.

### PE-5: Container Breakout

**Objective:** From a compromised application container, attempt to escape to
the host or access other containers.

**Test Vectors:**

```bash
# Test 1: Check capabilities
capsh --print

# Test 2: Check mount points
mount | grep -E "proc|sys|host"

# Test 3: Check Docker socket access
ls -la /var/run/docker.sock

# Test 4: Check K8s service account token
cat /var/run/secrets/kubernetes.io/serviceaccount/token

# Test 5: Check host PID namespace
ps auxf
```

**Expected:** Containers run with restricted capabilities, no Docker socket
mount, no privileged mode. K8s service account has minimal RBAC permissions.

### PE-6: Cloud Metadata Service Access (IMDS)

**Objective:** From a compromised pod running on AWS, probe the instance
metadata service for IAM credentials.

**Test Vectors:**

```bash
# Test 1: IMDSv1 (no-hop)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Test 2: IMDSv2 (token)
TOKEN=$(curl -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 600")
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ -H "X-aws-ec2-metadata-token: $TOKEN"

# Test 3: ECS container metadata
curl http://169.254.170.2/v2/metadata
curl $AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
```

**Expected:** IMDSv1 disabled (requires IMDSv2). Pod IAM role restricted to
least-privilege. ECS metadata requires explicit mode.

### PE-7: Pivot Paths to Internal Systems

**Objective:** Map the internal network and identify pivot paths to higher-value
targets.

**Test Vectors:**

```bash
# Test 1: Network scan from compromised pod
nmap -sn 10.0.0.0/16

# Test 2: DNS-based service discovery
nslookup postgres-service
nslookup pixel-api-service
nslookup qdrant-service
nslookup minio-service

# Test 3: Internal service probing
for port in 5432 6379 8001 8002 9000 15672 27017 6333; do
  timeout 1 bash -c "echo >/dev/tcp/10.0.0.1/$port" 2>/dev/null && echo "port $port open"
done

# Test 4: K8s API server access
curl https://kubernetes.default.svc/api/v1/namespaces/
```

**Expected:** Network policies restrict inter-service communication. K8s API
requires service account auth. Database ports not exposed beyond their service.

---

## 4. Existing Findings Carried Forward

| Finding                        | Source     | Relevance to S8                                                     | Status     |
| ------------------------------ | ---------- | ------------------------------------------------------------------- | ---------- |
| AWS-001 (Bedrock logging)      | S3 Prowler | Attacker could use compromised IAM to invoke models without audit   | 🟡 Triaged |
| AWS-002 (IAM privesc)          | S3 Prowler | Direct attack path: compromised pod → IAM role abuse → AWS admin    | 🟡 Triaged |
| AWS-003 (CloudWatch retention) | S3 Prowler | Attacker could cover tracks by modifying log retention              | 🟡 Triaged |
| INJ-001 (Prompt injection)     | S6 → Fixed | Post-exploitation: attacker could use AI service for reconnaissance | 🟢 Fixed   |

---

## 5. Deliverables

- [ ] PE-1: Privilege escalation test results
- [ ] PE-2: Lateral movement test results
- [ ] PE-3: Data exfiltration assessment
- [ ] PE-4: Persistence mechanism analysis
- [ ] PE-5: Container breakout assessment
- [ ] PE-6: IMDS access test results
- [ ] PE-7: Internal network pivot map
- [ ] Updated findings register with PE findings
- [ ] Updated dashboard reflecting S8 completion
- [ ] Recommendations for blast radius reduction

---

## 6. Risk Assessment

| Area                       | Risk                                     | Blast Radius                     | Priority  |
| -------------------------- | ---------------------------------------- | -------------------------------- | --------- |
| Service-to-service auth    | 🔴 High — no auth on internal services   | Full internal network            | 🔴 High   |
| AI service exposure        | 🔴 High — no auth layer on port 8002     | AI model access, data in transit | 🔴 High   |
| IAM role scope             | 🟠 Medium — Prowler found privesc path   | AWS account compromise           | 🟠 Medium |
| Container hardening        | 🟡 Medium — depends on K8s config        | Host-level access                | 🟡 Medium |
| Database network isolation | 🟢 Low — presumably network-policy gated | Data loss                        | 🟢 Low    |
| Export access control      | 🟢 Low — ownership check enforced        | Export data                      | 🟢 Low    |

---

_Generated: 2026-07-29 | Executing: Sprint 6 | Owner: Security Lead_
