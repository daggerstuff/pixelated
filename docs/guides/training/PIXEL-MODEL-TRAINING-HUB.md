# 🎯 PIXEL MODEL TRAINING - MASTER HUB

**Created**: January 9, 2026  
**Status**: 🟢 Ready to Execute  
**Timeline**: 3 Weeks (Jan 9-31, 2026)  
**Success Target**: >95% Crisis Detection Sensitivity

---

## 📌 Linear Tracking
- Project: https://linear.app/pixelated/project/pixelated-empathy-model-training-5b3895d8ad91
- Phase 1: Dataset Creation — https://linear.app/pixelated/issue/PIX-20/phase-1-dataset-creation-week-1
- Phase 2: Data Augmentation — https://linear.app/pixelated/issue/PIX-27/phase-2-data-augmentation-week-2
- Phase 3: Model Training — https://linear.app/pixelated/issue/PIX-30/phase-3-model-training-week-3
- Phase 4: Deployment & Production — https://linear.app/pixelated/issue/PIX-32/phase-4-deployment-and-production-week-4

All tasks/subtasks are nested under the above Phase issues in Linear. Treat this hub as the canonical plan and Linear as the live execution tracker.

## 🔎 Current Data Reality (S3 + Local + Backlog)
- **Canonical S3 (OVH)**: `s3://pixel-data/` for training-ready data and releases (S3 canonical home).
- **Consolidated Local Corpora**: ~9.3GB available, ~3.6GB pending remote download (local snapshot). Key artifacts (not checked into git; expect on S3 or mounted storage):
  - `ai/training_data_consolidated/` (expected home for `ULTIMATE_FINAL_DATASET.jsonl`, train/val/test splits ~5.6GB)
  - `ai/lightning/pixelated-training/processed/` → phase outputs (Priority/Professional/CoT)
  - `ai/datasets/` → raw + Reddit tiers + research packs (1.5GB+) and 43+ named sets (see summaries below)
- **Data Health Baseline (snapshots)**: Source counts, tiers, and quality metrics (now embedded here) formerly in dataset stats/metadata docs.
- **Backlog (Google Drive → OVH S3)**: ~3.6GB still on GDrive per the master inventory. Action: rclone or VPS stream to `s3://pixel-data/gdrive/processed/` (follow S3/VPS steps in [ai/training_ready/MASTER_TRAINING_EPIC.md](ai/training_ready/MASTER_TRAINING_EPIC.md)).
- **Integration & Curation Code**: Use `ai/integration_pipeline/master_pipeline.py` and `ai/integration_pipeline/create_unified_6_component_dataset.py` for merges; `ai/comprehensive_dataset_integration.py` (legacy entrypoint) remains available for traceability.
- **Synthetic Generation**: NeMo Data Designer integration lives in [ai/data_designer/README.md](ai/data_designer/README.md) (deploy service, then use `NeMoDataDesignerService`).
- **Research/Journal System**: Documentation in [ai/journal_dataset_research/docs/README.md](ai/journal_dataset_research/docs/README.md) (architecture, API, troubleshooting) for long-form curation and evaluation.
- **Credentials & Manifests**: OVH S3 creds are loaded from `.env` at repo root (never commit; keep in secrets manager). Training manifests live in [ai/training_ready/TRAINING_MANIFEST.json](ai/training_ready/TRAINING_MANIFEST.json) and related files in [ai/training_ready](ai/training_ready).
- **Latest S3 Training Snapshot (prod)**: 52.20GB / 19,330 objects at `s3://pixel-data/` (ChatML JSONL) per training integration report; validated via 8-gate checks.

### Legacy Integration Command (traceability)
- Historical entrypoint: `python ai/comprehensive_dataset_integration.py --input <sources> --output ai/training_data_consolidated/`
- Superseded by: `python ai/integration_pipeline/master_pipeline.py` (preferred). Keep the legacy path documented for reproducibility.

### Embedded Inventory Highlights (from prior inventories)
- **Totals (last snapshot)**: ~137k-152k conversations tracked; processed phases ~753MB; consolidated ~7.2GB; raw pending ~3.6GB.
- **Processed Phases** (`ai/lightning/pixelated-training/processed/`):
  - Phase 1 Priority (106,248 conv, 424MB), Phase 2 Professional (16,386 conv, 49MB), Phase 3 CoT (59,559 conv, 280MB).
- **Consolidated Finals** (`ai/training_data_consolidated/`):
  - `ULTIMATE_FINAL_DATASET.jsonl` (~2GB, ~608k conv), `merged_dataset.jsonl` (~1.5GB), `unified_training_data.jsonl` (~600MB), `pixelated_empathy_test_*.jsonl` / `pixelated_empathy_val_*.jsonl` (~190MB each).
- **Raw/Tiered** (`ai/datasets/`):
  - Tier 1-3 priority/professional/CoT sets (priority_*_FINAL, professional therapy, CoT reasoning families)
  - Tier 4 Reddit archive (condition-specific TF-IDF CSVs, 50+ condition datasets)
  - Tier 5 research (EMNLP empathy, RECCON, IEMOCAP, MODMA, knowledge bases)
  - Tier 6 knowledge (DSM PDF, psychology knowledge bases)
- **Data Designer**: Use NeMo Data Designer service for synthetic generation (deploy per `ai/data_designer/README.md`).
- **Execution Plan (merge & train)**: Legacy steps from prior execution plan kept here (see “Legacy Integration Command” below).

