# Feature: Unified AI Dataset Pipeline & Infrastructure

> A comprehensive, production-grade data processing pipeline that consolidates all dataset sourcing, processing, quality assurance, and infrastructure into a single orchestrated system for generating empathy-driven training datasets.

---

## Executive Summary

The Unified AI Dataset Pipeline solves the critical challenge of fragmented data processing by consolidating academic sourcing, synthetic generation, quality assurance, and S3 infrastructure into a single Python orchestrator. This initiative will enable the Empathy Gym™ platform to generate 10,000+ therapeutic samples, 5,000+ bias detection samples, and 5,000+ grounded conversations—all validated through rigorous safety gates achieving >95% crisis detection sensitivity. The unified pipeline replaces legacy shell scripts with a maintainable, testable Python codebase that supports distributed processing, resumable operations, and EARS compliance validation.

---

## Overview

The Unified AI Dataset Pipeline consolidates fragmented data sourcing, processing, and validation components into a cohesive, production-ready system. This pipeline addresses the critical need for high-quality, ethically-sound, and psychologically-validated datasets that power the Empathy Gym™ platform. By unifying academic sourcing, synthetic generation, quality assurance, and infrastructure components, we ensure consistent, reproducible, and safe dataset creation at scale.

**Who benefits:**
- **AI/ML Engineers**: Single orchestration point for all dataset operations
- **Mental Health Professionals**: Access to validated, therapeutically-sound training data
- **Data Scientists**: Reproducible pipelines with clear quality gates
- **Platform Users**: Better AI models trained on high-quality, ethically-curated data

---

## Technical Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Python | 3.11+ | Core pipeline logic |
| **Package Manager** | uv | Latest | Dependency management (never pip/conda) |
| **Object Storage** | OVH S3 | - | Dataset persistence via boto3 |
| **Distributed Processing** | Ray | 2.9+ | Parallel dataset processing at scale |
| **Database** | PostgreSQL | 15+ | Metadata and state persistence |
| **Testing** | pytest | 8.0+ | Unit and integration testing |
| **AI/Synthetic** | NeMo Data Designer | - | Synthetic data generation |
| **Safety** | ProductionCrisisDetector | - | Crisis detection (>95% sensitivity) |

---

## Requirements

### Core Features (MUST)

- **MUST:** Create central entry point in `ai/pipelines/orchestrator/main_orchestrator.py`
- **MUST:** Implement unified preprocessing in `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py`
- **MUST:** Validate all data through `ai/safety/crisis_detection/production_crisis_detector.py` with >95% sensitivity
- **MUST:** Enforce 70/15/15 split ratios via `ai/pipelines/orchestrator/data_splitter.py`
- **MUST:** Implement EARS compliance in `ai/pipelines/orchestrator/ears_compliance_gate.py`
- **MUST:** Generate 10,000 therapeutic samples via `ai/data_designer/service.py`
- **MUST:** Generate 5,000 bias samples via `ai/training/ready_packages/scripts/generate_nemo_synthetic_data.py`
- **MUST:** Persist datasets to S3 via `ai/infrastructure/s3/s3_dataset_loader.py`
- **MUST:** Integrate academic sourcing via `ai/sourcing/academic/academic_sourcing.py`
- **MUST:** Integrate YouTube transcripts via `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py`
- **MUST:** Integrate book processing via `ai/training/ready_packages/scripts/extract_all_books_to_training.py`

### Important Features (SHOULD)

- **SHOULD:** Implement distributed processing via `ai/infrastructure/distributed/ray_executor.py`
- **SHOULD:** Provide progress monitoring via `ai/pipelines/orchestrator/logger.py`
- **SHOULD:** Support checkpoint/resume via `ai/pipelines/orchestrator/checkpoint_manager.py`
- **SHOULD:** Auto-trigger journal research via `ai/journal_dataset_research/pipeline.py`
- **SHOULD:** Convert notebooks in `ai/pipelines/notebooks/` to scripts
- **SHOULD:** Provide E2E tests via `tests/integration/test_end_to_end_pipeline.py`
- **SHOULD:** Consolidate persistence in `ai/infrastructure/database/persistence.py`

### Nice-to-Have (COULD)

- **COULD:** Provide real-time quality metrics dashboard
- **COULD:** Export multiple formats via `ai/infrastructure/export/multi_format.py`
- **COULD:** Auto-archive deprecated components to `archive/`
- **COULD:** Custom quality gates via `ai/pipelines/orchestrator/custom_gates.py`

---

## Phase 1: Foundation (Weeks 1-2)

**Goal:** Establish core orchestration and preprocessing infrastructure.

**Depends on:** Database schema in `ai/infrastructure/database/schema.py`

### Tasks

