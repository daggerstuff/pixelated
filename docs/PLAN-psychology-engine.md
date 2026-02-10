# 🧠 PROMETHEUS: The Psychology Engine Execution Plan

**Status**: 🚀 **EXECUTION READY**
**Date**: 2026-02-10
**Context**: Unification of Data Pipeline (Phase 1), Annotation (Phase 1.3), and Training Strategy (Phase 2+).

---

## 🎯 Executive Summary

The "Psychology Engine" is the transition from **infrastructure** (pipelines, databases) to **intelligence** (trained models).
We are currently at the **Data Handoff** point. The infrastructure is online, the raw data is 85% ready, but the **Labeled Intelligence** (annotation) is the critical blocker for the Pixel Model.

### 🛑 Critical Path Blockers
1.  **Raw Data Completion**: 15% remaining (Edge cases, Long-running extraction).
2.  **Annotation**: Zero qualified labels. Blocks **Phase B (SFT)**.

---

## 🗓️ Phase 1: Foundation Data Completion (Immediate: Hours 0-24)

**Objective**: Finalize the 60,000+ sample raw dataset.
**Reference**: `.memory/65-EXECUTION-HANDOFF.md`

| Task | Status | Action |
| :--- | :--- | :--- |
| **Edge Case Synthetic** | ⚠️ 50/10k | Run `generate_edge_case_synthetic_dataset.py` (Scale to 10k) |
| **Long-Running Therapy** | ⚠️ Partial | Run `extract_long_running_therapy.py` |
| **Nightmare Fuel** | ⚠️ Hydrating | Compete Hydration & Ultra-Nightmare generation |
| **Final Compilation** | ⏳ Pending | Run `compile_final_dataset.py` |

**👉 EXECUTION COMMAND (Staging VPS):**
```bash
ssh staging "bash ~/pixelated/scripts/run_phase1_full.sh"
```
*(Note: `verify_final_dataset.py` fix may be required if operating on S3 directly, but local compilation is prioritized).*

---

## 🏷️ Phase 2: The Annotation Campaign (Weeks 1-3)

**Objective**: Create the "Gold Standard" labeled dataset for SFT.
**Reference**: `docs/next-task-plan.md`, `docs/recruitment-plan.md`

**The "Psychology Engine" requires labeled intent, not just raw text.**

### 2.1 Recruitment (Days 1-7)
*   **Target**: 5 Clinical Annotators (Masters/PhD level).
*   **Channels**: Professional Networks, Academic Depts.
*   **Action**: Execute `recruitment-plan.md`.

### 2.2 Annotation Process (Weeks 2-3)
*   **Volume**: 5,000 High-Impact Samples.
*   **Labels**: Crisis Intensity, Therapeutic Modality, Empathy Score.
*   **Success Metric**: Inter-annotator Agreement (Kappa) > 0.85.

---

## 🧠 Phase 3: Model Training (Weeks 2-5)

**Objective**: Train the Pixelated Empathy Model (Wayfarer-2-12B Base).
**Reference**: `ai/training_ready/docs/TRAINING_CURRICULUM_2025.md`

### Phase A: Continued Pretraining (Week 2)
*   **Data**: The 60k Raw Samples from Phase 1.
*   **Goal**: Domain Adaptation (Vocabulary & Tone).
*   **Infrastructure**: Lightning.ai / H100 Cluster.

### Phase B: SFT Curriculum (Weeks 3-4)
*   **Data**: The 5k Annotated Samples from Phase 2 + Professional Datasets.
*   **Stages**:
    1.  Foundation (Rapport)
    2.  Expertise (Reasoning chains)
    3.  Edge Stress (Crisis)
    4.  Voice Persona (Tim Fletcher)

### Phase C: Alignment (Week 5)
*   **Method**: ORPO / DPO.
*   **Data**: Preference pairs from Annotation phase.

---

## ⚡ Phase 4: Deployment & Runtime (Week 6+)

**Objective**: Activation of the "Therapeutic Session" resource.
**Reference**: `docs/ngc-therapeutic-enhancement-checklist.md`

*   **Inference**: Deploy `PixelInferenceService` on Triton.
*   **Monitoring**: Loki/Prometheus (Configured & Verified).
*   **Feedback**: Real-time "Supervisor" loop enabled.

---

## ✅ Success Verification

1.  **Data**: `s3://pixel-data/final_dataset/manifest.json` exists and validates.
2.  **Labels**: 5,000 samples with Kappa > 0.85.
3.  **Model**: Checkpoint uploaded to S3 with Benchmarks (Empathy PQ > 0.80).

**Immediate Next Step**:
Execute **Phase 1** scripts on VPS to unlock the Raw Data for Phase A training.
