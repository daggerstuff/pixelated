# fix_plan.md

> 🎭 *Unified AI Dataset Pipeline — Task Tracker*

> ⛔ **ABSOLUTE PROHIBITION: No Stubs or Filler Logic.** Every implementation MUST be complete—no `pass`, `...`, `TODO`, `NotImplementedError`, placeholder returns, or mock implementations. If a feature cannot be fully implemented, it must not be committed.

## ✅ Completed Checklists

- [x] Initial directory creation and structure setup
- [x] PROMPT.md drafted and validated
- [x] Core requirements extracted from PRD
- [x] specs/requirements.md created with architecture overview

---

## 📋 Implementation Plan (Phase-Aligned with PRD)

### 🔴 Phase 1: Foundation (Weeks 1-2) — Critical Path

**Goal:** Establish core orchestration and preprocessing infrastructure.  
**Depends on:** Database schema in `ai/infrastructure/database/schema.py`

| Task | File Path | Status | Priority | Dependencies | Notes |
|------|-----------|--------|----------|--------------|-------|
| Create orchestrator entry point | `ai/pipelines/orchestrator/main_orchestrator.py` | 🟡 Pending | MUST | None | Central coordinator for all pipeline stages |
| Unified preprocessing pipeline | `ai/pipelines/orchestrator/unified_preprocessing_pipeline.py` | 🟡 Pending | MUST | main_orchestrator.py | Data cleaning & normalization |
| Train/val/test splitter | `ai/pipelines/orchestrator/data_splitter.py` | 🟡 Pending | MUST | unified_preprocessing_pipeline.py | 70/15/15 split with statistical validation |
| Unit tests for orchestrator | `tests/unit/pipelines/test_orchestrator.py` | 🟡 Pending | SHOULD | main_orchestrator.py | ≥80% coverage target |
| Structured logging | `ai/pipelines/orchestrator/logger.py` | 🟡 Pending | SHOULD | None | Progress monitoring foundation |

**Phase 1 Exit Criteria:**
- [ ] All MUST tasks complete
- [ ] Unit tests pass: `uv run pytest tests/unit/pipelines/`
- [ ] No lint errors: `uv run ruff check ai/pipelines/`

---

### 🟠 Phase 2: Sourcing Integration (Weeks 2-3)

**Goal:** Integrate all data sourcing mechanisms into the orchestrator.  
**Depends on:** Phase 1 orchestrator in `ai/pipelines/orchestrator/main_orchestrator.py`

| Task | File Path | Status | Priority | Dependencies | Notes |
|------|-----------|--------|----------|--------------|-------|
| Academic sourcing integration | `ai/sourcing/academic/academic_sourcing.py` | 🟡 Pending | MUST | main_orchestrator.py | PubMed/Scholar integration |
| Book processing | `ai/training/ready_packages/scripts/extract_all_books_to_training.py` | 🟡 Pending | MUST | main_orchestrator.py | PDF/EPUB conversion |
| YouTube transcripts | `ai/training/ready_packages/scripts/extract_all_youtube_transcripts.py` | 🟡 Pending | MUST | main_orchestrator.py | Subtitle extraction |
| Synthetic generation wrapper | `ai/training/ready_packages/scripts/generate_nemo_synthetic_data.py` | 🟡 Pending | MUST | main_orchestrator.py | NeMo Data Designer integration |
| Journal research trigger | `ai/journal_dataset_research/trigger.py` | 🟡 Pending | SHOULD | academic_sourcing.py | Auto-trigger on therapeutic queries |

**Phase 2 Exit Criteria:**
- [ ] All sourcing scripts callable from main_orchestrator.py
- [ ] ≥5,000 grounded conversations generated
- [ ] Integration tests pass: `uv run pytest tests/integration/test_sourcing.py`

---

### 🟡 Phase 3: Quality & Safety Gates (Weeks 3-4)

**Goal:** Implement comprehensive quality and safety validation.  
**Depends on:** Spec in `docs/guides/EMPATHY_RESPONSE_STYLE.md`

| Task | File Path | Status | Priority | Dependencies | Notes |
|------|-----------|--------|----------|--------------|-------|
| EARS compliance gate | `ai/pipelines/orchestrator/ears_compliance_gate.py` | 🟡 Pending | MUST | Phase 2 complete | EARS validation |
| Unified quality checks | `ai/pipelines/orchestrator/quality_gates.py` | 🟡 Pending | MUST | ears_compliance_gate.py | Combined quality enforcement |
| Crisis detector certification | `ai/safety/crisis_detection/production_crisis_detector.py` | 🟡 Pending | MUST | None | >95% sensitivity required |
| Safety gate tests | `tests/integration/test_safety_gates.py` | 🟡 Pending | SHOULD | quality_gates.py | Verify blocking behavior |
| Content filter | `ai/safety/content_filter.py` | 🟡 Pending | SHOULD | crisis_detector | Harmful content blocking |

**Phase 3 Exit Criteria:**
- [ ] Crisis detection sensitivity ≥95% (validated on crisis test set)
- [ ] All EARS compliance tests pass
- [ ] Safety gate integration tests pass