## 🛠️ Immediate Execution Runbook (blocked pending creds)
- **Status**: Not executed in this workspace (no GDrive/S3 creds; `ai/training_data_consolidated/` directory not present locally). Commands below assume valid rclone config and OVH S3 access.
- **1) GDrive → OVH S3 sync** (rclone example; do not log PII):
  - Prepare config (no secrets in code): `export RCLONE_CONFIG=/secure/path/rclone.conf`
  - Sync: `rclone sync gdrive:pixel-backlog s3ovh:pixel-data/gdrive/processed --transfers 8 --checkers 16 --s3-chunk-size 64M --s3-upload-concurrency 4 --progress`
  - Network safety: ensure HTTPS endpoints; restrict to allow-listed bucket/region.
- **2) Verify S3 landing**: `rclone ls s3ovh:pixel-data/gdrive/processed | head` and spot-check object sizes; keep audit logs.
- **3) Post-sync refresh (update numbers in this hub)**:
  - Recompute sizes/counts (example): `du -sh ai/datasets tier* ai/lightning/pixelated-training/processed 2>/dev/null` and `find ai -name "*.jsonl" -maxdepth 4 -print0 | xargs -0 wc -l | sort -nr | head`
  - If consolidated datasets are remote-only, pull manifests or run counts server-side, then overwrite the embedded figures above.
  - Re-run integration (if enabled) via `python ai/integration_pipeline/master_pipeline.py` (note: current implementation is stubbed; prefer your production merge job if available).

## 🧭 Training System Integration (from training_ready)
- **Production snapshot**: 52.20GB / 19,330 objects at `s3://pixel-data/` (ChatML JSONL), 8-gate validation passed.
- **Curriculum**: `ai/training_ready/configs/training_curriculum_2025.json` (7-stage SFT + preference alignment), model Wayfarer-2-12B.
- **Voice/Persona**: Tim Fletcher voice integration complete; YouTube transcripts processed (913) and synthesized.
- **Scripts (ready-to-run)**: `ai/training_ready/scripts/verify_final_dataset.py`, `ai/training_ready/scripts/compile_final_dataset.py`, `ai/training_ready/scripts/upload_consolidation_artifacts.py`.
- **Single-command start** (prod-ready per integration doc):
  - `uv run python ai/training_ready/scripts/verify_final_dataset.py --report`
  - `uv run python ai/training_ready/scripts/compile_final_dataset.py --s3-bucket pixel-data`
- **Azure DevOps**: pipeline YAML rebuilt and validated; health/perf checks configured.
- **Status**: PRODUCTION READY (per Dec 29, 2025 integration report).

## 🎯 Training Plan (stages & targets)
- **Base model**: Harbringer-24B / Mistral Small 3.1; optional MoE for V2.
- **Stage 1 (40%) Foundation & Rapport**: Tier1 priority + consolidated foundation; targets empathy ≥0.70, safety ≥0.80.
- **Stage 2 (25%) Therapeutic Expertise & Reasoning**: CoT reasoning (tier3), professional psych, KB grounding; reasoning ≥0.75, clinical accuracy ≥0.80.
- **Stage 3 (20%) Edge Stress Test**: Edge/cisis/trauma sets; crisis accuracy ≥0.85, safety ≥0.90.
- **Stage 4 (15%) Voice & Persona**: Voice data, dual persona, wayfarer-balanced; authenticity ≥0.80, persona consistency ≥0.85.
- **Infra**: Primary Lightning.ai (H100 preferred, A100 acceptable); alternative GKE/Helm; Docker for local. Min resources: 1×H100 or 2×A100, 64GB RAM, 100GB storage.

