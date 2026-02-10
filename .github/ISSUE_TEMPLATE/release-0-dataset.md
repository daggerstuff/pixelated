---
name: Release 0 dataset (Mental Health)
about: Track Release 0 (manifest + export + gates) for mental-health dataset expansion
labels: datasets, ai, compliance
---

# Release 0: Mental Health Datasets (S3-first) — Checklist → Shippable Release

## Summary

Create the first versioned, S3-canonical dataset release suitable for training:
manifest + compiled ChatML export + routing/curriculum config, with
privacy/provenance/dedup/leakage/distribution gates.

## Background / references

- PRD: docs/prd/mental-health-datasets-expansion.md
- EPIC: docs/epics/mental-health-datasets-expansion.md
- Runbook: docs/datasets/mental-health-datasets-expansion-repo-map.md
- Release 0 checklist: docs/datasets/release-0-checklist.md
- S3 structure: ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md
- S3 execution plan: ai/training_ready/docs/S3_EXECUTION_ORDER.md

## Scope (Release 0 minimum)

### Minimum dataset families (by stage)

- Stage 1 (foundation):
  s3://pixel-data/gdrive/processed/professional_therapeutic/ + priority/
- Stage 2 (expertise/reasoning):
  s3://pixel-data/gdrive/processed/cot_reasoning/
- Stage 3 (edge/case):
  s3://pixel-data/gdrive/processed/edge_cases/
- Stage 4 (voice/persona):
  s3://pixel-data/voice/

### Required release artifacts

- Versioned release prefix in S3:
  s3://pixel-data/exports/releases/vYYYY-MM-DD/
- Release manifest (authoritative)
- Compiled ChatML JSONL export (single or sharded)
- Routing/curriculum config (families → stages/phases + weights)

## Acceptance criteria

- [ ] - **Manifest Integrity**: Manifest exists in S3 release prefix, references
  only S3 keys, includes SHA-256 hashes, splits (train/val/test),
  provenance (original source), and redaction/PII status.
- [ ] - **Export Format**: Compiled ChatML JSONL export exists, follows
  consistent schema, and is referenced by manifest.
- [ ] - **Curriculum Validation**: Routing/curriculum config exists, matches
  included families, and specifies correct weights for each training stage.
- [ ] - **Automated Gates**: All gates pass (fail closed): Privacy (PII),
  Provenance, Dedup/Leakage (cross-split), and Distribution (token/turn counts).
- [ ] - **Human Protocol**: Human signoff recorded: clinician QA (foundation +
  edge), bias/cultural review (foundation), and ethical safety review.
- [ ] - **End-to-End Test**: `S3DatasetLoader` can successfully load the
  release, and `train_pixel.py` can initialize training using only the S3
  manifest.

## Gates (must pass)

- Privacy: automated PII checks + documented sampling
- Provenance: every shard/record has provenance (family + source key)
- Dedup/leakage: exact + near-dup checks; cross-split leakage checks
  pass (min: edge + voice)
- Distribution: token/turn stats recorded by family and split

## Implementation notes

- Prefer integrating with existing training_ready scripts/artifacts rather
  than rewriting.
- Treat local as cache-only; S3 is canonical.

## Tasks

### 1. Preparation

- [ ] - **Version Definition**: Choose release version (vYYYY-MM-DD) and
  document base S3 prefix.
- [ ] - **Registry Confirmation**: Confirm authoritative dataset registry and
  mapping layer for family-to-S3-path resolution.
- [ ] - **Coverage Refresh**: Generate/refresh coverage matrix (required
  families → present/partial/missing status).

### 2. Implementation

- [ ] - **Consolidation**: Run `sync_datasets.sh` to ensure all source
  families are present in S3 `/processed/` directories.
- [ ] - **Build Manifest**: Run `generate_manifest.py` (or equivalent) to
  create the authoritative release manifest in the release prefix.
- [ ] - **Generate Export**: Compile source data into sharded ChatML JSONL
  files in the release prefix.

### 3. Validation & Signoff

- [ ] - **Privacy Gate**: Run automated PII scanner (Presidio/internal) on
  10% random sample and log results.
- [ ] - **Leakage Check**: Verify no exact or near-duplicate overlaps between
  train/val/test splits.
- [ ] - **Human Review**: Upload review artifacts to S3 and record signoff IDs
  in the manifest metadata.
- [ ] - **Training Verification**: Run a single-step training run using the
  new S3 manifest to ensure end-to-end connectivity.