- [ ] **MUST:** Create `ai/pipelines/orchestrator/main_orchestrator.py` as central entry point
- [ ] **MUST:** Implement `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py` for unified preprocessing
- [ ] **MUST:** Create `ai/pipelines/orchestrator/data_splitter.py` for 70/15/15 train/val/test splitting
- [ ] **SHOULD:** Add unit tests in `tests/unit/pipelines/test_orchestrator.py`
- [ ] **SHOULD:** Implement structured logging in `ai/pipelines/orchestrator/logger.py`

---

## Phase 2: Sourcing Integration (Weeks 2-3)

**Goal:** Integrate all data sourcing mechanisms into the orchestrator.

**Depends on:** Phase 1 orchestrator in `ai/pipelines/orchestrator/main_orchestrator.py`

### Tasks

- [ ] **MUST:** Integrate academic sourcing via `ai/sourcing/academic/academic_sourcing.py`
- [ ] **MUST:** Integrate book processing via `ai/training/ready_packages/scripts/extract_all_books_to_training.py`
- [ ] **MUST:** Integrate YouTube transcripts via `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py`
- [ ] **MUST:** Create synthetic generation wrapper in `ai/training/ready_packages/scripts/generate_nemo_synthetic_data.py`
- [ ] **SHOULD:** Add auto-trigger for journal research in `ai/journal_dataset_research/trigger.py`

---

## Phase 3: Quality & Safety Gates (Weeks 3-4)

**Goal:** Implement comprehensive quality and safety validation.

**Depends on:** Spec in `docs/guides/EMPATHY_RESPONSE_STYLE.md`

### Tasks

- [ ] **MUST:** Implement EARS validation in `ai/pipelines/orchestrator/ears_compliance_gate.py`
- [ ] **MUST:** Implement unified quality checks in `ai/pipelines/orchestrator/quality_gates.py`
- [ ] **MUST:** Ensure `ai/safety/crisis_detection/production_crisis_detector.py` achieves >95% sensitivity
- [ ] **SHOULD:** Add safety gate tests in `tests/integration/test_safety_gates.py`
- [ ] **SHOULD:** Implement content filter in `ai/safety/content_filter.py`

---

## Phase 4: Infrastructure & Persistence (Weeks 4-5)

**Goal:** Implement distributed processing and S3 integration.

**Depends on:** OVH S3 configuration via `OVH_S3_ENDPOINT` environment variable

### Tasks

- [ ] **MUST:** Implement S3 operations in `ai/infrastructure/s3/s3_dataset_loader.py`
- [ ] **MUST:** Create Ray-based processing in `ai/infrastructure/distributed/ray_executor.py`
- [ ] **MUST:** Consolidate DB persistence in `ai/infrastructure/database/persistence.py`
- [ ] **SHOULD:** Add production export in `ai/infrastructure/production/export_to_ready_packages.py`
- [ ] **COULD:** Add multi-format export in `ai/infrastructure/export/multi_format.py`

---

## Phase 5: Consolidation & Testing (Weeks 5-6)

**Goal:** Eliminate redundancy, migrate legacy components, and validate end-to-end.

**Depends on:** All previous phases complete

### Tasks

- [ ] **MUST:** Create E2E tests in `tests/integration/test_end_to_end_pipeline.py`
- [ ] **MUST:** Add deprecation notice to `scripts/run_phase1_production.sh`
- [ ] **MUST:** Migrate `ai/dataset_pipeline/` logic to `ai/pipelines/orchestrator/`
- [ ] **MUST:** Migrate `ai/training_ready/` to `ai/training/ready_packages/`
- [ ] **SHOULD:** Create checkpoint manager in `ai/pipelines/orchestrator/checkpoint_manager.py`
- [ ] **SHOULD:** Separate `ai/models/pixel/` logic from `ai/pixel/` tests

---

## User Stories

### Story 1: Academic Dataset Integration
As a **Data Scientist**, I want to automatically fetch and process academic findings from PubMed/Scholar so that I can ground therapeutic conversations in peer-reviewed research.

Files to modify: `ai/sourcing/academic/academic_sourcing.py`, `ai/pipelines/orchestrator/quality_gates.py`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/sourcing/academic/academic_sourcing.py` successfully fetches findings
- [ ] **MUST:** `ai/journal_dataset_research/pipeline.py` triggers for therapeutic queries
- [ ] **MUST:** Findings pass through `ai/pipelines/orchestrator/quality_gates.py`
- [ ] **MUST:** Results stored in S3 via `ai/infrastructure/s3/s3_dataset_loader.py`

**Depends on:** Phase 1 orchestrator, Phase 2 sourcing

### Story 2: Synthetic Data Generation
As an **AI Engineer**, I want to generate 10,000+ therapeutic samples using NeMo Data Designer so that I can augment real-world data with controlled, diverse scenarios.

Files to modify: `ai/data_designer/service.py`, `ai/pipelines/orchestrator/ears_compliance_gate.py`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/data_designer/service.py` generates 10,000 therapeutic samples
- [ ] **MUST:** `ai/training/ready_packages/scripts/generate_nemo_synthetic_data.py` generates 5,000 bias samples
- [ ] **MUST:** `ai/training/ready_packages/scripts/generate_ultra_nightmares.py` produces edge cases
- [ ] **MUST:** Samples validate via `ai/pipelines/orchestrator/ears_compliance_gate.py`

