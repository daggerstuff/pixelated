# HIPAA Compliance Validator

Enterprise-grade HIPAA compliance validation for healthcare data protection. The HIPAA Compliance Validator provides **PHI detection across 18 HIPAA identifier types**, **Fernet AES-256 encryption**, **SQLite audit trail logging**, **compliance scoring**, **violation tracking**, and **reporting** — exposed as a REST API built on FastAPI.

This is a standalone, containerized package suitable for deployment via AWS Marketplace. It performs policy validation and detection only — it does **not** store Protected Health Information (PHI) itself (only cryptographically secure SHA-256 hashes for audit correlation).

---

## Features

| Capability | Description |
| --- | --- |
| **PHI Detection** | Regex-based detection of 18 HIPAA identifier types (SSN, phone, email, birth date, medical record, IP address, address, and more) with per-detection confidence scoring and automatic masking. |
| **Fernet AES-256 Encryption** | PBKDF2-HMAC-SHA256 key derivation (100,000 iterations) with Fernet symmetric authenticated encryption for PHI at rest and in transit. |
| **SQLite Audit Trail** | Persistent audit logging of every PHI access event, violation, and compliance assessment with indexed, queryable tables. |
| **Compliance Scoring** | Weighted scoring (100 → 0) based on violation severity (CRITICAL −20, HIGH −10, MEDIUM −5, LOW −2) mapped to `compliant`, `requires_review`, and `non_compliant` levels. |
| **Violation Tracking** | Automatic recording of unauthorized access, missing encryption, missing audit trail, and other HIPAA violation types with remediation status. |
| **Reporting** | One-call generation of comprehensive compliance reports including recent violations, recommendations, audit-trail completeness, and encryption status. |

---

## Quickstart

### Prerequisites

- Docker and Docker Compose (recommended), **or**
- Python 3.11+ with `pip`

### Run with Docker Compose

```bash
# 1. Clone / enter the package directory
cd hipaa-compliance-validator

# 2. Create your .env file from the template and fill in real secrets
cp .env.example .env
# Edit .env and set HIPAA_ENCRYPTION_PASSWORD and HIPAA_ENCRYPTION_SALT.
# The service will refuse to start without them.

# 3. Build and start the service
docker-compose up --build
```

The API will be available at `http://localhost:8000`. Interactive OpenAPI docs are at `http://localhost:8000/docs`.

### Generate the required secrets

```bash
# Password (32 bytes, URL-safe base64)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Salt (16 bytes, URL-safe base64)
python -c "import secrets; print(secrets.token_urlsafe(16))"
```

### Run locally (without Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install .
export HIPAA_ENCRYPTION_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export HIPAA_ENCRYPTION_SALT="$(python -c 'import secrets; print(secrets.token_urlsafe(16))')"
export HIPAA_DB_PATH="./data/hipaa_compliance.db"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Smoke-test the endpoints

```bash
# Health check
curl -s http://localhost:8000/health | jq

# Detect PHI in text
curl -s -X POST http://localhost:8000/detect-phi \
  -H "Content-Type: application/json" \
  -d '{"data":"Patient John Doe, SSN: 123-45-6789, Phone: (555) 123-4567","context":"intake-form"}' | jq

# Validate a data access event
curl -s -X POST http://localhost:8000/validate/access \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u-123","data":"Email: patient@example.com","context":"lab-results","ip_address":"10.0.0.5","user_agent":"curl/8.0"}' | jq

# Validate data storage (unencrypted PHI will trigger a CRITICAL violation)
curl -s -X POST http://localhost:8000/validate/storage \
  -H "Content-Type: application/json" \
  -d '{"data":"SSN: 987-65-4321","encrypted":false}' | jq

# Validate the audit trail over a date range (ISO-8601)
curl -s "http://localhost:8000/audit-trail?start_date=2024-01-01T00:00:00&end_date=2024-12-31T23:59:59" | jq

# Generate a full compliance report
curl -s http://localhost:8000/report | jq

# Encrypt then decrypt data
ENC=$(curl -s -X POST http://localhost:8000/encrypt \
  -H "Content-Type: application/json" \
  -d '{"data":"super-secret PHI"}' | jq -r .encrypted_data)
echo "$ENC"
curl -s -X POST http://localhost:8000/decrypt \
  -H "Content-Type: application/json" \
  -d "{\"encrypted_data\":\"$ENC\"}" | jq
```

