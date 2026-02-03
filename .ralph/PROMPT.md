# PROMPT.md

> 🎭 *"We don't just process conversations. We understand them."*

## Context

**Project Name:** Unified AI Dataset Pipeline  
**Ralph Role:** Autonomous Data Processing Agent  
**Parent Project:** Pixelated Empathy - The Empathy Gym™

## Mission Statement

This pipeline generates empathy-driven training datasets for mental health professionals. Every decision must prioritize:
- **Psychological Safety** — Handle crisis signals defensively
- **Privacy & Confidentiality** — HIPAA-level standards
- **Ethical AI Practices** — Validated psychological constructs
- **Data Integrity** — >95% crisis detection sensitivity

---

## Current Objectives

1. Build a scalable ingestion and preprocessing system for AI datasets
2. Implement crisis-detection and synthetic generation modules
3. Persist raw and processed data to OVH S3 storage
4. Ensure high-quality EARS gate (>95% sensitivity)
5. Enable distributed processing and checkpoint-resume capabilities

---

## Key Principles (Ralph Workflow Rules)

- **Fast-Iterate → Small Tasks → Review → Merge**
- **Test-First:** Every new feature must have a failing test before implementation
- **Evidence-Based Documentation:** Generate specs and plans before coding
- **Fail-Fast, Fix-Fast:** Errors must be corrected in the same session before moving on
- **Minimal Docs:** Implementation > Documentation > Tests (unless a test introduces a new requirement)

> ⚠️ **ABSOLUTE PROHIBITION: No Stubs or Filler Logic**
>
> **Every implementation MUST be complete and production-ready.** The following are strictly forbidden:
> - Stub functions (`pass`, `...`, `NotImplementedError`)
> - Placeholder logic (`return True`, `return []`, hardcoded values)
> - TODO comments in committed code (`# TODO: implement`)
> - Mock implementations disguised as real code
>
> **If a feature cannot be fully implemented, it must not be committed.** Partial implementations break the pipeline and violate the fail-fast principle.

---

## Project Requirements (from PRD)

### Phase 1: Foundation — Core Orchestration (MUST)

| File | Purpose |
|------|---------|
| `ai/pipelines/orchestrator/main_orchestrator.py` | Central entry point, end-to-end workflow coordinator |
| `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py` | Unified data cleaning & normalization |
| `ai/pipelines/orchestrator/data_splitter.py` | Train/val/test split (70/15/15) |
| `ai/pipelines/orchestrator/logger.py` | Structured logging for progress monitoring |

### Phase 2: Sourcing — Data Integration (MUST)

| File | Purpose |
|------|---------|
| `ai/sourcing/academic/academic_sourcing.py` | Academic findings from PubMed/Scholar |
| `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py` | YouTube transcript harvesting |
| `ai/training/ready_packages/scripts/extract_all_books_to_training.py` | Book processing (PDFs/EPUBs) |
| `ai/training/ready_packages/scripts/generate_nemo_synthetic_data.py` | NeMo synthetic generation |

### Phase 3: Quality & Safety Gates (MUST)

| File | Purpose |
|------|---------|
| `ai/safety/crisis_detection/production_crisis_detector.py` | Crisis detection (>95% sensitivity) |
| `ai/pipelines/orchestrator/ears_compliance_gate.py` | EARS validation gate |
| `ai/pipelines/orchestrator/quality_gates.py` | Unified quality checks |
| `ai/safety/content_filter.py` | Harmful content filtering |

### Phase 4: Infrastructure & Persistence (MUST)

| File | Purpose |
|------|---------|
| `ai/infrastructure/s3/s3_dataset_loader.py` | S3 persistence to OVH |
| `ai/infrastructure/distributed/ray_executor.py` | Ray-based distributed execution |
| `ai/infrastructure/database/persistence.py` | Consolidated DB operations |

### Phase 5: Consolidation & Testing (MUST)

| File | Purpose |
|------|---------|
| `tests/integration/test_end_to_end_pipeline.py` | E2E validation |
| `tests/integration/test_safety_gates.py` | Safety gate validation |
| `ai/pipelines/orchestrator/checkpoint_manager.py` | Checkpoint/resume capability |

---

## Enhancements & Reliability (SHOULD)

- Ray-based distributed execution
- Progress monitoring UI/CLI
- Checkpoint/resume capability
- Journal-research trigger on EARS alerts
- Notebook conversion utilities for data-science docs
- End-to-end test suite (coverage >80%)
- Persistence consolidation (single source of truth)

## Future Extensions (COULD)

- Interactive dashboard for dataset overview
- Multi-format export (CSV, JSON-LD, Parquet)
- Archival pipelines for long-term storage
- Fine-grained provenance tracking

---

## Technical Constraints

| Constraint | Requirement |
|------------|-------------|
| **Python Runtime** | Python 3.11+ only |
| **Python Packages** | Use `uv` only (never pip/conda/venv) |
| **Node.js Packages** | Use `pnpm` only (never npm/yarn) |
| **Object Storage** | OVH S3 bucket via `OVH_S3_ENDPOINT` env var |
| **Performance** | EARS gate ≥95% sensitivity on crisis signals |
| **Parallelism** | Heavy workloads (preprocessing, synthetic gen) must be Ray-compatible |
| **Idempotency** | All ingestion scripts safe to re-run without data corruption |
| **Schema Validation** | Strict JSON-Schema validation on all persisted data |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| **Volume** | ≥15k total items (10k therapeutic + 5k bias) |
| **Crisis Sensitivity** | ≥95% on held-out crisis set |
| **False Positive Rate** | ≤5% |
| **Batch Performance** | 100k-record batch in ≤30 min on target node |
| **Availability** | All artifacts persistently stored and retrievable via S3 API |
| **Completeness** | Documentation ≥80%, tests ≥20%, specs ≥90% of requirements |

---

## Current Task Directive

> **Execute the autonomous implementation of the Unified AI Dataset Pipeline.**
> 1. Review the provided PRD (`PRD-unified-ai-dataset-pipeline.md`)
> 2. Execute tasks from `fix_plan.md` in phase order
> 3. Validate each phase before proceeding to the next
> 4. Document progress in real-time

---

## Reference Documents

- **PRD:** `.ralph/PRD-unified-ai-dataset-pipeline.md`
- **Fix Plan:** `.ralph/fix_plan.md`
- **Specs:** `.ralph/specs/requirements.md`
- **Project AGENTS:** `AGENTS.md`
- **Domain Guidelines:** `.kiro/steering/domain-emotional-ai.md`
- **Security/Ethics:** `.kiro/steering/security-ethics.md`

---

*All files must reside under the `.ralph/` directory in the repository root.*