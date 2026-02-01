# requirements.md

> ⛔ **ABSOLUTE PROHIBITION: No Stubs or Filler Logic.** Every implementation MUST be complete and production-ready—no `pass`, `...`, `TODO`, `NotImplementedError`, placeholder returns (`return True`, `return []`), or mock implementations disguised as real code. If a feature cannot be fully implemented, it must not be committed.

## 1. System Architecture Overview

```
+-------------------+        +-------------------+        +-------------------+
|   Ingestion Layer | --->   |  Preprocessing    | --->   |  Crisis Detection |
| (API/Storage)     |        |  Pipeline         |        |  Engine           |
+-------------------+        +-------------------+        +-------------------+
          |                         |                           |
          v                         v                           v
+-------------------+        +-------------------+        +-------------------+
|  S3 Raw Store     |        |  Unified Preproc  |        |  EARS Gate        |
|  (OVH S3 Endpoint)|        |  Pipeline         |        |  (Sensitivity ≥95%)|
+-------------------+        +-------------------+        +-------------------+
          |                         |                           |
          v                         v                           v
+-------------------+        +-------------------+        +-------------------+
|  Processed Store  | <----  |  Data Splitter    | <----  |  Synthetic        |
|  (Clean Datasets) |        |  (70/15/15 Split) |        |  Generator        |
+-------------------+        +-------------------+        +-------------------+
          \                         |                           /
           \                        v                           /
            \                      +-------------------+           /
             \                      | Synthetic Wrapper |          /
              \                     | (10k therapeutic   |         /
               \                    |  + 5k bias)         |        /
                \                   +-------------------+        /
                 \                          |                       /
                  \                         v                      v
                   \                        +-------------------+  +-------------------+
                    \                       |  Unified API     |  |  Monitoring &    |
                     \                      |  Service Layer   |  |  Alerting Layer  |
                      \                     +-------------------+  +-------------------+
                       \                                 |
                        \                                v
                         \                        +-------------------+
                          \                       |  Governance &    |
                           \                      |  Compliance      |
                            \                     +-------------------+

```

**Components Overview**
1. **Ingestion Layer** – entry points for academic sources, YouTube transcripts, book files, and direct uploads. Uses OAuth2 client credentials to access external APIs.
2. **Preprocessing Pipeline** – normalization, language detection, schema validation, and cleaning; outputs a unified parquet schema.
3. **Crisis Detection Engine** – statistical outlier detection + rule‑based triggers; produces crisis flags.
4. **EARS Gate** – enforces ≥95 % sensitivity on crisis flags; raises alerts if confidence <0.95.
5. **Synthetic Generator** – populates two buckets: `therapeutic` (10 k samples) and `bias` (5 k samples) using templated LLM prompts.
6. **Data Splitter** – deterministic 70/15/15 split using seeded shuffling; writes `train/`, `val/`, `test/` partitions to S3.
7. **S3 Persistence** – all intermediate and final datasets are persisted to the OVH S3 endpoint `/s3/data-lake` with versioned prefixes.
8. **Synthetic Wrapper** – exposes a single REST/GraphQL endpoint that returns metadata and signed URLs for all generated artifacts.
9. **Monitoring & Alerting** – background worker publishes progress to Redis; alerts emitted via email/Slack on EARS failures or pipeline stalls.
10. **Governance & Compliance** – immutable audit log (append‑only) stored alongside datasets; checksum validation on every write.

---

## 1.5 Code Quality Mandate: No Stubs or Filler Logic

> ⚠️ **CRITICAL POLICY** — This applies to ALL implementations.

**Stubs, placeholder code, and filler logic are ABSOLUTELY PROHIBITED.** Every function, class, and module must be:

1. **Fully Implemented** — No `pass`, `...`, `TODO`, or `NotImplementedError` in production code
2. **Production-Ready** — Code must handle real-world inputs, edge cases, and errors
3. **Tested** — Every implementation must have corresponding unit/integration tests
4. **Documented** — Clear docstrings and type annotations required

**Examples of PROHIBITED patterns:**
```python
# ❌ PROHIBITED: Stub function
def process_data(records):
    pass  # TODO: implement later

# ❌ PROHIBITED: Filler logic
def validate_input(data):
    return True  # Always returns True

# ❌ PROHIBITED: Placeholder
def generate_samples(count: int) -> List[Sample]:
    raise NotImplementedError("Coming soon")
```