**Depends on:** Phase 2 sourcing, Phase 3 EARS gate

### Story 3: Unused Material Hydration
As a **Platform Engineer**, I want to convert static texts (books, transcripts) into training conversations so that I can maximize value from existing intellectual property.

Files to modify: `ai/training/ready_packages/scripts/extract_all_books_to_training.py`, `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/training/ready_packages/scripts/extract_all_books_to_training.py` processes books
- [ ] **MUST:** `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py` generates transcripts
- [ ] **MUST:** `ai/sourcing/youtube/processed_transcripts_loader.py` creates grounding datasets
- [ ] **SHOULD:** Generate minimum 5,000 grounded conversations

**Depends on:** Phase 2 sourcing integration

### Story 4: Pipeline Orchestration
As a **DevOps Engineer**, I want a single Python entry point for all pipeline operations so that I can execute, monitor, and debug the entire pipeline programmatically.

Files to modify: `ai/pipelines/orchestrator/main_orchestrator.py`, `scripts/run_phase1_production.sh`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/pipelines/orchestrator/main_orchestrator.py` subsumes shell script logic
- [ ] **MUST:** Preprocessing via `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py`
- [ ] **SHOULD:** Resume from checkpoint via `ai/pipelines/orchestrator/checkpoint_manager.py`
- [ ] **SHOULD:** E2E tests in `tests/integration/test_end_to_end_pipeline.py`

**Depends on:** Phase 1 foundation, Phase 5 consolidation

### Story 5: Safety and Quality Enforcement
As a **Compliance Officer**, I want all datasets to pass through rigorous safety and quality gates so that we ensure psychological safety and ethical standards.

Files to modify: `ai/safety/crisis_detection/production_crisis_detector.py`, `ai/pipelines/orchestrator/ears_compliance_gate.py`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/safety/crisis_detection/production_crisis_detector.py` achieves >95% sensitivity
- [ ] **MUST:** `ai/pipelines/orchestrator/ears_compliance_gate.py` validates conversations
- [ ] **MUST:** `ai/safety/content_filter.py` filters harmful content
- [ ] **MUST:** `tests/integration/test_safety_gates.py` verifies blocking

**Depends on:** Phase 3 quality gates

### Story 6: Production Infrastructure
As a **Platform Engineer**, I want distributed processing and S3 integration so that I can scale dataset generation to production workloads.

