---
name: Release 0 dataset (Mental Health)
about: Track Release 0 (manifest + export + gates) for mental-health dataset expansion
labels: datasets, ai, compliance
---

# Release 0: Mental Health Datasets (S3-first) — Checklist → Shippable Release

## Summary
Create the first versioned, S3-canonical dataset release suitable for training: manifest + compiled ChatML export + routing/curriculum config, with privacy/provenance/dedup/leakage/distribution gates.

## Background / references
- PRD: docs/prd/mental-health-datasets-expansion.md
- EPIC: docs/epics/mental-health-datasets-expansion.md
- Runbook: docs/datasets/mental-health-datasets-expansion-repo-map.md
- Release 0 checklist: docs/datasets/release-0-checklist.md
- S3 structure: ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md
- S3 execution plan: ai/training_ready/docs/S3_EXECUTION_ORDER.md

## Scope (Release 0 minimum)

### Minimum dataset families (by stage)
- Stage 1 (foundation): s3://pixel-data/gdrive/processed/professional_therapeutic/ + priority/
- Stage 2 (expertise/reasoning): s3://pixel-data/gdrive/processed/cot_reasoning/
- Stage 3 (edge/case): s3://pixel-data/gdrive/processed/edge_cases/
- Stage 4 (voice/persona): s3://pixel-data/voice/

### Required release artifacts
- Versioned release prefix in S3: s3://pixel-data/exports/releases/vYYYY-MM-DD/
- Release manifest (authoritative)
- Compiled ChatML JSONL export (single or sharded)
- Routing/curriculum config (families → stages/phases + weights)

## Acceptance criteria
- [ ] Manifest exists, references only S3 keys, includes hashes, splits, provenance, and redaction/PII status
- [ ] Export exists and is referenced by manifest
- [ ] Routing/curriculum config exists and matches included families
- [ ] Gates pass (fail closed): privacy, provenance, dedup/leakage, distribution
- [ ] Human signoff recorded: clinician QA (foundation + edge), bias/cultural review (foundation)
- [ ] Training can consume the S3 release end-to-end

## Gates (must pass)
- Privacy: automated PII checks + documented sampling
- Provenance: every shard/record has provenance (family + source key)
- Dedup/leakage: exact + near-dup checks; cross-split leakage checks pass (min: edge + voice)
- Distribution: token/turn stats recorded by family and split

## Implementation notes
- Prefer integrating with existing training_ready scripts/artifacts rather than rewriting.
- Treat local as cache-only; S3 is canonical.

## Tasks
- [ ] Choose release version (vYYYY-MM-DD) and document release prefix
- [ ] Confirm authoritative dataset registry and mapping layer
- [ ] Generate/refresh coverage matrix (required families → present/partial/missing)
- [ ] Build manifest + export in S3 release prefix
- [ ] Run gates and persist gate artifacts/reports
- [ ] Record signoff (who/what sampled/what failed if any)
- [ ] Verify training reads from S3 release