**Examples of REQUIRED patterns:**
```python
# ✅ REQUIRED: Complete implementation
def process_data(records: List[RawRecord]) -> List[ProcessedRecord]:
    """Process raw records through the unified pipeline.
    
    Args:
        records: Raw input records from ingestion layer
        
    Returns:
        Processed records ready for quality gates
        
    Raises:
        ValidationError: If records fail schema validation
    """
    validated = [r for r in records if validate_schema(r)]
    normalized = normalize_text_batch(validated)
    return [ProcessedRecord.from_raw(r) for r in normalized]
```

**Enforcement:**
- CI/CD pipelines MUST fail on detection of stub patterns
- Code reviews MUST reject PRs containing filler logic
- Static analysis (`pylint`, `ruff`) configured to flag violations

---

## 2. Data Models & Structures

| Entity | Fields (JSON Schema) | Description |
|--------|----------------------|-------------|
| **RawRecord** | `source: string`, `url: string?`, `file_path: string?`, `metadata: object`, `checksum: string` | Represents a single input artifact before any transformation. |
| **ProcessedRecord** | `record_id: uuid`, `source: string`, `cleaned_text: string`, `embeddings: array<float>`, `features: object`, `checksum: string` | Canonical representation after preprocessing; stored as parquet. |
| **CrisisSignal** | `record_id: uuid`, `score: float`, `reason: string`, `timestamp: iso8601` | Output of crisis detection; attached to `ProcessedRecord`. |
| **SyntheticSample** | `sample_id: uuid`, `type: enum['therapeutic','bias']`, `content: string`, `generated_at: iso8601`, `prompt_hash: string` | LLM‑generated content; linked to source `record_id`. |
| **SplitManifest** | `split: enum['train','val','test']`, `records: array<uuid>` | JSON file describing which `record_id`s belong to each partition; persisted per split. |
| **AuditLogEntry** | `event: string`, `actor: string`, `timestamp: iso8601`, `payload: object`, `hash: string` | Immutable append‑only log for governance. |

All persisted objects are written as **versioned parquet** files with schema‑enforced columns; a `manifest.json` accompanies each directory describing the schema version.

---

## 3. API Specifications

### 3.1 Public REST Endpoint (Synthetic Wrapper)

```
POST /v1/generate
{
  "source_ids": ["uuid-1","uuid-2",...],
  "bias_factor": 0.25,
  "template": "clinical_trial_design"
}
Response:
{
  "job_id": "job-abc123",
  "status": "queued",
  "generated_samples": 15000,
  "s3_prefix": "s3://<bucket>/synthetic/job-abc123/"
}
GET /v1/status/{job_id}
Response:
{
  "job_id": "job-abc123",
  "progress": 42,
  "completed": false,
  "s3_prefix": "s3://<bucket>/synthetic/job-abc123/"
}
GET /v1/artifacts/{job_id}
Response:
{
  "therapeutic_url": "s3://.../therapeutic/*.parquet",
  "bias_url": "s3://.../bias/*.parquet",
  "manifest_url": "s3://.../manifests/job-abc123.json"
}
```

### 3.2 Internal Python Functions (Signature)

```python
def ingest(source: str, source_type: Literal["academic","youtube","book","s3"]) -> List[RawRecord]:
def preprocess(records: List[RawRecord]) -> List[ProcessedRecord]:
def split_data(records: List[ProcessedRecord], output_prefix: str) -> SplitManifest:
def detect_crisis(records: List[ProcessedRecord]) -> List[CrisisSignal]:
def ears_gate(signals: List[CrisisSignal]) -> Tuple[bool, float]:  # (allow_continue, confidence)
def generate_synthetic(signals: List[CrisisSignal],
                       n_therapeutic: int = 10_000,
                       n_bias: int = 5_000,
                       template: str = "default") -> List[SyntheticSample]:
def persist_to_s3(obj: Union[ProcessedRecord, SyntheticSample], prefix: str) -> None:
```

All public functions must be **type‑annotated**, **doc‑stringed**, and **unit‑tested** (≥1 test per function).

---

## 4. UI Requirements (Monitoring Dashboard)

- **Tech Stack:** React 18 + TypeScript + Material‑UI + Recharts.
- **Key Views:**
  1. **Pipeline Overview** – Gantt‑style timeline of stages, current status, and ETA.
  2. **Crisis Dashboard** – list of detected crisis signals, confidence scores, and research‑trigger button.
  3. **Synthetic Queue** – pending/received jobs, sample counts, and S3 bucket preview.
  4. **Audit Log** – searchable immutable log with filter by actor/event.
