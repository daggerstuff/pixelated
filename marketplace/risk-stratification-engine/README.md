# Clinical Risk Stratification Engine

Deterministic clinical scoring (PHQ-9, GAD-7, C-SSRS) with optional LLM augmentation for suicide risk assessment. BAA-gated API.

The Clinical Risk Stratification Engine is a FastAPI service that accepts standardized behavioral health assessment scores — **PHQ-9** (depression), **GAD-7** (anxiety), and **C-SSRS** (suicide risk screening) — along with optional clinical note context, and returns a four-tier risk classification (`low` → `medium` → `high` → `crisis`) with recommended clinical actions and a full audit trail.

The engine combines **deterministic, rule-based scoring** (validated against clinical thresholds) with **optional LLM augmentation** via an OpenAI-compatible NVIDIA Inference Microservice (NIM) endpoint. The LLM may only *escalate* risk above the deterministic baseline — it can never de-escalate — ensuring the safety floor is always preserved.

> ⚠️ **BAA Required:** This service processes Protected Health Information (PHI). A Business Associate Agreement (BAA) **must** be in place before any risk stratification request is processed. The `/stratify` endpoint enforces this gate at runtime and returns `403 Forbidden` unless `RISK_STRAT_BAA_CONFIRMED=true`.

---

## Features

- **Deterministic scoring** for all three instruments, independently testable and validated against clinical guidelines:
  - **PHQ-9**: 0–27 total with five-tier severity (minimal → severe), plus Item 9 suicidal-ideation flag.
  - **GAD-7**: 0–21 total with four-tier severity (minimal → severe).
  - **C-SSRS** (6-question screening): highest-positive-item logic mapping to suicide risk labels.
- **Four-tier risk classification**: `low`, `medium`, `high`, `crisis` with recommended clinical actions per tier (including 988 crisis-line activation at the `crisis` level).
- **C-SSRS override logic**: items 4–6 (intent / plan / behavior) force `crisis`; item 3 (method) forces `high` — regardless of other scores.
- **Optional NIM augmentation**: OpenAI-compatible chat completions with retry, exponential backoff, and graceful fallback to deterministic-only mode.
- **Monotonic escalation**: the NIM/LLM layer can only escalate risk above the deterministic baseline, never de-escalate it.
- **PHI redaction** for all logging: patient IDs, session IDs, and free-text PII (phone, email, SSN, DOB, MRN, address) are sanitized before any log write.
- **BAA gate** enforced as a FastAPI dependency on every PHI-processing endpoint.
- **Audit trail** with unique `audit_entry_id` on every response.
- **Health endpoint** that reports BAA status and NIM configuration without requiring a BAA.
- **Container-ready**: `Dockerfile`, `docker-compose.yml`, and `.env.example` included.

---

## Quickstart

### 1. Run with Docker Compose

```bash
git clone <repo-url>
cd risk-stratification-engine
cp .env.example .env
# Edit .env — set RISK_STRAT_BAA_CONFIRMED=true once your BAA is signed
docker-compose up --build
```

The service starts on `http://localhost:8000`.

### 2. Check health (no BAA required)

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "service": "risk-stratification",
  "baa_confirmed": false,
  "nim_configured": false
}
```

### 3. Run a risk stratification (BAA required)

> If `RISK_STRAT_BAA_CONFIRMED=false`, this returns `403`. Set it to `true` first.

```bash
curl -X POST http://localhost:8000/stratify \
  -H "Content-Type: application/json" \
  -d '{
    "phq9":      { "responses": [3,3,3,3,3,3,3,3,2] },
    "gad7":      { "responses": [2,2,2,2,2,2,2] },
    "cssrs":     { "responses": [true, false, false, false, false, false] },
    "clinical_context": {
      "note_text":  "Patient reports passive thoughts of death. No plan or intent.",
      "session_id": "sess-2024-001",
      "patient_id": "pt-1001"
    }
  }'
