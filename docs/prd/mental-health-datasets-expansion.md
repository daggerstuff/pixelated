# PRD: Mental Health Datasets Expansion (S3-First, Training-Ready)

**Owner**: Pixelated Empathy

**Status**: Draft (consolidated from specs + repo reality)

**Last updated**: 2025-12-29

## 0) Executive summary

We are expanding Pixelated’s mental-health training datasets into a **compliance-safe, S3-canonical, training-ready pipeline** that supports:

- **High-quality therapeutic conversation SFT** across major modalities (CBT/DBT/ACT/EMDR/IFS/MI/psychodynamic/etc.)
- **Clinical reasoning / structured reasoning data** (when appropriate and compliant)
- **Voice/persona training** (notably Tim Fletcher-style instructional persona)
- **Crisis and edge-case robustness** (suicidality, psychosis, OCD, BPD, PTSD/CPTSD, addiction, etc.)
- **Auditable provenance + privacy guardrails** with “HIPAA++” posture and zero tolerance for PII leakage

This PRD merges the target end-state defined in:
- `.claude/specs/mental-health-datasets-expansion/{requirements.md,design.md,tasks.md}`

…with the operational reality and recently-maintained pipeline assets, especially:
- `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
- `ai/training_ready/packages/apex/data/final.md`
- `ai/dataset_pipeline/storage_config.py`

## 1) Problem statement

We need a **reliable, scalable, compliant** way to:

1. Ingest mental-health domain sources (approved transcripts, academic/clinical content, structured therapy examples)
2. Remove PII *while preserving clinically-relevant context* (crisis language and clinical meaning must remain intact)
3. Validate clinically, culturally, and ethically (bias monitoring + clinician QA)
4. Compile and publish a **training-ready dataset artifact** and **curriculum plan**
5. Run model training from a canonical, centralized source of truth: **S3**

Current pain points (consolidated):
- Data and intermediate artifacts can drift across local folders / drive / S3 if not treated as canonical.
- Dataset families exist in multiple formats with unclear authority (“final”, “ultimate”, etc.).
- Privacy/compliance and provenance must be enforced end-to-end.
- We need a roadmap that reflects both the spec’s desired architecture and what’s already built in `ai/training_ready`.

## 2) Goals

### G1 — S3 as canonical source-of-truth
- All training datasets (raw → processed → compiled exports) are stored in S3 and referred to by S3 keys.
- Local files are cache or dev-only artifacts; training reads from S3.

### G2 — End-to-end dataset pipeline
- Implement or wire a pipeline that produces:
  - a **manifest** (inventory + metadata + hashes + split assignment)
  - a **compiled export** (ChatML JSONL) suitable for training
  - **quality gates** (dedup, leakage checks, distribution stats, PII checks)

### G3 — Mental-health dataset expansion
- Expand and structure dataset families:
  - Modality-specific therapy examples
  - Voice/persona datasets (Tim Fletcher transcription + style modeling)
  - Dual persona training data
  - Crisis/edge-case generator outputs (“nightmare fuel” expansions, but with strict privacy)
  - Long-running therapy session formats (multi-turn, long context)

### G4 — Compliance, safety, and auditability
- Provide provenance and audit logs for datasets and transformations.
- Implement PII removal that preserves clinical meaning.
- Ensure “deny by default” handling for unsafe sources.

## 3) Non-goals (explicit)

- Building a public dataset release (this is internal training data).
- Collecting or storing any unapproved private clinical notes.
- Treating “unrestricted” as permission to violate privacy or legal compliance.
- Rewriting the entire existing training_ready toolchain (we will integrate and extend, not replace).

## 4) Users & stakeholders

- **Dataset engineer**: needs deterministic ingest/transform/compile steps and visibility into coverage.
- **ML engineer / trainer**: needs stable dataset artifacts, routing configs, and a curriculum plan.
- **Clinical reviewers**: needs QA workflows, sampling, and escalation paths.
- **Compliance / security**: needs provenance, audit trails, redaction, and access controls.
- **Product**: needs success metrics tied to user experience and safety.

## 5) Definitions

- **Dataset family**: a named bundle of data with shared purpose and provenance (e.g., “voice/tim_fletcher_transcripts”).
- **Manifest**: the authoritative metadata/index pointing to all dataset shards and splits.
- **Compiled export**: a single or sharded ChatML JSONL derived from the manifest.
- **S3-first**: training and compilation logic prefer S3; local usage is cache-only.

## 6) Current state (what exists today)

### 6.1 S3 canonical structure and staging reality

`ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md` defines the intended canonical layout:

- Primary bucket: `pixel-data` (OVH S3-compatible)
- Staging inputs: Google Drive → `gdrive/raw/` → processed canonical `gdrive/processed/`
- Training stage mapping:
  - Stage 1 foundation: therapeutic dialogue corpora
  - Stage 2 expertise: reasoning/clinical reasoning sets
  - Stage 3 edge stress: crisis and edge-case sets
  - Stage 4 voice persona: persona datasets and transcripts

### 6.2 S3-first execution flow exists (as a plan)

`ai/training_ready/docs/S3_EXECUTION_ORDER.md` provides a dependency-aware plan:
- implement S3 loader
- wire S3 into source/process/assemble scripts
- generate manifest path mapping
- run end-to-end verification and update documentation

### 6.3 Training-ready “final dataset + curriculum audit” work exists

`ai/training_ready/packages/apex/data/final.md` documents a high-signal “final dataset artifact” effort:
- Coverage inventory and routing config
- A dataset contract doc
- Deduplication and leakage prevention work
- Compilation/upload to S3
- A 2025 curriculum design (continued pretraining → SFT curriculum → preference alignment)

This is strong evidence that a large portion of the “training-ready artifact” path is already implemented.

### 6.4 Dataset pipeline storage is configurable for S3-compatible backends

`ai/dataset_pipeline/storage_config.py` provides:
- backend selection (`DATASET_STORAGE_BACKEND` = local/s3/gcs)
- OVH/AWS-compatible env var support
- output root defaults to `<workspace>/tmp/dataset_pipeline` (runtime artifacts)

This supports integrating the spec’s architecture with practical storage.

## 7) Target outcomes (end-state)

### 7.1 Canonical dataset artifacts

For each dataset release version (e.g., `vYYYY-MM-DD`):
- **Manifest** stored in S3, including:
  - dataset family mapping
  - provenance fields
  - hashes / integrity
  - split assignments
  - PII/redaction status
- **Compiled ChatML export** stored in S3:
  - either a single JSONL (if size allows) or sharded JSONL

### 7.2 Coverage and quality gates

We produce and persist:
- Coverage matrix (required families → present/partial/missing)
- Token/turn-length distributions by family and by split
- Exact + near-dup dedup metrics
- Cross-split leakage checks (especially for long-session + edge-case holdouts)
- PII checks summary (with deny-by-default remediation workflow)

### 7.3 Training curriculum configuration

A versioned training curriculum that routes dataset families into phases:
- Continued pretraining
- SFT curriculum by stage (foundation → long sessions → edge/crisis → voice/persona → simulator tasks)
- Preference alignment (DPO/ORPO/SimPO/KTO depending on available preference data)

## 8) Functional requirements (consolidated)

> These are consolidated from the spec set and aligned to the existing S3-first/training-ready pipeline.

### FR-1: Data sourcing
- Support acquiring and ingesting:
  - approved transcripts (including Tim Fletcher transcription)
  - academic/clinical educational materials with licensing/provenance tags
  - structured therapy modality examples
  - generator-produced edge-case scenarios

### FR-2: Privacy & redaction
- PII removal with context preservation:
  - remove direct identifiers
  - preserve crisis language and clinical meaning
  - record redaction status per record
  - provide audit logs of transformations

### FR-3: Clinical validation and QA
- Provide QA sampling sets per family:
  - clinician review workflow
  - pass/fail rubric
  - escalation path for disallowed content

### FR-4: Bias and cultural competency validation
- Integrate bias detection and monitoring:
  - detect demographic stereotyping
  - verify cultural sensitivity constraints
  - produce bias monitoring reports

### FR-5: Dataset assembly and routing
- Assemble training-ready outputs:
  - stage mapping (foundation/expertise/edge/voice)
  - weights/routing for the curriculum
  - deterministic splits and holdouts

### FR-6: Voice/persona and dual-persona
- Produce voice/persona datasets and dual-persona sets:
  - consistent style modeling
  - explicit safety constraints
  - provenance to transcript sources and synthetic generator parameters

### FR-7: Crisis / “nightmare fuel” expansion (privacy-first)
- Generate high-value crisis/edge-case scenarios:
  - suicidal ideation / self-harm
  - psychosis and delusional content
  - addiction relapse cycles
  - domestic violence and mandated reporting contexts

This requirement is *not* permission to include PII; it increases the need for robust privacy handling.

### FR-8: S3-first operations
- Training scripts read datasets from S3 canonical locations.
- Pipeline scripts can compile to S3 and remove local copies when configured.

## 9) Non-functional requirements

### NFR-1: Security and compliance
- No secrets committed or logged.
- Treat inputs as sensitive; minimize logs; avoid PII in logs.
- Audit trails for transformations, access, and dataset releases.

### NFR-2: Performance
- Streaming reads for JSONL from S3.
- Batch operations for large objects; avoid full in-memory loads.

### NFR-3: Reliability and reproducibility
- Deterministic builds:
  - versioned manifests
  - pinned dataset routing config
  - stable hashes

### NFR-4: Maintainability
- Modular pipeline components with clear interfaces.
- Minimal coupling across acquisition/processing/validation/assembly.

## 10) Proposed architecture (aligned to spec)

### Layers
1. Acquisition layer: connectors for sources + ingestion
2. Processing layer: normalization, redaction, segmentation, labeling
3. Validation layer: clinical QA, bias detection, safety checks
4. Assembly layer: split assignment, routing config, compilation
5. Storage + registry layer: S3 canonical layouts + dataset registry
6. Training interface: Lightning/H100 and other training scripts reading from S3

### Component interfaces (conceptual)
- PII removal engine
- Clinical validation engine
- Bias detection system
- Voice/persona pipeline
- Crisis training generator
- Dataset assembler + compiler

## 11) Data governance

### Provenance
- Every output record must trace to:
  - source family
  - source object key (S3 key)
  - transformation versions

### Licensing / permissions
- Deny by default if licensing/provenance is absent.

### Access control
- Restrict buckets and keys by environment.
- Prefer pre-signed URLs for controlled access.

## 12) Success metrics

### Dataset metrics
- Coverage completion: % required dataset families present with valid provenance
- Leakage: zero cross-split leakage for holdout families
- PII: zero confirmed PII escapes in final exports (validated by sampling + automated checks)

### Model metrics (high-level)
- Improved helpfulness and appropriateness in therapeutic roleplay evaluations
- Reduced hallucinated clinical claims
- Improved crisis response evaluation results

## 13) Risks and mitigations

- **Risk**: PII leakage
  - Mitigation: deny-by-default, multi-stage redaction, sampling gates, blocked release on failures
- **Risk**: Dataset drift / conflicting “final” artifacts
  - Mitigation: manifest is authoritative; versioning and explicit release process
- **Risk**: Overfitting to synthetic crisis
  - Mitigation: holdouts + distribution targets + diverse sources
- **Risk**: Legal/licensing uncertainty
  - Mitigation: provenance required; quarantine pipeline for uncertain sources

## 14) Delivery milestones (high-level)

- M1: Coverage inventory + canonical registry alignment
- M2: PII-redaction + provenance enforcement gates
- M3: Clinical/bias QA reports integrated
- M4: Voice/persona + dual persona datasets built and validated
- M5: Crisis/edge-case expansions built and validated
- M6: Final dataset artifact + curriculum + S3 upload versioned release

## 14.1) Release 0 (minimum viable dataset release) checklist

**Intent**: Define the smallest versioned dataset release we are willing to train from, while still meeting privacy/compliance expectations and enabling meaningful model iteration.

### Release 0 scope (minimum required dataset families)

These are the baseline families implied by the existing S3 canonical structure and stage mapping in `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`.

### Stage 1 — Foundation (therapeutic dialogue)
- `s3://pixel-data/gdrive/processed/professional_therapeutic/` (at least one high-quality therapeutic conversation family)
- `s3://pixel-data/gdrive/processed/priority/` (at least one priority JSONL present)

