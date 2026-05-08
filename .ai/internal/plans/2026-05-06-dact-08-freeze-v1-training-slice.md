# DACT-08: Freeze v1 Training Slice
**Beads ID**: pixelated-2f6  
**Priority**: 3  
**Status**: Todo (transitioning to In Progress)  

## Context
Based on the completed DACT-09 analysis and the issue description for PIX-184, we need to:
1. Create a versioned v1 dataset snapshot for next training pass
2. Record exact source counts, quality scores, and rejected-source reasons
3. Use the existing normalized datasets and processing artifacts

## Available Assets from DACT-00 through DACT-07
From our analysis:

### Normalized Datasets (ai/data/normalized/)
- `mental_health_counseling_normalized.jsonl` (6.7M records)
- `cot_reasoning_normalized.jsonl` (103K records) 
- Rejected files: *_rejected.jsonl and *_rejected.tmp.jsonl

### Processing Reports
- Normalization reports: `dact04_*_report.json`
- Gate validation: `ai/data/releases/v2026-04-03/gate_validation_report.json` 
- Unified training: `ai/data/unified_training/comprehensive_processing_report.json`
- Redaction report: `ai/data/redacted_datasets/dact07_redaction_report.json`

### Existing Snapshots
- `ai/data/snapshots/snapshots/v1/` contains:
  - Prepared dataset: `openai_dataset.jsonl` 
  - Merged dataset: `mental_health_dataset.jsonl`
  - Train/val split: `train.jsonl` and `validation.jsonl`
  - Slices by stage (foundation, reasoning, edge cases, voice/persona)

## Plan

### Phase 1: Assess Current State
1. **Inventory existing v1 snapshot contents**
2. **Verify data integrity and completeness**
3. **Identify gaps vs requirements**

### Phase 2: Create Definitive v1 Freeze
1. **Consolidate all approved sources** from DACT-00 through DACT-07
2. **Apply final quality filters** based on DACT-09 analysis 
3. **Generate versioned snapshot** with metadata
4. **Document source counts and quality scores**
5. **Record rejected-source reasons**

### Phase 3: Validation and Documentation
1. **Validate frozen dataset** against quality thresholds
2. **Create freeze manifest** with checksums and metadata
3. **Document decisions** for audit trail
4. **Prepare for training pass usage**

## Success Criteria
- Versioned v1 dataset snapshot created with unique identifier
- Exact source counts recorded (by source/family)
- Quality scores documented (empathy, clinical, safety)
- Rejected-source reasons cataloged
- Dataset ready for next training pass
- All artifacts stored in version-controlled location

## Estimated Effort
- Assessment: 1 hour
- Consolidation & freezing: 2-3 hours  
- Validation & documentation: 1 hour
- Total: 4-5 hours