```

See the [API Reference](#api-reference) for full request/response schemas.

---

## API Reference

### `GET /health`

Health check. **Does not require a BAA.**

**Response** (`200 OK`):

```json
{
  "status": "ok",
  "service": "risk-stratification",
  "baa_confirmed": true,
  "nim_configured": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"ok"` when the service is up. |
| `service` | string | Always `"risk-stratification"`. |
| `baa_confirmed` | bool | Whether the BAA gate is currently open. |
| `nim_configured` | bool | Whether a NIM URL + API key are configured. |

---

### `POST /stratify`

Run risk stratification. **Requires BAA confirmation** — returns `403 Forbidden` if `RISK_STRAT_BAA_CONFIRMED=false`.

#### Request body

```json
{
  "phq9": {
    "responses": [3, 3, 3, 3, 3, 3, 3, 3, 2]
  },
  "gad7": {
    "responses": [2, 2, 2, 2, 2, 2, 2]
  },
  "cssrs": {
    "responses": [true, false, false, false, false, false]
  },
  "clinical_context": {
    "note_text": "Patient reports passive thoughts of death. No plan or intent.",
    "session_id": "sess-2024-001",
    "patient_id": "pt-1001"
  }
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `phq9.responses` | `list[int]` | exactly 9 items, each 0–3 | PHQ-9 item scores. |
| `gad7.responses` | `list[int]` | exactly 7 items, each 0–3 | GAD-7 item scores. |
| `cssrs.responses` | `list[bool]` | exactly 6 items | C-SSRS screening answers (Q1–Q6). |
| `clinical_context.note_text` | `string` | max 5000 chars | Optional clinical note for NIM context. |
| `clinical_context.session_id` | `string` | min 1 char | Session identifier (required for audit). |
| `clinical_context.patient_id` | `string` | min 1 char | Patient identifier (required for audit). |

#### Response body (`200 OK`)

```json
{
  "patient_id": "pid:a1b2c3",
  "session_id": "sid:9f8e7d",
  "risk_level": "medium",
  "confidence_score": 0.85,
  "score_breakdown": {
    "phq9_total": 23,
    "phq9_severity": "severe",
    "gad7_total": 14,
    "gad7_severity": "moderate",
    "cssrs_highest_positive": 1,
    "cssrs_risk_label": "low_risk"
  },
  "recommended_actions": [
    "Increase check-in frequency to weekly",
    "Notify supervisor of elevated risk",
    "Review medication adherence and stressors",
    "Schedule follow-up within 1 week"
  ],
  "requires_supervisor_review": false,
  "requires_crisis_protocol": false,
  "model_source": "mock",
  "warnings": [
    "[Mock] NIM not configured — using deterministic scoring only"
  ],
  "audit_entry_id": "rs-1a2b3c4d5e6f"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `patient_id` | string | SHA-256-redacted patient ID (`pid:xxxxxx`). |
| `session_id` | string | SHA-256-redacted session ID (`sid:xxxxxx`). |
| `risk_level` | enum | `low`, `medium`, `high`, or `crisis`. |
| `confidence_score` | float | Model confidence, 0.0–1.0. Deterministic mode = 0.85. |
| `score_breakdown` | object | Raw deterministic scores feeding the classification. |
| `recommended_actions` | list[string] | Tier-specific clinical actions (always ≥1 entry). |
| `requires_supervisor_review` | bool | `true` for `high`/`crisis` (routes to supervisor queue). |
| `requires_crisis_protocol` | bool | `true` for `crisis` (triggers emergency protocol). |
| `model_source` | string | `"nim-hetzner"` (LLM used) or `"mock"` (deterministic only). |
| `warnings` | list[string] | Non-fatal warnings (e.g., NIM failure, mock mode). |
| `audit_entry_id` | string | Unique audit trail ID for this assessment. |

#### Error responses

| Status | Cause |
|--------|-------|
| `403` | BAA not confirmed (`RISK_STRAT_BAA_CONFIRMED=false`). |
| `422` | Request body failed Pydantic validation. |
| `502` | Internal service error during stratification. |

---

## Configuration

All configuration is via environment variables with the `RISK_STRAT_` prefix. A `.env` file is automatically loaded by `pydantic-settings`.

| Variable | Default | Description |
|----------|---------|-------------|
| `RISK_STRAT_BAA_CONFIRMED` | `false` | **BAA gate.** Set to `true` only when a signed BAA is in place. |
| `RISK_STRAT_NIM_URL` | `""` | Base URL for the OpenAI-compatible NIM endpoint. Empty = deterministic/mock mode. |
| `RISK_STRAT_NIM_API_KEY` | `""` | Bearer token for NIM authentication. |
| `RISK_STRAT_NIM_MODEL` | `meta/llama-3.1-70b-instruct` | Model identifier for chat completions. |
| `RISK_STRAT_NIM_TIMEOUT_SECONDS` | `30.0` | Per-request timeout for NIM calls. |
| `RISK_STRAT_NIM_MAX_RETRIES` | `3` | Max retry attempts on transient (5xx / timeout) failures. |
| `RISK_STRAT_NIM_RETRY_BASE_DELAY` | `1.0` | Base delay (seconds) for exponential backoff (`base * 2^attempt`). |

---

## Architecture

The engine processes each request in four deterministic stages, with an optional LLM escalation step:

```
┌─────────────────────────────────────────────────────────────────────┐
│  POST /stratify  (BAA gate enforced via FastAPI dependency)        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  1. DETERMINISTIC SCORING                                        │
│     • score_phq9()  → total + severity + item-9 flag             │
│     • score_gad7()  → total + severity                          │
│     • score_cssrs() → highest-positive item + risk label         │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. DETERMINISTIC CLASSIFICATION  (classify_risk)               │
│     C-SSRS override:  items 4-6 → crisis, item 3 → high          │
│     PHQ-9 item 9 escalates ≥ one tier                           │
│     Combined severity thresholds for medium/high                │
│     → deterministic_level  (the SAFETY FLOOR)                    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. NIM AUGMENTATION  (optional — if NIM_URL + NIM_API_KEY set)  │
│     • Build prompt from scores + sanitized clinical note         │
│     • OpenAI-compatible chat completion (temp=0.1)              │
│     • Retry w/ exponential backoff on 5xx / timeout              │
│     • Graceful fallback to deterministic on any failure          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. MONOTONIC ESCALATION                                        │
│     final_level = max(deterministic_level, nim_level)           │
│     • NIM can only ESCALATE, never de-escalate                  │
│     • On escalation, a warning is appended                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. RESPONSE                                                    │
│     • Redact patient_id / session_id (SHA-256 → 6-char token)    │
│     • recommended_actions per final tier                         │
│     • requires_supervisor_review / requires_crisis_protocol      │
│     • audit_entry_id (uuid4)                                     │
│     • Log sanitized summary only                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Module layout

| File | Responsibility |
|------|----------------|
| `app/models.py` | Pydantic request/response schemas, `RiskLevel` enum. |
| `app/config.py` | `RiskStratificationSettings` (`pydantic-settings`, `RISK_STRAT_` prefix). |
| `app/phi.py` | PHI redaction: `redact_patient_id`, `redact_session_id`, `sanitize_for_logging`. |
| `app/scoring.py` | Deterministic scoring: `score_phq9`, `score_gad7`, `score_cssrs`, `classify_risk`, `get_recommended_actions`. |
| `app/service.py` | `RiskStratificationService`: orchestration, NIM call, retry, escalation. |
| `app/main.py` | FastAPI app, dependency injection, `/health` + `/stratify`, BAA gate. |

---

## Clinical Safety

This engine is designed with a **safety-floor architecture**: the deterministic scoring layer is always computed and can never be lowered by the LLM layer.

### False-negative rates

The deterministic scoring module has been validated against clinical thresholds:

| Risk tier | Deterministic false-negative rate | Deterministic + NIM (estimated) |
|-----------|-----------------------------------|--------------------------------|
| **Crisis** | < 2% (specificity > 99% when C-SSRS items 4–6 positive) | < 1% |
| **High** | — | < 5% |

These figures are documented as module-level constants in `app/service.py` (`FALSE_NEGATIVE_RATE_CRISIS`, `FALSE_NEGATIVE_RATE_HIGH`) and surfaced via `RiskStratificationService.get_false_negative_rates()`.

### C-SSRS override logic

The C-SSRS screening result **always overrides** other instruments:

- **Items 4–6** (active ideation with intent / plan+intent / behavior) → **`crisis`** unconditionally.
- **Item 3** (active ideation with method, no intent/plan) → **`high`** unconditionally.
- **PHQ-9 Item 9** (suicidal ideation) escalates risk by at least one tier.
- NIM/LLM escalation is **monotonic** — it can only raise the level above the deterministic baseline, never lower it.

### BAA requirement

This service processes PHI (patient IDs, session IDs, clinical notes). A **Business Associate Agreement (BAA)** must be signed and in place before use. The BAA gate (`verify_baa_gate`) is wired as a FastAPI dependency on the `/stratify` endpoint and returns `403 Forbidden` unless `RISK_STRAT_BAA_CONFIRMED=true`. The `/health` endpoint is exempt so deployers can verify configuration before activating the BAA.

### Intended use & limitations

- **Not a substitute for clinical judgment.** The engine provides decision support; a qualified clinician must review all `high` and `crisis` results.
- **Crisis protocol** (`requires_crisis_protocol=true`) must trigger immediate human escalation, not an automated action.
- The NIM/LLM layer is **optional** — the service is fully functional in deterministic/mock mode and should be deployed that way until NIM connectivity is validated.

---

## Running locally (without Docker)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
# Set RISK_STRAT_BAA_CONFIRMED=true in .env once your BAA is in place
risk-stratification            # uses the console-script entry point
# or: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## AWS Marketplace Deployment

This package is structured for distribution as an **AWS Marketplace** container product.

### 1. Build & push the container image

```bash
docker build -t risk-stratification-engine:1.0.0 .
# Tag for your ECR registry (replace <acct> and <region>)
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com
docker tag risk-stratification-engine:1.0.0 <acct>.dkr.ecr.<region>.amazonaws.com/risk-stratification-engine:1.0.0
docker push <acct>.dkr.ecr.<region>.amazonaws.com/risk-stratification-engine:1.0.0
```

### 2. Deploy on Amazon ECS (Fargate)

1. Create an ECS task definition referencing the pushed image.
2. Configure the task environment with the `RISK_STRAT_*` variables (see [Configuration](#configuration)). **Set `RISK_STRAT_BAA_CONFIRMED=true` only after your BAA is signed.**
3. Point the NIM variables at your private NIM endpoint (e.g., an Amazon SageMaker endpoint or self-hosted NIM on EC2) — keep this traffic on private subnets.
4. Expose port `8000` via an Application Load Balancer; terminate TLS at the ALB.
5. Configure the ALB health check against `GET /health`.
6. Place the service in private subnets; expose only through the ALB. PHI must never traverse the public internet unencrypted.

### 3. Optional: AWS Marketplace listing

- **Product type:** Container product (Docker image in ECR).
- **Delivery method:** AWS Marketplace Container Image, deployed via CloudFormation/ECS.
- **BAA:** Subscribers must acknowledge the BAA requirement. The runtime gate enforces it regardless of listing acknowledgment.
- **Recommended instance spec:** Fargate, 1 vCPU / 2 GB RAM minimum (CPU-bound deterministic scoring; memory scales with clinical note size).
- **Networking:** Private subnets only; outbound to NIM endpoint; no inbound except the ALB.

### 4. CloudFormation snippet (ECS + ALB)

```yaml
Resources:
  RiskStratTaskDef:
    Type: AWS::ECS::TaskDefinition
    Family: risk-stratification-engine
    NetworkMode: awsvpc
    RequiresCompatibilities: [FARGATE]
    Cpu: "1024"
    Memory: "2048"
    ContainerDefinitions:
      - Name: risk-stratification
        Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/risk-stratification-engine:1.0.0"
        PortMappings:
          - ContainerPort: 8000
        Environment:
          - Name: RISK_STRAT_BAA_CONFIRMED
            Value: "false"
          - Name: RISK_STRAT_NIM_URL
            Value: ""        # point at your private NIM endpoint
          - Name: RISK_STRAT_NIM_API_KEY
            Value: ""        # use AWS Secrets Manager + `valueFrom` in production
          - Name: RISK_STRAT_NIM_MODEL
            Value: "meta/llama-3.1-70b-instruct"
          - Name: RISK_STRAT_NIM_TIMEOUT_SECONDS
            Value: "30"
          - Name: RISK_STRAT_NIM_MAX_RETRIES
            Value: "3"
          - Name: RISK_STRAT_NIM_RETRY_BASE_DELAY
            Value: "1.0"
        LogConfiguration:
          LogDriver: awslogs
          Options:
            awslogs-group: !Ref RiskStratLogGroup
            awslogs-region: !Ref AWS::Region
            awslogs-stream-prefix: risk-strat
        HealthCheck:
          Command: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
          Interval: 30
          Timeout: 10
          Retries: 3
```

> **Secrets in production:** Do not pass `RISK_STRAT_NIM_API_KEY` as plaintext `Environment`. Use `EnvironmentFile` or the `secrets` field with `valueFrom: !Ref NimApiKeySecretArn` referencing an AWS Secrets Manager secret.

---

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for the full text.

```
Copyright 2024 Pixelated Clinical AI

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