### Stage 2 — Therapeutic expertise / reasoning
- `s3://pixel-data/gdrive/processed/cot_reasoning/` (at least one CoT/reasoning dataset present)

### Stage 3 — Edge / crisis stress test
- `s3://pixel-data/gdrive/processed/edge_cases/` (at least one edge/case dataset present)

### Stage 4 — Voice/persona
- `s3://pixel-data/voice/` (at minimum: a persona profile and a conversation set)

### Release 0 artifacts (must exist)

#### Authoritative release directory in S3
- A versioned prefix (example): `s3://pixel-data/exports/releases/vYYYY-MM-DD/`

#### Manifest
- A release manifest containing:
  - dataset families included
  - S3 object keys per shard
  - hashes
  - split assignments (train/val/test)
  - provenance fields
  - redaction/PII status fields

#### Compiled export
- ChatML JSONL export (single or sharded) referenced by the manifest.

#### Routing / curriculum config
- A versioned configuration mapping dataset families → phases/stages and weights.

### Release 0 gates (must pass; fail closed)

#### Privacy gate
- No confirmed PII escapes in final exports (automated checks + sampling).

#### Provenance gate
- Every included shard/record has provenance (source family + source key). Missing provenance blocks the release.

#### Dedup + leakage gate
- Exact-dup and near-dup checks run.
- Cross-split leakage checks pass for holdout-sensitive families (at minimum: edge/case and voice).

#### Distribution gate
- Basic distribution stats recorded (turn counts/tokens) by family and split; regressions are visible and explainable.

### Release 0 signoff checklist (human)

- Clinician QA sampling reviewed for at least: foundation and edge/case families
- Bias/cultural competency report reviewed for at least: foundation family
- Release decision recorded with version, included families, and known exclusions

## 15) Open questions

- What is the current authoritative “dataset registry” location for all training stages (confirm whether `ai/data/dataset_registry.json` is the canonical version)?
- Which preference alignment algorithm is the initial target (DPO vs ORPO vs KTO) based on available preference-pair data?
- What is the formal signoff process for clinician QA (who, how many reviewers, sampling size)?
- Which sources are approved for Tim Fletcher transcription and how is licensing recorded?

## 16) References

- `.claude/specs/mental-health-datasets-expansion/requirements.md`
- `.claude/specs/mental-health-datasets-expansion/design.md`
- `.claude/specs/mental-health-datasets-expansion/tasks.md`
- `ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md`
- `ai/training_ready/docs/S3_EXECUTION_ORDER.md`
- `ai/training_ready/packages/apex/data/final.md`
- `ai/dataset_pipeline/storage_config.py`
