# GitHub tracking: Mental Health Datasets Expansion — Release 0

This file contains copy/paste-ready GitHub issue drafts (1 EPIC + child issues) based on:
- docs/prd/mental-health-datasets-expansion.md
- docs/epics/mental-health-datasets-expansion.md
- docs/datasets/release-0-checklist.md

## Suggested GitHub Project (manual setup)

Create a GitHub Project (v2) named:
- **Mental Health Datasets Expansion**

Suggested fields:
- **Status**: Todo / In Progress / Blocked / Done
- **Milestone**: M1..M6
- **Dataset Release Version**: vYYYY-MM-DD
- **Risk**: Low/Med/High
- **Owner**

Suggested views:
- Board by Status
- Table by Milestone
- Table by Risk

## Labels

Recommended labels to create/use:
- `datasets`
- `ai`
- `compliance`
- `privacy`
- `provenance`
- `qa`
- `bias`
- `s3`
- `release`

---

## Issue 1 (EPIC): Release 0 dataset (manifest + export + gates)

**Title**: EPIC: Release 0 — Mental Health Datasets (S3-first) ready for training

**Labels**: datasets, ai, compliance, s3, release

**Body**:

### Summary
Ship the first versioned, S3-canonical dataset release suitable for training: manifest + compiled ChatML export + routing/curriculum config, with privacy/provenance/dedup/leakage/distribution gates.

### References
- PRD: docs/prd/mental-health-datasets-expansion.md
- EPIC: docs/epics/mental-health-datasets-expansion.md
- Runbook: docs/datasets/mental-health-datasets-expansion-repo-map.md
- Release 0 checklist: docs/datasets/release-0-checklist.md
- S3 structure: docs/prd/mental-health-datasets-expansion.md#61-s3-canonical-structure-and-staging-reality
- S3 execution plan: docs/prd/mental-health-datasets-expansion.md#62-s3-first-execution-flow-exists-as-a-plan

### Acceptance criteria
- Manifest exists, references only S3 keys, includes hashes, splits, provenance, and redaction/PII status
- Compiled ChatML export exists and is referenced by manifest
- Routing/curriculum config exists and matches included families
- Gates pass (fail closed): privacy, provenance, dedup/leakage, distribution
- Human signoff recorded: clinician QA (foundation + edge), bias/cultural review (foundation)
- Training can consume the S3 release end-to-end

### Child issues
- [ ] Inventory + coverage matrix (S3 truth)
- [ ] Manifest + export build (versioned release prefix)
- [ ] Gates: PII + provenance
- [ ] Gates: dedup + leakage
- [ ] Gates: distribution reporting
- [ ] Human QA signoff + release notes
- [ ] Training consumption smoke test

---

## Issue 2: Inventory + coverage matrix (S3 truth)

**Title**: Release 0: Build coverage matrix from S3 inventory

**Labels**: datasets, s3, provenance

**Body**:

### Summary
Produce a coverage report mapping required dataset families (Release 0 minimum) to S3 evidence paths, marking present/partial/missing.

### Acceptance criteria
- Coverage report exists and is versioned with the release
- Required family list matches Release 0 checklist
- Output clearly lists S3 prefixes/keys used for each family

---

## Issue 3: Manifest + export build (versioned release)

**Title**: Release 0: Generate versioned manifest + compiled ChatML export in S3

**Labels**: datasets, s3, release

**Body**:

### Summary
Create the versioned release prefix (vYYYY-MM-DD) and publish the release manifest + compiled export (single or sharded).

### Acceptance criteria
- Release prefix exists in S3
- Manifest includes: families, keys, hashes, splits, provenance, redaction/PII status
- Export is referenced by manifest

---

## Issue 4: Privacy + provenance gates

**Title**: Release 0: Enforce privacy and provenance gates (fail closed)

**Labels**: privacy, provenance, compliance

**Body**:

### Summary
Ensure Release 0 cannot be produced if provenance is missing or PII gates fail.

### Acceptance criteria
- Provenance gate blocks release on missing provenance
- PII gate implemented with automated checks + sampling protocol recorded
- Gate outputs/reports are stored with the release artifacts

---

## Issue 5: Dedup + leakage gates

**Title**: Release 0: Run dedup and cross-split leakage gates

**Labels**: datasets, qa, compliance

**Body**:

### Summary
Run exact + near-duplicate scans and cross-split leakage checks, at minimum for edge/case and voice/persona families.

### Acceptance criteria
- Exact-dup and near-dup reports produced
- Leakage checks pass for holdout-sensitive families
- Report artifacts stored with the release

---

## Issue 6: Distribution reporting gate

**Title**: Release 0: Record distribution stats by family and split

**Labels**: datasets, qa

**Body**:

### Summary
Produce token/turn/length distribution stats by dataset family and split, with a regression-friendly format.

### Acceptance criteria
- Stats exist by family and split
- Thresholds or “expected ranges” are documented
- Artifacts stored with the release

---

## Issue 7: Human QA signoff + release notes

**Title**: Release 0: Clinician QA + bias/cultural review signoff

**Labels**: qa, bias, compliance

**Body**:

### Summary
Record human review signoff for Release 0: clinician QA sampling (foundation + edge) and bias/cultural review (foundation).

### Acceptance criteria
- Review notes include: reviewers, sample sizes, pass/fail rubric, exceptions
- Signoff recorded with the release version

---

## Issue 8: Training consumption smoke test

**Title**: Release 0: Smoke test training consumes S3 release artifacts

**Labels**: ai, s3, release

**Body**:

### Summary
Verify training scripts can consume the S3-hosted release manifest/export end-to-end without local file dependencies.

### Acceptance criteria
- Training run (or dry-run) loads release by S3 prefix
- Any environment prerequisites are documented
- Failure modes and mitigations are documented