## 📚 Consolidated Pipeline Specs (retired docs folded here)
- **Stage ladder policy** (from MasterTrainingPlan): Stage1 foundation (40%), Stage2 reasoning (25%), Stage3 edge stress (20%), Stage4 voice/persona (15). Metadata must include `stage`, `source`, `quality_profile`, `voice_signature` (when present). Use `ConversationRecord` schema and StageSampler to enforce ratios; outputs: `MASTER_stage{n}_*.jsonl` plus `FINAL_TRAINING_DATA_MANIFEST.json` with `stage_metrics`.
- **Dedup + cleaning**: Primary hash `sha256(lowercase(concat(role+content)))`, secondary `sha1(conversation_id + stage + source + crisis_intensity)`. Normalize unicode, enrich metadata, tag profanity (do not drop), run PII detector (strip only real identifiers), ensure alternating roles. Conflict order: Stage4 > Stage3 > Stage2 > Stage1.
- **Validators**: Stage1 empathy ≥0.55; Stage2 empathy ≥0.50 + reasoning score ≥0.65 + bias monitor; Stage3 safety lenient `safety_threshold=0.6` with `allow_crisis_override`; Stage4 empathy ≥0.60, safety ≥0.75, voice-style discriminator required.
- **Edge case ingestion (Stage3)**: Refresh edge generator (`ai/pipelines/edge_case_pipeline_standalone/output/edge_cases_training_format.jsonl`), mirror Google Drive prompt corpus to `ai/dataset_pipeline/prompt_corpus/`, pull Kaggle TF-IDF bundle to `ai/datasets/tier4_reddit_archive/`, create safety DPO pairs via `create_safety_dpo_dataset` and store under `quality/output/safety_dpo_pairs.jsonl`. Guard rails: never sanitize crisis content unless real PII.
- **Voice/persona ingestion (Stage4)**: Run `uv run python ai/pipelines/pixel_voice/pipeline.py --transcripts ../../training_data_consolidated/transcripts --output ../../data/tim_fletcher_voice/exports`; dual persona outputs must include `persona_id`; loader writes `stage="stage4_voice_persona"` + `voice_signature` (default `tim_fletcher_voice_profile`).
- **Integrated pipeline quick start**: `cd ai/dataset_pipeline/orchestration && python integrated_training_pipeline.py` balances all sources, writes stage files + `MASTER_STAGE_MANIFEST.json`, and feeds Lightning config. Edge generator quick start: `python ai/pipelines/edge_case_pipeline_standalone/generate_training_data.py --scenarios-per-category 50`.
- **Export/QA operator runbook**: `uv sync && uv run python ai/dataset_pipeline/verify_pipeline.py` to verify env. Export: `uv run python -m ai.dataset_pipeline.export_dataset --version 1.0.0 --target-samples 1000 --seed 42 [--output-dir ./exports --no-upload --no-quality]`. QA report: `uv run python -m ai.dataset_pipeline.qa_report_generator production_exports/v1.0.0/dataset_v1.0.0.jsonl --version 1.0.0 --output production_exports/v1.0.0/qa_report_v1.0.0.json`. QA thresholds: coherence ≥0.8, therapeutic appropriateness ≥0.7, crisis unresolved ≤0.5%, PII 0%, bias ≥0.6, overall ≥0.75.
- **Edge-case safety policy (Master Dataset Plan)**: Edge cases tagged `is_training_edge_case: true` bypass safety filters entirely; only format/coherence validation applies. Do not downsample edge categories; keep source tracking for manifest.
- **Knowledge base enhancement**: Psychology KB expanded to 1,114 concepts (added 13 psychology_book_reference entries via xmu_psych_books). Tier6KnowledgeLoader supports the enhanced JSON set.
- **Security audit**: Pydantic 2.5+, bleach 6.1+, pymongo 4.6+, bitarray, mmh3, redis 5.x all marked PRODUCTION READY (SEC-AUDIT-2025-09-30-P2). Secrets remain env-only; keep TLS for Redis/Mongo; rerun audit on dependency bumps.
- **Pixel model architecture snapshot**: Infra target 8×A100 80GB (2TB RAM, 10TB NVMe, 100Gbps IB). Model adds EQ head, persona classifier, emotion encoder, clinical accuracy head, empathy regressor atop Qwen2; multi-objective loss over language, EQ, persona, clinical, empathy targets.
- **Tier 1 status (corrected report)**: 8/10 tiers passing (conversation management, memory, crisis detection, augmentation, content filter, bias detection, training config, expert validation dataset). Broken: Tier1.1 `TherapistResponseGenerator` expects `ClinicalContext` (fix parameter handling); Tier1.9 `DataLoaderConfig` requires `dataset_path` default/optional. Tests already mapped.
- **Crisis detection system (doc folded)**: CrisisInterventionDetector handles 10 crisis types with severity bands (emergency ≥0.8, critical ≥0.6, elevated ≥0.4). Escalation protocols require human verification, audit logging (JSON events), and automated contacts (988/911 equivalents) per severity. Integrate via `crisis_intervention_detector.py` and ensure clinical override remains available.

## 🧪 Phase Completion Status (retired docs folded here)
- **Phase 4.3 crisis testing (Jan 9, 2026)**: Mock-based unit tests achieve 100% detection (15/15 crisis, 0/3 FP), <5ms latency. Integration tests reveal MentalHealthAnalyzer gap (6.7% real detection); recommendation: integrate Pixel inference for >95% sensitivity. Session flagging (MongoDB) + CrisisProtocol operational. Commands: `pnpm vitest run tests/crisis-detection/crisis-unit.test.ts` (28 passing), `crisis-integration.test.ts` (6/14 passing), service tests (6 passing).
- **Phase 1 data pipeline**: TherapeuticDataPipeline module created for loading, validation, normalization, enrichment (emotion/technique/cultural), deduplication, balancing, stratified splits (70/15/15). Schema: ConversationTurn + TherapeuticConversation with technique/cultural context/quality score. Status: core classes ready; pending raw load, emotion detection, technique classification, FAISS dedup, export logic.
- **Phase 2 models (Jan 7, 2026)**: All tasks complete. EmotionClassifier (DistilBERT multi-task: valence, arousal, 10 classes), BiasDetector (RoBERTa multi-task: gender/racial/cultural), QualityEvaluator (4-dimension regression: effectiveness/safety/cultural/coherence), DataEnrichment pipeline unified. Training/eval pipelines ready; 16+ tests passing. Commands in `docs/phase2-quick-reference.md` (now folded).
- **Phase 2 deployment checklist**: All deliverables ready (emotion/bias/quality models + training/eval + data enrichment + tests). File structure verified; pre-prod validation: run `uv run pytest tests/test_phase2_models.py -v`. Production validation requires GPU checkpoint training and real data.
- **Phase 3.3 real-time integration (Jan 8, 2026)**: PixelConversationIntegration service complete (session mgmt, turn analysis, EQ aggregation, bias/crisis detection). React hooks: usePixelConversationIntegration (full), usePixelEQMetrics, usePixelCrisisDetection, usePixelBiasDetection. PixelEnhancedChat example component with EQ viz, crisis alerts, bias UI, latency monitoring. Types (PixelInferenceRequest/Response, EQScores, ConversationMetadata, PixelModelStatus) in `src/types/pixel.ts`.

## ⚡ QUICK START BY ROLE

