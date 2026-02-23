# Release 0 Checklist (Mental Health Datasets Expansion)

**Purpose**: One-page run sheet to produce the first versioned, S3-canonical dataset release suitable for training.

**Last updated**: 2025-12-29

## 0) Preconditions

- [ ] You have S3 access to the canonical bucket (OVH S3-compatible)
- [ ] You are using S3-first behavior (training reads from S3, local is cache-only)
- [ ] No secrets are committed or printed in logs

## 1) Minimum required dataset families (by stage)

Source: `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`

### Stage 1 — Foundation
- [ ] At least one dataset exists under `s3://pixel-data/gdrive/processed/professional_therapeutic/`
- [ ] At least one dataset exists under `s3://pixel-data/gdrive/processed/priority/`

### Stage 2 — Therapeutic expertise / reasoning
- [ ] At least one dataset exists under `s3://pixel-data/gdrive/processed/cot_reasoning/`

### Stage 3 — Edge / crisis stress test
- [ ] At least one dataset exists under `s3://pixel-data/gdrive/processed/edge_cases/`

### Stage 4 — Voice/persona
- [ ] Persona assets exist under `s3://pixel-data/voice/`

## 2) Release artifact locations

- [ ] Pick a release version (example): `vYYYY-MM-DD`
- [ ] Write down the release prefix (example): `s3://pixel-data/exports/releases/vYYYY-MM-DD/`

## 3) Required artifacts (must exist)

### Manifest (authoritative)
- [ ] Release manifest exists in S3 under the release prefix
- [ ] Manifest includes:
  - [ ] dataset families included
  - [ ] S3 object keys per shard
  - [ ] integrity hashes
  - [ ] split assignments (train/val/test)
  - [ ] provenance fields (family + source key)
  - [ ] redaction/PII status fields

### Compiled export
- [ ] ChatML JSONL export exists (single or sharded)
- [ ] Export is referenced by the manifest

### Routing / curriculum config
- [ ] A versioned routing/curriculum config exists for the release
- [ ] Config maps families → stages/phases and weights

## 4) Gates (must pass; fail closed)

### Privacy gate
- [ ] Automated PII checks pass
- [ ] Sampling-based check performed (record the sample size and method)

### Provenance gate
- [ ] Every included shard/record has provenance
- [ ] Any missing provenance blocks the release

### Dedup + leakage gate
- [ ] Exact duplicate scan completed
- [ ] Near-duplicate / leakage scan completed
- [ ] Cross-split leakage checks pass for holdout-sensitive families (at minimum: edge/case and voice)

### Distribution gate
- [ ] Turn/token distribution stats recorded by family and split
- [ ] Any regressions are explained or release is blocked

## 5) Human review & signoff

- [ ] Clinician QA sampling reviewed for:
  - [ ] foundation family
  - [ ] edge/case family
- [ ] Bias/cultural competency report reviewed for:
  - [ ] foundation family
- [ ] Release decision recorded (version + included families + known exclusions)

## 6) Post-release verification

- [ ] Training code can consume the release artifact from S3 end-to-end
- [ ] Release notes updated in the PRD/EPIC references

## References

- PRD: `docs/prd/mental-health-datasets-expansion.md`
- EPIC: `docs/epics/mental-health-datasets-expansion.md`
- Repo map/runbook: `docs/datasets/mental-health-datasets-expansion-repo-map.md`
- S3 canonical structure: `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- S3 execution plan: `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
