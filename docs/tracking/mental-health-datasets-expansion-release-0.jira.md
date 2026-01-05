# Jira tracking: Mental Health Datasets Expansion — Release 0

This file contains Jira-ready drafts: 1 Epic + Stories/Tasks.

## Epic

**Issue type**: Epic

**Summary**: EPIC — Release 0: Mental Health Datasets (S3-first) ready for training

**Description**:
Deliver the first versioned, S3-canonical dataset release suitable for training: manifest + compiled ChatML export + routing/curriculum config, with privacy/provenance/dedup/leakage/distribution gates.

**References**:
- PRD: docs/prd/mental-health-datasets-expansion.md
- EPIC doc: docs/epics/mental-health-datasets-expansion.md
- Runbook: docs/datasets/mental-health-datasets-expansion-repo-map.md
- Release 0 checklist: docs/datasets/release-0-checklist.md
- S3 structure: ai/training_ready/docs/S3_TRAINING_DATA_STRUCTURE.md
- S3 execution plan: ai/training_ready/docs/S3_EXECUTION_ORDER.md

**Definition of done**:
- Release prefix exists in S3 for vYYYY-MM-DD
- Manifest exists with hashes, splits, provenance, redaction/PII status
- Compiled ChatML export exists and is referenced by manifest
- Routing/curriculum config exists and matches included families
- Gates pass (privacy, provenance, dedup/leakage, distribution)
- Human signoff recorded: clinician QA (foundation + edge), bias/cultural review (foundation)
- Training can consume the S3 release end-to-end

---

## Stories / Tasks

### Story 1 — Coverage matrix from S3 inventory
**Issue type**: Story
**Summary**: Release 0 — Build coverage matrix from S3 inventory
**Description**:
Generate a coverage report mapping required dataset families (Release 0 minimum) to S3 evidence paths, marking present/partial/missing.

**Acceptance criteria**:
- Coverage report exists for the chosen release version
- Required families list matches Release 0 checklist
- Output references S3 prefixes/keys

**Labels**: datasets, s3, provenance

---

### Story 2 — Create versioned release artifacts
**Issue type**: Story
**Summary**: Release 0 — Generate versioned manifest + compiled export in S3
**Description**:
Create the versioned release prefix and publish the release manifest + compiled export (single or sharded).

**Acceptance criteria**:
- Release prefix exists in S3
- Manifest includes families, keys, hashes, splits, provenance, redaction/PII status
- Export is referenced by manifest

**Labels**: datasets, s3, release

---

### Story 3 — Privacy + provenance gates (fail closed)
**Issue type**: Story
**Summary**: Release 0 — Enforce privacy and provenance gates
**Description**:
Ensure Release 0 cannot be produced if provenance is missing or PII gates fail.

**Acceptance criteria**:
- Provenance gate blocks release on missing provenance
- PII gate implemented with automated checks + sampling protocol
- Gate artifacts stored with the release

**Labels**: privacy, provenance, compliance

---

### Story 4 — Dedup + leakage gates
**Issue type**: Story
**Summary**: Release 0 — Run dedup and cross-split leakage gates
**Description**:
Run exact + near-duplicate scans and cross-split leakage checks, at minimum for edge/case and voice/persona families.

**Acceptance criteria**:
- Exact-dup and near-dup reports produced
- Leakage checks pass for holdout-sensitive families
- Artifacts stored with the release

**Labels**: datasets, qa, compliance

---

### Story 5 — Distribution reporting gate
**Issue type**: Story
**Summary**: Release 0 — Record distribution stats by family and split
**Description**:
Produce token/turn/length distribution stats by dataset family and split.

**Acceptance criteria**:
- Stats exist by family and split
- Thresholds or expected ranges documented
- Artifacts stored with the release

**Labels**: datasets, qa

---

### Story 6 — Human QA signoff
**Issue type**: Story
**Summary**: Release 0 — Clinician QA + bias/cultural review signoff
**Description**:
Record human review signoff for Release 0: clinician QA sampling (foundation + edge) and bias/cultural review (foundation).

**Acceptance criteria**:
- Review notes include reviewers, sample sizes, rubric, exceptions
- Signoff recorded with release version

**Labels**: qa, bias, compliance

---

### Story 7 — Training consumption smoke test
**Issue type**: Task
**Summary**: Release 0 — Smoke test training consumes S3 release artifacts
**Description**:
Verify training can consume the S3-hosted release manifest/export end-to-end without local file dependencies.

**Acceptance criteria**:
- Training run or dry-run loads release by S3 prefix
- Env prerequisites documented
- Failure modes documented

**Labels**: ai, s3, release