### **Project Manager / Team Lead**
1. **Timeline**: 3 weeks, 4 phases (see timeline below)
2. **Team**: Assign 1 Data Engineer, 1 ML Engineer, 5-10 annotators, 1 QA, 1 clinical lead
3. **Resources**: GPU (A100/V100, 40GB), 100GB storage, data access
4. **Track**: Use checklist below (copy to JIRA)
5. **Success**: >95% sensitivity, <5% false positives, <200ms latency

**Your job**: Assign people, secure GPU, monitor checklist progress.

---

### **Data Engineer (Week 1-2 Lead)**
1. **Week 1 (Phase 1)**: Generate 3K synthetic + collect 1.5K real + annotate all 4.5K
2. **Week 2 (Phase 2)**: Augment data (paraphrase + edge cases) → compile 5K total
3. **Reference**: See "DATA ENGINEERING DETAILS" below
4. **Track**: Update daily checklist
5. **Handoff**: Deliver 5,000+ annotated JSONL to ML engineer

**Your job**: Collect & annotate dataset per specification.

---

### **ML Engineer (Week 3-4 Lead)**
1. **Week 3 (Phase 3)**: Setup training pipeline, tune hyperparameters, achieve >95% accuracy
2. **Week 4 (Phase 4)**: Load model in API, run E2E tests, deploy
3. **Reference**: See "ML ENGINEERING DETAILS" below
4. **Infrastructure**: `ai/training_ready/MASTER_TRAINING_EPIC.md` has training setup
5. **Handoff**: Trained model (v1.0.0) loaded in API, 10/11 tests passing

**Your job**: Train model to >95%, validate metrics, deploy.

---

### **QA / Validation Engineer**
1. **Phase 1**: Validate annotation quality (Kappa >0.85)
2. **Phase 2**: Validate data balance, deduplication
3. **Phase 3**: Validate model metrics (>95% sensitivity, <5% FP, <200ms latency)
4. **Phase 4**: E2E test validation (10/11 passing)
5. **Reference**: See "VALIDATION DETAILS" below

**Your job**: Run quality gates at each checkpoint.

---

### **Clinical Lead / Mental Health Expert**
1. **Phase 1.3**: Review annotation guidelines, approve quality
2. **Phase 2**: Verify edge case preservation (no inappropriate filtering)
3. **Phase 4**: Expert review & clinical sign-off
4. **Reference**: See "CLINICAL DETAILS" below

**Your job**: Ensure clinical appropriateness & safety.

---

## 📅 TIMELINE & PHASES

### **PHASE 1: Dataset Creation (Week 1, Jan 9-15)**

**Task 1.1: Generate 3,000 Synthetic Conversations**
- Target: All 6 crisis types (immediate_harm, self_harm, substance, panic, psychotic, passive_ideation)
- Format: ChatML JSONL ({"role": "user/assistant", "content": "..."})
- Quality: Realistic, diverse, clinically appropriate
- **Owner**: Data Engineer
- **Subtasks**:
  - [ ] Create templates for each crisis type (2 days)
  - [ ] Generate variations using Nemotron3 or manual creation (2 days)
  - [ ] QA review for quality (1 day)
- **Success**: 3,000+ samples in JSONL format

**Task 1.2: Collect 1,500 Real Conversations**
- Source: Crisis Text Line (or alternative with IRB approval)
- Anonymization: Remove PII, maintain therapeutic context
- Diversity: All crisis types represented, demographics varied
- **Owner**: Data Engineer
- **Subtasks**:
  - [ ] Obtain data access agreement (2 days)
  - [ ] Sync remaining GDrive backlog (~3.6GB) → `s3://pixel-data/gdrive/processed/` via VPS/rclone (see [ai/training_ready/MASTER_TRAINING_EPIC.md](ai/training_ready/MASTER_TRAINING_EPIC.md))
  - [ ] Download & anonymize (1 day)
  - [ ] Verify completeness (1 day)
  - [ ] Initial QA pass (1 day)
- **Success**: 1,500+ anonymized, real conversations

**Task 1.3: Annotation Setup & Execution**
- Annotators: 5-10 trained annotators
- Quality Target: Kappa >0.85 (inter-rater agreement)
- Labels: Crisis type, severity (1-5), confidence
- **Owner**: Data Engineer + Annotation Team
- **Subtasks**:
  - [ ] Finalize annotation guidelines (1 day)
  - [ ] Setup annotation tool (Prodigy/MTurk) (1 day)
  - [ ] Train annotators (1 day)
  - [ ] Annotate all 4,500 samples (2 days)
  - [ ] Calculate inter-rater agreement (1 day)
- **Success**: 4,500 annotated samples, Kappa >0.85

**PHASE 1 CHECKLIST** (Copy to JIRA/Daily Standup):
- [ ] Day 1-2: Synthetic templates created
- [ ] Day 2-4: 1,500 synthetic generated
- [ ] Day 4-5: Full 3,000 synthetic done
- [ ] Day 1-3: Data access secured
- [ ] Day 3-4: Real data collected (1,500)
- [ ] Day 1-2: Annotation guidelines approved
- [ ] Day 2-3: Annotation tool setup & training
- [ ] Day 3-5: Annotation in progress (1,500+ done)
- [ ] Day 5-6: Remaining annotation + QA
- [ ] Day 6: Inter-rater agreement calculated (Kappa >0.85?)
- [ ] ✅ EOW: 4,500 annotated samples ready

---

### **PHASE 2: Data Augmentation (Week 2, Jan 16-22)**

**Task 2.1: Generate Paraphrases**
- Method: Paraphrase existing 4,500 samples
- Target: +1,000 variations (diverse wording, same meaning)
- Quality: Maintain crisis type, clinical accuracy
- **Owner**: Data Engineer
- **Subtasks**:
  - [ ] Setup paraphrase pipeline (1 day)
  - [ ] Generate 1,000+ paraphrases (1 day)
  - [ ] QA review (0.5 day)
