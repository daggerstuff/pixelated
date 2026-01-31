# PRD: Unified AI Dataset Pipeline & Infrastructure

## Overview
Consolidate and verify the utilization of all AI infrastructure components into a unified, tested, and production-ready pipeline. This initiative targets the elimination of redundancy, ensuring `ai/pipelines/orchestrator` serves as the central source of truth while properly leveraging specialized modules in `ai/sourcing`, `ai/infrastructure`, and `ai/training`.

## Task 0: Dataset Composition & Standards (New)
Define the strict requirements for the final dataset structure as per `MASTER_TRAINING_EPIC.md` and `TRAINING_PLAN.md`.

### Composition Targets (Total: 60,000+ Conversations)
- **Stage 1: Foundation (40%)**: Empathy & Rapport (Tier 1 Priority + Consolidated).
- **Stage 2: Expertise (25%)**: Clinical Reasoning (CoT, Psychology Knowledge).
- **Stage 3: Edge Cases (20%)**: "Nightmare Fuel" (Crisis, Trauma, Abuse). **Critical**: Do NOT safety-filter these; model must learn to handle them.
- **Stage 4: Voice/Persona (15%)**: Tim Fletcher, Wayfarer-balanced.

### Quality Standards (`EMPATHY_RESPONSE_STYLE.md`)
- **EARS Framework**: Response must demonstrate Empathize, Acknowledge, Reflect, Support.
- **Prohibited**: Institutional referrals (unless requested), "As an AI" disclaimers, minimization.
- **Metrics**: Empathy Score ≥ 0.80, Crisis Sensitivity > 95%.

## Task 1: Sourcing & Ingestion Integrity
Ensure all data acquisition channels are active and integrated into the `main_orchestrator.py`.
- [ ] **Academic Sourcing**: Integrate `ai/sourcing/academic/academic_sourcing.py` to fetch PubMed/Scholar findings automatically.
- [ ] **Journal Research**: Trigger `ai/journal_dataset_research` pipeline for specific queries (e.g., "trauma informed care").
- [ ] **NeMo Synthetic Generation**: Integrate `ai/data_designer/service.py` to generate **10,000 therapeutic samples** and **5,000 bias samples** using NeMo Data Designer.
- [ ] **Nightmare Fuel**: Integrate `ai/training/ready_packages/scripts/generate_ultra_nightmares.py` to ensure Stage 3 targets are met.
- [ ] **Unused Material Hydration**:
    - **Books & PDFs**: Process `extract_all_books_to_training.py` to convert generic psychology texts into training data (Stage 2).
    - **Tim Fletcher & Transcripts**: Use `extract_all_youtube_transcripts.py` and `processed_transcripts_loader.py` to generate "Voice Persona" data (Stage 4) and knowledge grounding.
    - **Goal**: Generate **5,000+** grounded conversations from these static texts.

## Task 2: Pipeline Orchestration & Processing
Standardize the processing logic within the main orchestrator.
- [ ] **Unified Preprocessing**: Audit `unified_preprocessing_pipeline.py` to ensure it completely subsumes legacy logic in `ai/dataset_pipeline`.
- [ ] **Data Designer**: Integrate `ai/pipelines/design` into the composition strategy for dynamic dataset balancing.
- [ ] **Notebooks**: Ensure `ai/pipelines/notebooks` are reproducible and potentially converted to executable scripts if critical.
- [ ] **Run Script Migration**: Port the logic from `scripts/run_phase1_production.sh` into `main_orchestrator.py` to create a single pythonic entry point.
- [ ] **Splits**: Enforce **70% Train / 15% Val / 15% Test** split ratios (per Master Epic).

## Task 3: Quality Assurance & Safety
Implement comprehensive gates for data integrity and safety.
- [ ] **Safety Validation**: fully utilize `ai/sourcing/research_system` and `ai/safety` for content filtering.
- [ ] **Quality Gates**: Verify `ai/qa` tools are called during the `validate_final_dataset()` phase.
- [ ] **Empathy Gating**: Implement a specific gate for **EARS compliance** (Empathy, Acknowledge, Reflect, Support) as per `EMPATHY_RESPONSE_STYLE.md`.
- [ ] **Crisis Detection**: Ensure `ProductionCrisisDetector` (Pixel inference) is used for >95% sensitivity checks.
- [ ] **Integration Tests**: Verify that safety flags strictly block non-compliant data.

## Task 4: Infrastructure & Production
Ensure the pipeline runs reliably on distributed infrastructure.
- [ ] **Distributed Processing**: Utilize `ai/infrastructure/distributed` for parallel processing of large datasets.
- [ ] **Database Integration**: Confirm `ai/infrastructure/database` is the sole data persistence layer (removing ad-hoc JSON/CSV where possible).
- [ ] **Production Export**: Validate `ai/infrastructure/production` handles the final export to `ai/training/ready_packages`.
- [ ] **AWS/OVH S3 Integration**: Ensure full compatibility with OVH S3 as per **PIX-58** (Done), verifying `s3_dataset_loader.py` handles the `OVH_S3_ENDPOINT` correctly in the new pipeline.
- [ ] **End-to-End Tests**: Execute `test_end_to_end_pipeline.py`.

## Task 5: Component Consolidation
Merge overlapping functionality to reduce technical debt.
- [ ] **Generator Integration**: Integrate `generate_edge_case_synthetic_dataset.py` (**PIX-48**) directly into the orchestration logic rather than relying on external shell scripts.
- [ ] **Deduplication**: Merge `ai/dataset_pipeline` logic into `ai/pipelines/orchestrator` if redundant.
- [ ] **Training Ready**: Finalize the transition of `ai/training_ready` (legacy) to `ai/training/ready_packages`, ensuring no scripts map to old paths.
- [ ] **Pixel & Models**: Clarify the separation between `ai/models/pixel` (logic) and `ai/pixel` (tests/legacy) to avoid confusion.
