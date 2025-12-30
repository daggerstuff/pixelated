# Mental Health Datasets Expansion: Repo Map & Runbook (S3-First)

**Purpose**: Practical map of where the dataset expansion and training-ready work lives, plus an operational “what to run / what to verify” checklist.

**Last updated**: 2025-12-29

## 1) Big picture

Canonical flow:

- Source/staging (e.g., Google Drive) → sync to S3 bucket
- S3 becomes **single source of truth**
- Pipeline reads from S3 → produces processed artifacts + manifests + compiled exports
- Training reads from S3 release artifacts

## 2) Key locations in this workspace

### Specs and plans (target end-state)

- `.claude/specs/mental-health-datasets-expansion/requirements.md`
- `.claude/specs/mental-health-datasets-expansion/design.md`
- `.claude/specs/mental-health-datasets-expansion/tasks.md`

### Training-ready pipeline and S3 documentation (operational reality)

- `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
  - Canonical S3 bucket structure and stage mapping
- `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
  - Dependency-aware execution order and checklist
- `ai/training_ready/packages/apex/data/final.md`
  - Final dataset artifact + curriculum audit notes and evidence pointers

### Dataset pipeline code (integration target)

- `ai/dataset_pipeline/`
  - This is where the spec’s modular architecture implies “source → processing → validation → assembly” components should live.
- `ai/dataset_pipeline/storage_config.py`
  - Storage backend selection and S3-compatible configuration via environment variables.

### Training scripts

- `ai/lightning/`
  - Lightning.ai-related training scripts and assets (verify which scripts are currently authoritative before modifying).

### Workspace note

The `ai/` directory may be a separate git repository nested inside the broader workspace. Treat cross-repo changes carefully.

## 3) S3 canonical structure (high-level)

The canonical bucket described in `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md` is centered on:

- `pixel-data` bucket (OVH S3-compatible)
- `gdrive/raw/` (mirror/staging backup)
- `gdrive/processed/` (canonical “training-ready” structure)
- Additional top-level prefixes for platform-specific datasets such as `lightning/`, `voice/`, and `dual_persona/`.

## 4) Environment variables (no secrets)

### Storage backend selection

- `DATASET_STORAGE_BACKEND` = `local` | `s3` | `gcs`

### OVH S3 (preferred if using OVH)

- `OVH_S3_BUCKET`
- `OVH_S3_REGION`
- `OVH_S3_ENDPOINT`
- `OVH_S3_ACCESS_KEY`
- `OVH_S3_SECRET_KEY`

### AWS S3 fallback (supported)

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Local output override (optional)

- `DATASET_PIPELINE_OUTPUT_DIR`
- `DATASET_STORAGE_LOCAL_PATH`

## 5) Operational checklist (S3-first)

### Step A — Access sanity

Verify:
- Python environment is available
- S3 credentials are configured
- You can list the bucket/prefix you expect

### Step B — Inventory and mapping

Goal:
- Confirm what exists in S3
- Build a coverage matrix mapping required dataset families to S3 evidence

Expected outputs (examples):
- coverage report JSON
- dataset routing config

### Step C — Build the release artifact

Goal:
- Produce a versioned dataset release:
  - manifest (authoritative index)
  - compiled ChatML JSONL export (single or sharded)

### Step D — Verification gates

Goal:
- Fail closed if any gate fails:
  - provenance missing
  - PII check failure
  - leakage/dedup regression
  - distribution anomalies outside thresholds

### Step E — Curriculum

Goal:
- Route dataset families into training phases:
  - continued pretraining
  - SFT curriculum (staged)
  - preference alignment

## 6) What “done” looks like (artifact checklist)

A release is considered ready when:
- Manifest + compiled export exist in S3 under a versioned release prefix
- Coverage report shows required families present (or explicitly waived)
- PII/provenance gates pass
- Dedup and cross-split leakage gates pass
- Bias/QA reports are produced and reviewed

For a one-page run sheet version of this, see: `docs/datasets/release-0-checklist.md`.

## 7) Suggested conventions

- Treat manifests as authoritative.
- Avoid ambiguous labels (“ultimate/final”) without a versioned manifest.
- Prefer “deny by default” for missing provenance/licensing.
- Keep local artifacts as cache-only unless explicitly needed for dev.