- **Success**: 1,000+ paraphrased conversations

**Task 2.2: Create Edge Case Variations**
- Target: +500 challenging scenarios
- Types: Sarcasm, metaphors, cultural differences, ambiguous crisis signals
- **Owner**: Data Engineer + Clinical Lead
- **Subtasks**:
  - [ ] Define edge cases (0.5 day)
  - [ ] Create 500+ edge case variations (1 day)
  - [ ] Clinical review (0.5 day)
- **Success**: 500+ edge case conversations

**Task 2.3: Compile Final Dataset**
- Total: 5,000+ samples (4,500 original + 1,000 paraphrased + 500 edge cases, minus duplicates)
- Splits: 70% train, 15% val, 15% test (stratified by crisis type)
- Format: JSONL with metadata (source, crisis_type, edge_case flag)
- Manifest: SHA256 checksums, dataset counts, quality metrics
- **Owner**: Data Engineer
- **Subtasks**:
  - [ ] Deduplicate (Bloom filter) (0.5 day)
  - [ ] Create train/val/test splits (0.5 day)
  - [ ] Generate manifest with checksums (0.5 day)
  - [ ] Create QA report (empathy scores, coherence) (1 day)
- **Success**: 5,000+ final dataset, train/val/test splits ready

**PHASE 2 CHECKLIST**:
- [ ] Day 1: Paraphrase pipeline setup
- [ ] Day 2: 1,000+ paraphrases generated
- [ ] Day 1-2: Edge case variations created (500+)
- [ ] Day 3: Deduplication complete
- [ ] Day 3: Train/val/test splits (70/15/15)
- [ ] Day 4: Manifest generated (checksums, counts)
- [ ] Day 4-5: QA report complete
- [ ] ✅ EOW: 5,000+ dataset ready for training

---

### **PHASE 3: Model Training (Week 3, Jan 23-29)**

**Task 3.1: Setup Training Pipeline**
- Framework: PyTorch (Hugging Face Transformers)
- Base Model: Pixel (transformer, ready to fine-tune)
- Data Loader: Stream from JSONL, batch size TBD
- Loss: Focal Loss (handles class imbalance)
- Optimizer: AdamW with warmup
- **Owner**: ML Engineer
- **Subtasks**:
  - [ ] Setup training environment (GPU, VRAM check) (0.5 day)
  - [ ] Create data loader pipeline (1 day)
  - [ ] Configure model & training loop (1 day)
  - [ ] Dry run (verify no OOM errors) (0.5 day)
- **Success**: Training script ready, can run one epoch without errors

**Task 3.2: Hyperparameter Tuning**
- Grid Search: Learning rate (1e-5 to 5e-5), batch size (16-32), epochs (3-5)
- Validation: Evaluate on val set every epoch, save best checkpoint
- Early Stopping: Stop if val loss plateaus for 2 epochs
- **Owner**: ML Engineer
- **Subtasks**:
  - [ ] Run hyperparameter grid search (1-2 days)
  - [ ] Analyze results, select best config (0.5 day)
  - [ ] Train final model with best hyperparameters (1-2 days)
  - [ ] Calculate final metrics (sensitivity, specificity, F1) (0.5 day)
- **Success**: >95% sensitivity on test set, <5% false positive rate

**Task 3.3: Validation & Checkpointing**
- Test Set: Evaluate on held-out test set (never seen during training)
- Metrics: Sensitivity, specificity, F1, per-type accuracy (all >90%)
- Checkpoint: Save best model as v1.0.0
- Model Card: Document architecture, training data, hyperparameters, metrics
- **Owner**: ML Engineer
- **Subtasks**:
  - [ ] Evaluate on test set (all metrics) (1 day)
  - [ ] Save checkpoint v1.0.0 (0.5 day)
  - [ ] Create model card documentation (1 day)
  - [ ] Validate inference latency <200ms (0.5 day)
- **Success**: Trained model v1.0.0 checkpoint with >95% accuracy

**PHASE 3 CHECKLIST**:
- [ ] Day 1: Training environment setup
- [ ] Day 1-2: Data pipeline working
- [ ] Day 2-3: Model training script ready
- [ ] Day 3: Hyperparameter search started
- [ ] Day 4-5: Grid search complete, best config selected
- [ ] Day 5: Final model trained (v1.0.0 checkpoint saved)
- [ ] Day 6: Test set evaluation complete
- [ ] Day 6-7: Metrics confirmed: >95% sensitivity, <5% FP, >90% per-type
- [ ] Day 7: Model card created
- [ ] ✅ EOW: Trained model v1.0.0 ready for deployment

---

### **PHASE 4: Deployment & Validation (Week 4+, Jan 30+)**

#### 📡 Deployment Snapshot (Jan 9, 2026)
- Pixel inference service running on :8001 ([ai/api/pixel_inference_service.py](ai/api/pixel_inference_service.py)), health endpoint reports healthy; real inference validated on crisis text.
- Integration tests: 10/11 passing (skipped >95% accuracy check until trained checkpoint is loaded); alert levels initialized (emergency, urgent, severe, concern); added passive-ideation keyword coverage in mock API.
- Performance: ~65ms inference time (under 200ms target) on current untrained checkpoint; uses FastAPI + PyTorch.
- Required before production: load trained checkpoint at `ai/pixel/models/pixel_therapeutic_v1.pt`, rerun full E2E with trained model ([tests/crisis-detection/crisis-integration.test.ts](tests/crisis-detection/crisis-integration.test.ts)), performance/load testing, security scan, Prometheus/Grafana monitoring, and clinical sign-off.