---

## API Reference

All request and response bodies are JSON. Date/time parameters use ISO-8601.

### `POST /validate/access`

Validate a data access event for HIPAA compliance. Detects PHI, logs access to the audit trail, and records any `UNAUTHORIZED_ACCESS` violation.

**Request**
```json
{
  "user_id": "u-123",
  "data": "Patient John Doe, SSN: 123-45-6789, Phone: (555) 123-4567",
  "context": "lab-results",
  "ip_address": "10.0.0.5",
  "user_agent": "curl/8.0"
}
```

**Response** `200 OK`
```json
{
  "is_compliant": true,
  "violations": [],
  "phi_detected": [
    {
      "phi_type": "ssn",
      "value": "123-45-6789",
      "confidence": 0.95,
      "location": "lab-results",
      "masked_value": "***-**-6789"
    }
  ]
}
```

### `POST /validate/storage`

Validate data storage for HIPAA compliance. Unencrypted PHI triggers a `CRITICAL` `LACK_OF_ENCRYPTION` violation.

**Request**
```json
{
  "data": "SSN: 987-65-4321",
  "encrypted": false
}
```

**Response** `200 OK`
```json
{
  "is_compliant": false,
  "violations": [
    {
      "violation_id": "0e1f...",
      "violation_type": "lack_of_encryption",
      "severity": "CRITICAL",
      "description": "PHI stored without encryption",
      "phi_involved": [
        {
          "phi_type": "ssn",
          "value": "987-65-4321",
          "confidence": 0.95,
          "location": "storage",
          "masked_value": "***-**-4321"
        }
      ],
      "timestamp": "2024-06-01T12:00:00+00:00",
      "user_id": null,
      "ip_address": null,
      "remediation_required": true
    }
  ],
  "phi_detected": [
    {
      "phi_type": "ssn",
      "value": "987-65-4321",
      "confidence": 0.95,
      "location": "storage",
      "masked_value": "***-**-4321"
    }
  ]
}
```

### `GET /audit-trail`

Validate audit trail completeness over a date range.

**Query Parameters**
| Name | Type | Description |
| --- | --- | --- |
| `start_date` | string (ISO-8601) | Required. Start of the audit window. |
| `end_date` | string (ISO-8601) | Required. End of the audit window. |

**Example**
```
GET /audit-trail?start_date=2024-01-01T00:00:00&end_date=2024-12-31T23:59:59
```

**Response** `200 OK`
```json
{
  "is_complete": false,
  "issues": [
    "No PHI access logged in specified period"
  ]
}
```

### `GET /report`

Generate a comprehensive HIPAA compliance report covering the last 30 days. Stores an assessment row in the database and returns the full report.

**Response** `200 OK`
```json
{
  "assessment_id": "a1b2...",
  "timestamp": "2024-06-01T12:00:00+00:00",
  "compliance_level": "non_compliant",
  "score": 80.0,
  "violations": [],
  "recommendations": [
    "Address audit trail gaps and failed access attempts"
  ],
  "audit_trail_complete": false,
  "encryption_compliant": true,
  "access_controls_adequate": true
}
```

### `POST /detect-phi`

Detect PHI in arbitrary text without logging or validation. Returns each detection with confidence and a masked representation.

**Request**
```json
{
  "data": "Reach me at patient@example.com or 555-867-5309.",
  "context": "free-text"
}
```

**Response** `200 OK`
```json
{
  "phi_detected": [
    {
      "phi_type": "phone",
      "value": "555-867-5309",
      "confidence": 0.9,
      "location": "free-text",
      "masked_value": "***-***-5309"
    },
    {
      "phi_type": "email",
      "value": "patient@example.com",
      "confidence": 0.9,
      "location": "free-text",
      "masked_value": "pa***@example.com"
    }
  ],
  "count": 2
}
```

### `POST /encrypt`

Encrypt data using Fernet AES-256 authenticated encryption with a PBKDF2-derived key.

**Request**
```json
{
  "data": "Patient lab results: glucose 110 mg/dL"
}
```

**Response** `200 OK`
```json
{
  "encrypted_data": "gAAAAABm..."
}
```

### `POST /decrypt`

Decrypt data previously produced by `POST /encrypt`.

**Request**
```json
{
  "encrypted_data": "gAAAAABm..."
}
```

**Response** `200 OK`
```json
{
  "decrypted_data": "Patient lab results: glucose 110 mg/dL"
}
```

