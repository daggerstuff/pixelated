# EPIC: Mental Health Datasets Expansion (S3-First → Training-Ready)

**Epic owner**: Pixelated Empathy

**Status**: Draft

**Last updated**: 2025-12-29

## 1) Epic summary

Deliver an end-to-end dataset expansion and training-ready pipeline for Pixelated’s mental-health domain training, using **S3 as the canonical source of truth**, with strict privacy/compliance, provenance, QA, and a versioned training curriculum.

This EPIC is explicitly designed to match:
- the target spec architecture in `.claude/specs/mental-health-datasets-expansion/`
- the operational S3-first pipeline approach in `ai/training_ready/`

## 2) Scope

### In scope
- S3-first dataset inventory, registry alignment, and routing configs
- PII removal + provenance enforcement
- Clinical validation, bias detection reporting hooks, and QA sampling flows
- Voice/persona and dual persona dataset expansion
- Crisis/edge-case expansion with privacy-first gating
- Final dataset artifact compilation (manifest + ChatML export) and upload to canonical S3 paths
- Training curriculum configs and stage routing

### Out of scope
- Production model serving changes (unless required for dataset monitoring)
- Publishing datasets publicly
- Collecting unapproved private clinical data

## 3) Ground-truth references

- Canonical S3 layout and stage mapping: `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- S3-first execution plan: `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
- Training-ready “final dataset + curriculum audit”: `ai/training_ready/packages/apex/data/final.md`
- Dataset pipeline storage config (S3-compatible): `ai/dataset_pipeline/storage_config.py`
- Target architecture/tasks: `.claude/specs/mental-health-datasets-expansion/{requirements.md,design.md,tasks.md}`

## 4) Milestones and deliverables

### M1 — Inventory + registry alignment (coverage truth)
**Outcome**: A single, authoritative view of what exists in S3 and how it maps to dataset families/stages.

### Primary deliverables
- Coverage matrix report (required families → present/partial/missing)
- Canonical dataset registry alignment and stage mapping
- S3 key prefix conventions documented (processed vs raw vs platform-specific)

### Where this likely lives
- Existing: `ai/training_ready/` has manifest + audit artifacts and scripts
- Integration target: `ai/dataset_pipeline/` can host the “source-of-truth mapping” and validation interfaces

### Acceptance criteria
- Coverage report generated from S3 inventory and versioned
- Registry explicitly points to S3 canonical keys (not local paths)

### M2 — Privacy + provenance gates (release blockers)
**Outcome**: No dataset can be released without PII/provenance gates passing.

### Primary deliverables
- PII removal pipeline step with context-preserving redaction
- Provenance model (per-record and per-shard)
- Audit log artifacts for each release

### Where this likely lives
- Target: `ai/dataset_pipeline/processing/` and `ai/dataset_pipeline/compliance/`

### Acceptance criteria
- Release build fails “closed” when provenance missing
- Release build fails “closed” on PII gate failures

### M3 — Clinical QA + bias/cultural competency validation
**Outcome**: Clinicians can review sampled outputs; bias reports produced per family and per release.

### Primary deliverables
- QA sampling sets by dataset family
- Rubric-based review template and decision log format
- Bias monitoring report generation integrated into the build

### Where this likely lives
- Target: `ai/dataset_pipeline/qa/` and `ai/dataset_pipeline/validation/`

### Acceptance criteria
- QA sample export produced for each release
- Bias report produced for each release

### M4 — Voice/persona and dual persona datasets
**Outcome**: Persona training datasets exist as first-class families with provenance and holdouts.

### Primary deliverables
- Tim Fletcher transcription ingestion + normalization
- Voice/persona training set creation
- Dual persona training set creation

### Where this likely lives
- Existing evidence: S3 voice keys described in `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- Target: `ai/dataset_pipeline/voice/`

### Acceptance criteria
- Persona dataset family has deterministic build and versioned manifest
- Holdout split exists for persona validation

### M5 — Crisis/edge-case expansion ("nightmare fuel", privacy-first)
**Outcome**: Crisis/edge-case scenarios are expanded and validated without privacy regressions.

### Primary deliverables
- Crisis scenario generator(s)
- “Resulting chats” generator outputs (for realistic multi-turn behavior)
- Safety/QA gating and holdout splits

### Where this likely lives
- Target: `ai/dataset_pipeline/crisis/` and `ai/dataset_pipeline/safety/`

### Acceptance criteria
- Crisis dataset families produced with provenance
- Leakage and dedup gates pass with crisis holdouts

### M6 — Final dataset artifact + curriculum (versioned releases)
**Outcome**: A single authoritative release artifact exists in S3: manifest + compiled ChatML export + curriculum configs.

### Primary deliverables
- Manifest + compiled export uploaded to canonical S3 paths
- Curriculum config mapping families → phases and weights
- Verification reports (coverage, leakage, distribution)

### Where this likely lives
- Existing evidence: compilation and curriculum artifacts referenced in `ai/training_ready/packages/apex/data/final.md`

### Acceptance criteria
- Versioned release directory exists in S3
- Training can consume the release without local dependencies

## 5) Work breakdown (with “exists vs build” annotations)

### Existing/high-signal assets to integrate
- S3 canonical structure doc and stage mapping: `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- S3-first execution roadmap: `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
- Final dataset contract/dedup/compile/curriculum work: `ai/training_ready/packages/apex/data/final.md`
- Storage configuration for S3-compatible endpoints: `ai/dataset_pipeline/storage_config.py`

### Build / wire tasks (expected)
- Implement/standardize streaming S3 JSON/JSONL loader as a shared utility
- Align dataset registry to canonical S3 keys and versioning conventions
- Formalize provenance schema and enforce “deny by default” when missing
- Add release-gating verification steps and artifacts
- Add QA sampling and review workflows
- Expand persona + dual persona datasets with holdouts
- Expand crisis/edge-case generation with privacy gating

## 6) Definition of done

This EPIC is done when:
- A versioned dataset release exists in S3 with manifest + compiled export
- Coverage + dedup/leakage + PII/provenance + bias reports all pass
- Training consumes S3 release artifact end-to-end
- Documentation clearly explains S3-first flow and repo locations

## 7) Suggested next actions (immediate)

- Confirm which dataset registry file is authoritative today.
- Decide whether this EPIC’s “single source of truth” is:
  - `ai/training_ready/data/s3_manifest.json` (inventory)
  - plus a registry mapping layer that becomes the canonical routing config
- Choose the first release target version and define minimum required dataset families for “Release 0”.

See the PRD’s Release 0 checklist for the proposed minimum families, required artifacts, and gates.