Files to modify: `ai/infrastructure/distributed/ray_executor.py`, `ai/infrastructure/s3/s3_dataset_loader.py`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/infrastructure/distributed/ray_executor.py` handles parallel processing
- [ ] **MUST:** `ai/infrastructure/database/persistence.py` serves as sole persistence
- [ ] **MUST:** `ai/infrastructure/s3/s3_dataset_loader.py` supports resumable uploads
- [ ] **SHOULD:** `ai/infrastructure/production/export_to_ready_packages.py` exports properly

**Depends on:** Phase 4 infrastructure

### Story 7: Component Consolidation
As a **Tech Lead**, I want to eliminate redundant components and clarify module boundaries so that the codebase is maintainable and scalable.

Files to modify: `ai/dataset_pipeline/`, `ai/training_ready/`, `ai/pipelines/orchestrator/`

**Acceptance Criteria:**
- [ ] **MUST:** `ai/dataset_pipeline/` logic merged into `ai/pipelines/orchestrator/`
- [ ] **MUST:** `ai/training_ready/` migrated to `ai/training/ready_packages/`
- [ ] **MUST:** Clear separation between `ai/models/pixel/` and `ai/pixel/`
- [ ] **SHOULD:** No scripts reference deprecated paths

**Depends on:** Phase 5 consolidation

---

## Technical Notes

### Architecture

- **Orchestrator**: `ai/pipelines/orchestrator/main_orchestrator.py`
- **Preprocessing**: `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py`
- **Sourcing**: `ai/sourcing/academic/academic_sourcing.py`, `ai/journal_dataset_research/pipeline.py`
- **Synthetic**: `ai/data_designer/service.py`, `ai/training/ready_packages/scripts/generate_ultra_nightmares.py`
- **Safety**: `ai/safety/crisis_detection/production_crisis_detector.py`, `ai/safety/content_filter.py`
- **Quality**: `ai/qa/validators.py`, `ai/pipelines/orchestrator/ears_compliance_gate.py`
- **Infrastructure**: `ai/infrastructure/distributed/ray_executor.py`, `ai/infrastructure/database/persistence.py`

### Files to Modify

- `ai/pipelines/orchestrator/main_orchestrator.py` — Central entry point
- `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py` — Preprocessing logic
- `ai/training/ready_packages/scripts/generate_ultra_nightmares.py` — Nightmare Fuel
- `ai/training/ready_packages/scripts/extract_all_books_to_training.py` — Book processing
- `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py` — Transcript processing
- `scripts/run_phase1_production.sh` — Deprecate after Python migration

### Files to Create

- `ai/pipelines/orchestrator/ears_compliance_gate.py` — EARS validation
- `ai/pipelines/orchestrator/quality_gates.py` — Unified quality checks
- `ai/pipelines/orchestrator/checkpoint_manager.py` — Resume/checkpoint logic
- `ai/pipelines/orchestrator/logger.py` — Structured logging
- `ai/infrastructure/distributed/ray_executor.py` — Ray-based execution
- `ai/infrastructure/database/persistence.py` — Consolidated DB operations
- `tests/integration/test_end_to_end_pipeline.py` — E2E validation
- `tests/integration/test_safety_gates.py` — Safety gate validation

---

## Constraints

> ⚠️ **MANDATORY: No Stubs or Filler Logic**
>
> All implementations MUST be complete and production-ready. The following are **absolutely prohibited**:
> - Stub functions (`pass`, `...`, `NotImplementedError`)
> - Placeholder logic (`return True`, `return []`, hardcoded dummy values)
> - TODO/FIXME comments in production code
> - Mock implementations disguised as real functionality
>
> **If a feature cannot be fully implemented, it must not be committed.**

- Maximum dataset size per batch: 100GB (distributed processing required beyond this)
- Crisis detection sensitivity: >95% (certification requirement for `ai/safety/crisis_detection/production_crisis_detector.py`)
- Split ratios: Strict 70/15/15 (Train/Val/Test) enforced by `ai/pipelines/orchestrator/data_splitter.py`
- Must support OVH S3 endpoints via `OVH_S3_ENDPOINT` env var
- Cannot modify validated datasets in `ai/training/ready_packages/` without version increment
- All Python scripts must use `uv` (never `pip`, `conda`, `venv`)
- Must maintain backward compatibility with `ai/infrastructure/s3/s3_dataset_loader.py` API

---

## Open Questions

- How should we handle version conflicts between datasets generated at different pipeline versions?
- What should happen when partial batches fail in distributed processing? (Retry all? Save partial?)
- Should we implement automatic dataset expiration/archival policies?
- How do we handle cultural/linguistic variations in EARS compliance? (Future: multi-language support)
- Should notebooks in `ai/pipelines/notebooks/` be converted to scripts or remain as exploratory tools?

---

## Out of Scope

- Real-time streaming data ingestion (batch-only for now)
- Multi-language support (English-only in MVP)
- Automatic hyperparameter tuning based on dataset quality
- User-facing dataset browser/explorer UI
- Integration with non-S3 object storage (Azure Blob, GCS)
- Dataset marketplace or sharing features

---

## Appendix

### Related Documents

- *(Task breakdown embedded in Phases 1-5 above)*
- [EMPATHY_RESPONSE_STYLE.md](../docs/guides/EMPATHY_RESPONSE_STYLE.md) — EARS compliance specification
- [PIX-58: S3 Infrastructure]() — OVH S3 integration spec
- [PIX-48: Edge Case Generator]() — Synthetic edge case generation

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                   Main Orchestrator                        │
│       (ai/pipelines/orchestrator/main_orchestrator.py)     │
└─────────────────┬──────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│ Sourcing Layer │  │ Processing     │
│  - Academic    │  │  - Unified     │
│  - NeMo        │  │    Preprocessing│
│  - YouTube     │  │  - Data Designer│
│  - Books       │  │                │
└───────┬────────┘  └───────┬────────┘
        │                   │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  Quality Gates    │
        │  - Safety         │
        │  - EARS           │
        │  - Crisis         │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  Infrastructure   │
        │  - Distributed    │
        │  - Database       │
        │  - S3 Export      │
        └───────────────────┘
```

### Dataset Flow

```
Raw Sources → Sourcing → Preprocessing → Quality Gates → S3 Storage
                                              ↓
                                         [BLOCKED if fails]
```

### Success Metrics

- **Volume**: 10,000+ therapeutic samples, 5,000+ bias samples, 5,000+ grounded conversations
- **Quality**: >95% crisis detection accuracy, 100% EARS compliance for therapeutic data
- **Performance**: Process 10GB dataset in <2 hours (distributed mode)
- **Reliability**: <1% data loss rate, 100% resumable from checkpoint