#### 🧠 Crisis Detector Integration (condensed from prior integration summary)
- Component: `src/lib/ai/crisis/PixelCrisisDetector.ts` → calls Pixel API at `http://localhost:8001/infer`; maintains last 10 messages, EQ/safety scoring, and keyword fallback with 5s timeout.
- Crisis signals covered: immediate_harm, suicide_plan, self_harm, substance_overdose, severe_panic, psychotic_symptoms, suicidal_ideation.
- Before vs After: replaced regex `MentalHealthAnalyzer` (6.7% sensitivity) with Pixel deep-learning inference (<50ms target, >95% sensitivity goal) feeding into `CrisisProtocol`.
- Integration tests (18 scenarios) use a rich mock API with contextual patterns across crisis types and non-crisis controls; >95% test is skipped until trained checkpoint is loaded.
- Performance targets: latency <50ms (API), <200ms end-to-end; false positives <5%; bias/safety monitored via safety_score and crisis signal set.

**Task 4.1: Load Model in API Service**
- API: `ai/api/pixel_inference_service.py` (already running on localhost:8001)
- Checkpoint: Load v1.0.0 model
- Inference: Test single prediction
- **Owner**: ML Engineer
- **Subtasks**:
  - [ ] Update API to load v1.0.0 checkpoint (0.5 day)
  - [ ] Test health check endpoint (0.5 day)
  - [ ] Test inference with sample crisis text (0.5 day)
- **Success**: API health check passing, inference working

**Task 4.2: Run E2E Tests**
- Tests: `tests/crisis-detection/crisis-integration.test.ts` (10/11 currently passing)
- 1 Skipped Test: ">95% accuracy test" will now pass with trained model
- Test Scenarios: 18 comprehensive crisis cases (all types)
- **Owner**: ML Engineer + QA
- **Subtasks**:
  - [ ] Run all 11 integration tests (1 day)
  - [ ] Update >95% accuracy test to use real model (0.5 day)
  - [ ] Verify all 11 tests passing (0.5 day)
  - [ ] Load testing: 100+ concurrent requests (0.5 day)
- **Success**: 11/11 tests passing, API handles load

**Task 4.3: Production Deployment & Expert Review**
- Deployment: Push to production (Vercel/Azure)
- Expert Review: Clinical lead signs off on model performance
- Monitoring: Prometheus/Grafana metrics active
- Documentation: Updated deployment docs
- **Owner**: ML Engineer + Clinical Lead
- **Subtasks**:
  - [ ] Deploy to production (0.5 day)
  - [ ] Clinical expert review (0.5-1 day)
  - [ ] Setup monitoring/alerting (0.5 day)
  - [ ] Update documentation (0.5 day)
- **Success**: Model in production, expert approved, monitoring active

**PHASE 4 CHECKLIST**:
- [ ] Day 1-2: v1.0.0 model loaded in API
- [ ] Day 2: Health check passing
- [ ] Day 2-3: Inference working, latency <200ms
- [ ] Day 3-4: All 11 integration tests passing
- [ ] Day 4: Load testing complete (100+ concurrent)
- [ ] Day 5: Clinical expert review done
- [ ] Day 5-6: Deployed to production
- [ ] Day 6: Monitoring/alerting active
- [ ] Day 7: Documentation updated
- [ ] ✅ EOW+: Model in production, expert approved

---

## 📊 SUCCESS METRICS

| Metric | Target | When | How |
|--------|--------|------|-----|
| **Crisis Detection Sensitivity** | >95% | Week 3 EOW | Test set: TP / (TP + FN) |
| **False Positive Rate** | <5% | Week 3 EOW | Test set: FP / (FP + TN) |
| **Inference Latency** | <200ms | Week 4 | API inference time |
| **Per-Type Accuracy** | >90% each | Week 3 EOW | F1 score per type (6 types) |
| **Test Coverage** | 11/11 passing | Week 4 | Integration tests |
| **Dataset Size** | 5,000+ samples | Week 2 EOW | Total annotated |
| **Annotation Quality** | Kappa >0.85 | Week 1 EOW | Inter-rater agreement |

---

## 🛠️ DATA ENGINEERING DETAILS

### **Annotation Schema**
```json
{
  "id": "unique_id",
  "conversation": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "crisis_type": "immediate_harm|self_harm|substance|panic|psychotic|passive_ideation",
  "severity": 1-5,
  "confidence": 0.0-1.0,
  "source": "synthetic|real|augmented",
  "is_edge_case": true|false,
  "annotators": ["name1", "name2"],
  "metadata": {
    "demographics": "age, gender",
    "context": "brief note"
  }
}
```

### **Data Quality Gates**
- **Deduplication**: Bloom filter on conversation content
- **Coherence**: >0.7 semantic similarity within turn
- **PII Detection**: Automated + manual review for real data
- **Balance**: Each crisis type ≥250 samples in train set

### **S3 Storage** (Existing Infrastructure)
- Dataset path: `s3://pixel-data/final_dataset/`
- Backup: Daily snapshots
- Access: Configured in environment (see `ai/.env`)

---

## 🤖 ML ENGINEERING DETAILS

### **Model Architecture**
- Base: Pixel (transformer, ~12B parameters)
- Task: Classification (6 crisis types)
- Loss: Focal Loss (γ=2, α=0.25)
- Optimizer: AdamW (lr=3e-5, warmup=500 steps)
- Scheduler: Linear warmup + cosine decay

