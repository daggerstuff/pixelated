# 🎯 Master Training Epic: Wayfarer-12B End-to-End SFT Pipeline

**Conversation ID**: `973f7890-3d86-42ef-ae3a-7f4a8dace0f2`
(Active: Feb 21-23, 2026)

**Linear Project**: `5df3b29a-c735-40ed-80b0-ffc9950cffbb`
(Wayfarer-12B End-to-End SFT Pipeline)

## Project Overview

> **Single Source of Truth** for all training dataset work, VPS execution,
> S3 streaming, and training curriculum.
>
> This Project supersedes all scattered documentation and provides highly
> detailed, actionable tasks for the 3-phase training process on
> `LatitudeGames/Wayfarer-12B`.

### 🏗️ Architecture & Specs

- **Model Target**: `LatitudeGames/Wayfarer-12B`
- **Dataset Size**: ~3.9M Records | 52.20GB across 19,330 objects (ChatML JSONL)
- **Dataset Canonical**: `s3://pixel-data/final_dataset/`
- **Training Harness**: PyTorch Lightning with PEFT (LoRA) + DeepSpeed
- **Target OS/Compute**: Ubuntu VPS / H100 GPU (64GB+ VRAM)

---

## 📊 The Four Epics (Phases)

| #     | Linear ID   | Title                                                                        | Objective                                                                                                     | Status    |
| ----- | ----------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| **1** | **PIX-137** | **Phase 1: Complete 8-Gate Dataset Quality Validation & Final Assembly**     | Conduct final validation sweep across 52.20GB / 3.9M records before training. Publish to S3 canonical store.  | ✅ Done   |
| **2** | **PIX-140** | **Phase 2 (Stage 1): Execute Wayfarer-12B Foundation SFT Pipeline**          | Execute Foundation Training (40% weight) via `stage1_foundation.json` for base character mapping and empathy. | 🚀 Ready  |
| **3** | **PIX-141** | **Phase 3 (Stage 2): Execute Clinical CoT Context Expansion (2048 Context)** | Inject structured diagnosis scaffolding and clinical reasoning. Expand context length to 2048.                | 🚀 Staged |
| **4** | **PIX-142** | **Phase 3 (Stage 3): Execute Edge-Case Stress Interventions**                | Severe guardrail training against high-intensity trauma, suicide protocols, and abusive edge cases.           | 🚀 Staged |
| **5** | **PIX-143** | **Phase 4: Convert Final Weights to GGUF (Heretic) and Ollama Import**       | Export finalized sequence of LoRA tensors into production-ready `.GGUF` for Ollama/Docker integration.        | 🚀 Staged |

---

## 📈 Milestones & Execution Plan

1. **Phase 1 (Foundation Completion)**: ✅ COMPLETE
   - 8-gate validation passed (Coverage, Leakage, Distribution, PII, etc.)
   - Dataset manifest generated and synced to S3.
2. **Phase 2 Baseline Metrics**: ✅ COMPLETE
   - Empathy Score: **0.8409** (Target: 0.70)
   - Clinical Score: **0.6203** (Target: 0.75 - Needs SFT improvement)
   - Safety Score: **0.9962** (Target: 0.80)
3. **Next Steps (Current Focus)**:
   - **PIX-139**: Provision H100 Node & Deploy Lightning Environment. (Completed)
   - **PIX-140**: Launch Stage 1 Training on VPS. (Active)
   - **PIX-141/142**: Sequential launch of Stages 2 and 3 using Stage 1 checkpoints.

---

**Source Documentation References:**

- `.memory/long_term/50-progress.md`
- `ai/lightning/production/stage_configs/`
- `ai/training/ready_packages/scripts/evaluate_baseline_metrics.py`