---

### 🟢 Phase 4: Infrastructure & Persistence (Weeks 4-5)

**Goal:** Implement distributed processing and S3 integration.  
**Depends on:** OVH S3 configuration via `OVH_S3_ENDPOINT` environment variable

| Task | File Path | Status | Priority | Dependencies | Notes |
|------|-----------|--------|----------|--------------|-------|
| S3 operations | `ai/infrastructure/s3/s3_dataset_loader.py` | 🟡 Pending | MUST | None | OVH S3 persistence |
| Ray-based distributed processing | `ai/infrastructure/distributed/ray_executor.py` | 🟡 Pending | MUST | main_orchestrator.py | Parallel execution |
| Database persistence consolidation | `ai/infrastructure/database/persistence.py` | 🟡 Pending | MUST | None | Single source of truth |
| Production export | `ai/infrastructure/production/export_to_ready_packages.py` | 🟡 Pending | SHOULD | s3_dataset_loader.py | Export pipeline |
| Multi-format export | `ai/infrastructure/export/multi_format.py` | 🟡 Pending | COULD | export_to_ready_packages.py | CSV/JSON-LD/Parquet |

**Phase 4 Exit Criteria:**
- [ ] S3 upload/download working with OVH endpoint
- [ ] Ray executor handles 100k-record batch in ≤30 min
- [ ] Persistence layer operational

---

### 🔵 Phase 5: Consolidation & Testing (Weeks 5-6)

**Goal:** Eliminate redundancy, migrate legacy components, and validate end-to-end.  
**Depends on:** All previous phases complete

| Task | File Path | Status | Priority | Dependencies | Notes |
|------|-----------|--------|----------|--------------|-------|
| E2E pipeline tests | `tests/integration/test_end_to_end_pipeline.py` | 🟡 Pending | MUST | All phases | Full pipeline validation |
| Deprecation notice | `scripts/run_phase1_production.sh` | 🟡 Pending | MUST | main_orchestrator.py | Mark for removal |
| Migrate dataset_pipeline logic | `ai/dataset_pipeline/` → `ai/pipelines/orchestrator/` | 🟡 Pending | MUST | main_orchestrator.py | Code consolidation |
| Migrate training_ready | `ai/training_ready/` → `ai/training/ready_packages/` | 🟡 Pending | MUST | None | Directory consolidation |
| Checkpoint manager | `ai/pipelines/orchestrator/checkpoint_manager.py` | 🟡 Pending | SHOULD | main_orchestrator.py | Resume capability |
| Separate pixel logic | `ai/models/pixel/` vs `ai/pixel/` | 🟡 Pending | SHOULD | None | Clear module boundaries |

**Phase 5 Exit Criteria:**
- [ ] E2E tests pass: `uv run pytest tests/integration/test_end_to_end_pipeline.py`
- [ ] No deprecated paths referenced in scripts
- [ ] Coverage ≥80% on new code

---

## 📝 Dependency Chain

```
Phase 1                    Phase 2                    Phase 3
main_orchestrator.py  ──►  academic_sourcing.py  ──►  ears_compliance_gate.py
        │                  youtube_transcripts.py     quality_gates.py
        ▼                  books_to_training.py       production_crisis_detector.py
unified_preprocessing_pipeline.py  │                         │
        │                          ▼                         ▼
        ▼                  generate_nemo_synthetic.py  Phase 4                    Phase 5
data_splitter.py                                      s3_dataset_loader.py  ──►  E2E tests
                                                      ray_executor.py            Consolidation
                                                      persistence.py
```

---

## ⚙️ Environment & Commands

```bash
# Package Management (CRITICAL)
uv sync                           # Python dependencies
pnpm install                      # Node.js dependencies (if needed)

# Development
uv run python -m ai.pipelines.orchestrator.main_orchestrator

# Testing
uv run pytest tests/unit/         # Unit tests
uv run pytest tests/integration/  # Integration tests
uv run pytest --cov=ai/pipelines/ # Coverage report

# Quality
uv run ruff check ai/             # Lint Python
uv run ruff format ai/            # Format Python
pnpm security:scan                # Security audit (Node.js)

# Infrastructure
uv run python -m ai.infrastructure.s3.s3_dataset_loader --validate
```

---

## 🔐 Security Checklist (Before Each Phase Completion)

- [ ] No hardcoded secrets or API keys
- [ ] All S3 credentials loaded from environment variables
- [ ] Input validation on all data ingestion
- [ ] Crisis signals handled defensively
- [ ] Audit logging enabled for mutations

---

## 📊 Success Metrics (Overall)

| Metric | Target | Current |
|--------|--------|---------|
| Therapeutic Samples | ≥10,000 | TBD |
| Bias Samples | ≥5,000 | TBD |
| Grounded Conversations | ≥5,000 | TBD |
| Crisis Detection Sensitivity | ≥95% | TBD |
| E2E Batch Performance | ≤30 min (100k records) | TBD |
| Test Coverage | ≥80% | TBD |

---

`[All paths verified relative to project root]`  
`[Last Updated: 2026-01-31]`