### **Training Configuration**
- Batch size: 16 (per GPU)
- Epochs: 3-5 (early stopping if no improvement)
- Validation: Every epoch on val set
- Checkpointing: Save best model (highest val F1)
- Hardware: A100 40GB recommended (V100 OK)

### **Hyperparameter Grid Search**
- Learning rate: 1e-5, 3e-5, 5e-5
- Batch size: 16, 32
- Epochs: 3, 4, 5
- Best config saves time in Phase 3.2

### **Inference Optimization**
- Quantization: INT8 for faster inference (optional)
- Batch inference: Process 32+ samples at once
- Caching: Redis for frequent queries (optional)
- Target latency: <200ms per request

---

## ✅ VALIDATION DETAILS

### **Quality Gates by Phase**

**Phase 1 (Annotation Quality)**
- [ ] Kappa >0.85 (inter-rater agreement)
- [ ] No duplicate conversations
- [ ] All 6 crisis types represented
- [ ] No glaring PII in real data

**Phase 2 (Dataset Balance)**
- [ ] 5,000+ total samples
- [ ] ≥250 samples per crisis type in train
- [ ] Deduplication: <0.1% duplicates
- [ ] No data leakage (no test in train)

**Phase 3 (Model Performance)**
- [ ] Sensitivity >95% (catch crises)
- [ ] Specificity >95% (avoid false alarms)
- [ ] F1 >0.94 (balanced metric)
- [ ] Per-type F1 >0.90 (all types strong)

**Phase 4 (E2E Validation)**
- [ ] 11/11 integration tests passing
- [ ] Inference latency <200ms (p95)
- [ ] Load testing: 100+ concurrent OK
- [ ] Expert clinical review passed

---

## 🏥 CLINICAL DETAILS

### **Annotation Guidelines** (Created Phase 1.3)
- Crisis Type Definitions: Clear criteria for each type
- Severity Scale: 1 (mild concern) → 5 (immediate danger)
- Edge Cases: Examples of sarcasm, metaphors, ambiguous language
- Quality: Realistic, clinically appropriate, diverse

### **Edge Case Preservation** (CRITICAL)
- **Rule**: Training data includes ALL edge cases, no safety filtering
- **Why**: Model must learn to recognize difficult scenarios
- **Safety**: Apply safety filtering ONLY at inference time
- **Examples**: Suicidality, psychosis, trauma, abuse (all included in training)

### **Expert Review Process** (Phase 4)
1. Review model predictions on 100+ diverse test cases
2. Check for bias (demographic fairness)
3. Verify sensitivity doesn't miss real crises
4. Validate specificity doesn't over-escalate
5. Sign-off: Clinical lead approves production deployment

---

## 📋 MASTER CHECKLIST (Copy to JIRA)