### `GET /health`

Liveness probe used by the Docker `HEALTHCHECK`.

**Response** `200 OK`
```json
{
  "status": "ok",
  "service": "hipaa-compliance-validator",
  "version": "1.0.0"
}
```

---

## Configuration

All configuration is via environment variables. There are **no hardcoded secrets**.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HIPAA_ENCRYPTION_PASSWORD` | **Yes (required)** | _none_ | Master password used with PBKDF2-HMAC-SHA256 (100,000 iterations) to derive the Fernet key. **Must be set or the service will refuse to start.** Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `HIPAA_ENCRYPTION_SALT` | **Yes (required)** | _none_ | Per-deployment salt mixed into the PBKDF2 key derivation. **Must be set or the service will refuse to start.** Generate with `python -c "import secrets; print(secrets.token_urlsafe(16))"`. |
| `HIPAA_DB_PATH` | No | `./data/hipaa_compliance.db` | Path to the SQLite database used for audit logs, violations, and assessments. The parent directory is created automatically. |

> ⚠️ **Key rotation**: changing `HIPAA_ENCRYPTION_PASSWORD` or `HIPAA_ENCRYPTION_SALT` renders previously encrypted ciphertext undecryptable. Re-encrypt existing PHI **before** rotating, and back up the current values.

---

## Security Notes

- **Key derivation**: Encryption keys are never stored. The Fernet key is derived at runtime via PBKDF2-HMAC-SHA256 with 100,000 iterations over a strong password and a unique salt supplied through environment variables. Both values **must** be provided — the application raises a `RuntimeError` at startup if either is missing.
- **No PHI stored**: The audit trail stores only a SHA-256 hash of detected PHI values for correlation, never the raw PHI itself. Detection results returned over the API are the caller's responsibility to protect in transit (use TLS).
- **Authenticated encryption**: Fernet provides both confidentiality and integrity (HMAC over the ciphertext), so tampering with stored ciphertext is detectable on decryption.
- **Secrets management**: In production, inject `HIPAA_ENCRYPTION_PASSWORD` and `HIPAA_ENCRYPTION_SALT` from a secrets manager (AWS Secrets Manager, SSM Parameter Store, Kubernetes Secrets, etc.) rather than embedding them in images or compose files. The `docker-compose.yml` placeholders must be replaced before any production use.
- **Transport security**: Terminate TLS in front of this service (e.g. an Application Load Balancer, API Gateway, or a reverse proxy). The container itself listens on plain HTTP.
- **Least privilege**: Run the container as a non-root user and mount the `./data` volume with the minimum filesystem permissions required for SQLite.
- **Shared responsibility model**: This validator provides tooling for detection, logging, and reporting. It does **not** make your environment HIPAA-compliant on its own. You are responsible for access controls, network security, BAA execution with subcontractors, workforce training, breach notification procedures, and overall risk analysis — the core administrative, physical, and technical safeguards required by the HIPAA Security Rule.

---

## License

Apache-2.0. See [LICENSE](./LICENSE) for the full text.

---

## AWS Marketplace

This package is packaged for listing on **AWS Marketplace** as a container product.

- **Listing type**: Container product (Docker)
- **Delivery**: Amazon ECS (Fargate), Amazon EKS, or AWS App Runner. Also deployable to EC2 with Docker installed.
- **Container image**: Build from the included `Dockerfile` and push to Amazon ECR.
- **Required environment variables**: `HIPAA_ENCRYPTION_PASSWORD`, `HIPAA_ENCRYPTION_SALT` (both **required**), and `HIPAA_DB_PATH` (optional). Configure these via ECS task definition secrets, EKS secrets, or AWS Systems Manager Parameter Store. Do **not** bake secrets into the image.
- **Persistence**: Mount an EBS-backed volume or EFS at `/app/data` to persist the SQLite audit database across container restarts.
- **Health check**: The container exposes `GET /health` on port `8000`; the included Docker `HEALTHCHECK` and ECS health check should target `http://localhost:8000/health`.
- **Networking**: Expose port `8000` behind an Application Load Balancer with HTTPS (ACM certificate). Restrict inbound security group rules to known callers only.
- **Shared responsibility**: As the subscriber you are responsible for the safeguards listed in the *Security Notes* section above. This product helps implement detection and audit controls but is not a substitute for a full HIPAA compliance program.
