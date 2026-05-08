# [MASTER] Unified Pixelated Empathy Dataset & Training Hub

**Date**: 2026-05-08  
**Context**: Final Unified Documentation (DACT + TPI + Linear)  
**Status**: 🚀 Operational Reference

---

## 📊 Project Snapshot (May 2026)

| Metric | Value | Status |
|---|---|---|
| **Total Records Analyzed** | 515,749 | ✅ Milestone Reached |
| **Normalized/Deduped Records** | 18,608 | ✅ DACT-04 Complete |
| **Clinical Pass Rate** | **13.3%** | 🚨 Critical Bottleneck |
| **Safety Compliance** | 100% (Baseline) | 🔄 Directive: Remove filters for training |
| **Empathy Score** | 78.1% | 📈 On Track |

---

## ✅ Linear Work Completion (DACT-04 to DACT-07)

The following work has been audited and pushed to Linear (PIX-247 to PIX-250):

### 1. DACT-04: Normalize & Dedup (PIX-247)
- **Result**: 18,608 final records across 9 dataset families.
- **Output**: `ai/data/normalized/`
- **Key Artifact**: `dact04_normalization_report.json`

### 2. DACT-05: PII & Safety (PIX-248)
- **Result**: PII screening applied, PHI validated as absent.
- **Note**: Conservative redaction mode used to preserve therapeutic context (DACT-07).

### 3. DACT-06: Stage Slicing (PIX-249)
- **Distribution**:
    - **Stage 1 (Foundation)**: 7,876 records (42.3%)
    - **Stage 2 (Expertise)**: 10,601 records (57.0%)
    - **Stage 4 (Voice)**: 131 records (0.7%)
- **Output**: `ai/data/staged_datasets/`

### 4. DACT-07: Redaction & Review (PIX-250)
- **Critical Fix**: Removed broken `full_name` regex causing 124k+ false positives.
- **Scrubbing Results**: Phone (145), URL (311), Email (2), Insurance ID (1).
- **Output**: `ai/data/redacted_datasets/`

---

## 🛠️ Active Training Pipeline (TPI Status)

The implementation surface is active under `ai/training/` with the following status:

### Core Scripts & Status
- **Acquisition**: `youtube_ingestion.py`, `book_pdf_converter.py` (Ready for execution pass).
- **Processing**: `dedup_normalize.py`, `data_audit.py` (Operational).
- **Generation**: `sdg_pipeline.py` (Ready for 15k Nightmare Fuel run).
- **Training**: `dpo_trainer.py`, `grpo_trainer.py` (Functional, awaiting clinical validity boost).
- **Evaluation**: `mental_health_eval.py` (Ready for baseline benchmarks).

---

## 🎯 Unified Strategy & Roadmap (DACT + TPI)

### The "Clinical Validity" Pivot
We are transitioning from "Data Volume" to **"Therapeutic Depth"**.

#### 1. Immediate Execution (Next 48 Hours)
- **[URGENT] Safety Filter Removal**: Strip safety logic from all pipelines to unblock "Difficult Conversation" generation.
- **[P0] PIX-188 Update**: Linear status to 85% Complete. Summary of 515k record analysis.
- **[P0] Clinical Validity Scoring**: Implement scoring mechanism to replace safety-based gating.

#### 2. Phase 1: Bottleneck Resolution
- **Goal**: Increase Clinical Pass Rate from 13.3% → ≥50%.
- **Action**: Focus on high-clinical-value population sources (crisis lines, trauma specialists, addiction counselors).
- **SDG Run**: Generate 15,000 unrestricted nightmare fuel samples.

#### 3. Phase 2: Scaling & Automation
- **Target**: 3x throughput increase.
- **Action**: Parallelize YouTube/Book ingestion. Automate quality reporting with clinical focus.

---

## 🗂️ Unified Artifact Registry

- **Authoritative Registry**: `ai/data/registry/dataset_registry.json`
- **Linear Updates**: `ai/data/linear_updates.json`
- **Knowledge Base**: `ai/data/psychology_knowledge_base_optimized.json` (19MB)
- **Audit Reports**: `ai/data/audit_reports/`

---

## ⚠️ Non-Negotiables & Rules
- **No Safety Filters** for training data (Preserve the "Nightmare Fuel").
- **Overwrite Originals**: No versioned filenames (e.g., `report_v2.json`).
- **Use `uv`**: Always use `uv run` for Python execution.
- **Preserve Edge Cases**: Tag as `is_training_edge_case: true` and bypass evaluative filters.

---
**Compiled by**: Gemini CLI (Vivi)  
**Date**: 2026-05-08  
**Based on**: `.agent/internal` intel, `ai/data` source files, and Linear audit logs.