```
PHASE 1: Dataset Creation (Week 1, Jan 9-15)
═════════════════════════════════════════════════
Task 1.1: Generate 3,000 Synthetic Conversations
  ☐ Day 1-2: Create templates for 6 crisis types
  ☐ Day 2-4: Generate 1,500 synthetic (batch 1)
  ☐ Day 4-5: Generate remaining 1,500 (batch 2)
  ☐ Day 5: QA review + fix issues
  ☐ SUCCESS: 3,000 synthetic in JSONL ✓

Task 1.2: Collect 1,500 Real Conversations
  ☐ Day 1-2: Obtain data access agreement
  ☐ Day 2-3: Download data from Crisis Text Line
  ☐ Day 3: Anonymize + remove PII
  ☐ Day 4: Initial QA pass
  ☐ SUCCESS: 1,500 real, anonymized conversations ✓

Task 1.3: Annotation Setup & Execution
  ☐ Day 1: Finalize annotation guidelines
  ☐ Day 1-2: Setup annotation tool (Prodigy/MTurk)
  ☐ Day 2: Train 5-10 annotators
  ☐ Day 3-4: Annotate 2,250 samples (batch 1)
  ☐ Day 4-5: Annotate remaining 2,250 (batch 2)
  ☐ Day 5-6: QA review + reconcile disagreements
  ☐ Day 6: Calculate Kappa (target: >0.85)
  ☐ SUCCESS: 4,500 annotated, Kappa >0.85 ✓

PHASE 1 DONE: 4,500 annotated dataset ready ✓✓✓

PHASE 2: Data Augmentation (Week 2, Jan 16-22)
═════════════════════════════════════════════════
Task 2.1: Generate Paraphrases
  ☐ Day 1: Setup paraphrase pipeline
  ☐ Day 1-2: Generate 1,000+ paraphrases
  ☐ Day 2: QA review
  ☐ SUCCESS: 1,000 paraphrased conversations ✓

Task 2.2: Create Edge Case Variations
  ☐ Day 1: Define edge case categories
  ☐ Day 1-2: Create 500+ edge case variations
  ☐ Day 2: Clinical review
  ☐ SUCCESS: 500 edge case conversations ✓

Task 2.3: Compile Final Dataset
  ☐ Day 3: Deduplication (Bloom filter)
  ☐ Day 3: Create 70/15/15 train/val/test splits
  ☐ Day 3: Generate manifest (checksums, counts)
  ☐ Day 4-5: Create QA report (quality metrics)
  ☐ SUCCESS: 5,000+ dataset, splits ready ✓

PHASE 2 DONE: 5,000+ final dataset ready ✓✓✓

PHASE 3: Model Training (Week 3, Jan 23-29)
═════════════════════════════════════════════════
Task 3.1: Setup Training Pipeline
  ☐ Day 1: Setup GPU environment (check VRAM)
  ☐ Day 1-2: Create data loader pipeline
  ☐ Day 2: Configure model + training loop
  ☐ Day 2-3: Dry run (test for OOM errors)
  ☐ SUCCESS: Training script ready ✓

Task 3.2: Hyperparameter Tuning
  ☐ Day 3-4: Run hyperparameter grid search
  ☐ Day 4: Analyze results, select best config
  ☐ Day 4-5: Train final model with best hyperparameters
  ☐ Day 5: Calculate metrics on test set
  ☐ SUCCESS: >95% sensitivity achieved ✓

Task 3.3: Validation & Checkpointing
  ☐ Day 6: Evaluate all metrics (sensitivity, specificity, F1)
  ☐ Day 6: Verify per-type F1 >0.90 (all 6 types)
  ☐ Day 6: Save checkpoint v1.0.0
  ☐ Day 6-7: Create model card documentation
  ☐ Day 7: Validate inference latency <200ms
  ☐ SUCCESS: Model v1.0.0 checkpoint ready ✓

PHASE 3 DONE: Trained model v1.0.0 ✓✓✓

PHASE 4: Deployment & Validation (Week 4+, Jan 30+)
═════════════════════════════════════════════════════
Task 4.1: Load Model in API Service
  ☐ Day 1: Load v1.0.0 checkpoint in API
  ☐ Day 1: Verify health check passing
  ☐ Day 1-2: Test inference with sample crisis text
  ☐ SUCCESS: API health + inference working ✓

Task 4.2: Run E2E Tests
  ☐ Day 2-3: Run all 11 integration tests
  ☐ Day 3: Update >95% accuracy test (now passes)
  ☐ Day 3: Verify 11/11 tests passing
  ☐ Day 3-4: Load testing (100+ concurrent requests)
  ☐ SUCCESS: 11/11 tests passing ✓

Task 4.3: Production Deployment & Expert Review
  ☐ Day 4-5: Deploy to production (Vercel/Azure)
  ☐ Day 5: Clinical expert review (bias, fairness, safety)
  ☐ Day 5-6: Setup monitoring (Prometheus/Grafana)
  ☐ Day 6-7: Update documentation
  ☐ SUCCESS: Model in production, expert approved ✓

PHASE 4 DONE: Production deployment complete ✓✓✓

FINAL SUCCESS CRITERIA:
═══════════════════════════════════════════════════
✓ 5,000+ annotated dataset created
✓ >95% crisis detection sensitivity
✓ <5% false positive rate
✓ <200ms inference latency
✓ 11/11 integration tests passing
✓ Model v1.0.0 in production
✓ Clinical expert approval obtained
✓ Monitoring active
```

---

## 🚀 RESOURCES NEEDED

**Team**:
- 1 Data Engineer (Weeks 1-2 lead)
- 1 ML Engineer (Weeks 3-4 lead)
- 5-10 Annotation Team (Week 1)
- 1 QA Engineer (all weeks)
- 1 Clinical Lead (Weeks 1, 4)

**Infrastructure**:
- GPU: A100 40GB or V100 32GB (required for Phase 3)
- Storage: 100GB+ (datasets + models)
- Data: Crisis Text Line access (or alternative with IRB)
- Tools: Annotation platform (Prodigy/MTurk/custom)

**Timeline**:
- Week 1: Phase 1 (dataset creation)
- Week 2: Phase 2 (augmentation)
- Week 3: Phase 3 (training)
- Week 4+: Phase 4 (deployment)

---

## 📚 REFERENCES TO EXISTING DOCS

**If you need background on infrastructure:**
- `ai/training_ready/MASTER_TRAINING_EPIC.md` - 52.20GB existing S3 dataset
- `ai/dataset_pipeline/MASTER_DATASET_PLAN.md` - Data harmonization strategy
- `ai/dataset_pipeline/OPERATOR_RUNBOOK.md` - How to run data pipeline

**If you need test scenarios:**
- `tests/crisis-detection/crisis-integration.test.ts` - 11 integration tests
- `tests/crisis-detection/crisis-test-scenarios.ts` - 18 test cases (all crisis types)

**If you need API reference:**
- `ai/api/pixel_inference_service.py` - Running on localhost:8001
- `src/lib/ai/crisis/PixelCrisisDetector.ts` - TypeScript integration layer

---

## ⚠️ CRITICAL NOTES

1. **Edge Cases Must Not Be Filtered**: Training data includes difficult scenarios (suicidality, psychosis, trauma). Do NOT apply safety filters to training data - only at inference.

2. **Annotation Quality is Critical**: Kappa >0.85 is non-negotiable. If below, retrain annotators or simplify guidelines.

3. **Test Data is Held-Out**: Never use test set during training. Validation set only for hyperparameter tuning.

4. **Inference Latency Target**: <200ms is a hard requirement for real-time therapeutic feedback.

5. **Expert Approval is Mandatory**: Model cannot go to production without clinical expert sign-off.

---

## ✅ DONE

Everything needed is here in one place:
- ✅ Timeline (3 weeks, 4 phases, 12 tasks)
- ✅ Team assignments (roles & responsibilities)
- ✅ Success metrics (targets & how to measure)
- ✅ Detailed checklists (copy to JIRA)
- ✅ Resources needed (GPU, team, data)
- ✅ References (existing docs when needed)

**Next**: Assign team members, secure resources, start Phase 1 this week.

**Status**: 🟢 **READY FOR EXECUTION**