- **Authentication:** OAuth2 token (JWT) stored in HttpOnly cookie; role‑based access (viewer / admin).
- **Authentication Integration:** Calls `/v1/status/{job_id}` and `/v1/artifacts/{job_id}` behind token proxy.
- **Responsiveness:** Mobile‑first layout, auto‑refresh every 15 s, manual refresh button.

---

## 5. Performance Expectations

| Metric | Target | Measurement Tool |
|--------|--------|-------------------|
| **Ingestion Throughput** | ≥ 5 k records/min | Custom loader benchmark |
| **Preprocessing Latency** | ≤ 50 ms per record | `time.perf_counter` around pipeline step |
| **Crisis Detection Sensitivity** | ≥ 95 % on validated crisis set | Offline evaluation on 2 k labelled samples |
| **Synthetic Gen. Output Rate** | ≥ 1 k samples/min on CPU; ≥ 5 k samples/min on GPU | `nvidia-smi` + custom logger |
| **End‑to‑End Batch (100 k records)** | ≤ 30 min | `benchmark.py` script |
| **S3 Write Throughput** | ≥ 200 MB/s sustained | `aws s3 cp --dry-run` performance test |
| **API Latency** | 95th‑percentile ≤ 200 ms | `locust` load test |

All performance tests must be run on the target OVH node (`eu-west-1`) with the provided SSD storage; results are saved as `performance_report.json` in the repo root.

---

## 6. Security Considerations

1. **Credential Management** – All secrets (OVH S3 credentials, API keys) loaded via `.env` and **never** committed. Use `python-dotenv` with `load_dotenv().env_path = Path(__file__).parent / ".env"`.
2. **Input Validation** – Strict JSON‑Schema validation on every incoming RawRecord; reject any record with malformed checksum or unexpected source enumeration.
3. **S3 Bucket Policy** – Bucket ACL set to `private`; read/write only via IAM user with least‑privilege policy (`s3:PutObject`, `s3:GetObject` only on `data-lake/` prefix). Enable **Object Lock** for audit‑log immutability.
4. **Audit Logging** – Every mutation writes an `AuditLogEntry` to `s3://<bucket>/audit/` with SHA‑256 hash of payload; logs are immutable (Object Lock with retention 90 days).
5. **CORS & CSP** – Public API restricts Origins to `https://*.myorg.com`; Content‑Security‑Policy header blocks inline scripts.
6. **Vulnerability Scanning** – Nightly `bandit` and `safety` scans; failures abort CI pipeline.

---

## 7. Integration Requirements

| External System | Integration Point | Protocol / Library |
|---------------|-------------------|--------------------|
| **Google Scholar / Semantic Scholar** | Academic source import | `scholarx` Python client |
| **YouTube Data API** | Transcript harvesting | `google-api-python-client` with `youtube.transcripts.list` |
| **PubMed / arXiv** | Bibliographic metadata | `pmc` / `arxiv` Python packages |
| **OVH S3** | Raw / processed / synthetic storage | `minio` client (compatible with S3 API) |
| **Ray Cluster** | Distributed execution of preprocessing & synthetic generation | `ray` >= 2.9, `@ray.remote` decorators |
| **Redis** | Progress & heartbeat publishing | `redis-py` |
| **Slack / Email** | Alerting on EARS failures | `slack_bolt` / `smtplib` (templated) |
| **GitHub** | CI/CD automation (tests, lint, build) | GitHub Actions workflow (`.github/workflows/ci.yml`) |

All integration modules must be **wired‑in via dependency injection** so they can be swapped for mocks during unit testing.

---

## 7. Governance & Compliance Checklist

- [ ] **Schema Versioning** – Every parquet directory contains `schema_version.json` (semantic versioning).
- [ ] **Checksum Verification** – SHA‑256 of each file stored in `manifest.json`; verified on read.
- [ ] **Retention Policy** – Raw data retained 90 days; processed & synthetic data retained 365 days; audit logs retained 1 year.
- [ ] **Data Use Agreement** – All downstream consumers must sign a usage agreement referencing the `ACADEMIC_REUSE` clause.
- [ ] **Export Controls** – No export of data to prohibited jurisdictions; verify via `CountryCode` metadata.
- [ ] **Documentation** – Auto‑generated MkDocs site (`mkdocs serve`) served at `https://docs.myorg.com/pipeline` on every merge to `main`.

---

*End of Specification*

*All paths referenced are relative to the repository root; absolute paths must be resolved at runtime using `BASE_DIR = Path(__file__).resolve().parent`.*