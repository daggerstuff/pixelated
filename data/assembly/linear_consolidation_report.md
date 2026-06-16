# Linear Issue Consolidation Report

## Master Issue Proposal

**Title**: Final Dataset Assembly — Unified Pipeline

**Description**:
This issue serves as the master tracking issue for the unified dataset assembly pipeline. It consolidates and supersedes the following scattered dataset-related issues:

### Related Issues to Reference
- PIX-3034: Prepare Fine-Tuning Dataset
- PIX-3004: Workstream A: Consolidate acquisition report and next backlog
- PIX-2808: Workstream D: Define training-ready packaging and automation plan
- PIX-2176: Workstream D: Define training-readiness validation gates
- PIX-2175: (Related training pipeline issue)
- PIX-1933: (Dataset related issue)
- PIX-1932: Replace safety scoring with DSM-5-aligned clinical validity scorer
- PIX-1926: (Dataset related issue)
- PIX-463: (Dataset related issue)
- PIX-446: Execute book conversion — remaining titles
- PIX-445: Execute book conversion — priority titles

### Unified Workflow Phases
1. **Discovery & Inventory** (Tasks 1-3)
   - S3 audit complete: `data/assembly/s3_inventory.json`
   - Google Drive scan complete: `data/assembly/gdrive_scan_report.json`
   - Local inventory complete: `data/assembly/local_inventory.json`

2. **Quality Validation** (Tasks 5-7)
   - Clinical validity scorer built and applied
   - Synthetic data re-vetted
   - Book conversions processed

3. **Corpus Assembly** (Tasks 8-10)
   - Full corpus assembled from all sources
   - Deduplication and normalization applied
   - Repetition cleaning completed

4. **Scoring & Selection** (Tasks 11-14)
   - All samples scored for clinical validity
   - Quality report generated
   - Borderline samples handled
   - Final subset assembled

5. **Packaging & Documentation** (Tasks 15-16)
   - Training-ready shards packaged
   - Dataset documentation complete

### Actions Required
1. Create this master issue in Linear
2. Add comments to each related issue linking back to this master issue
3. Mark duplicate/deprecated issues as appropriate
4. Set this issue to "In Progress"

## Note
This consolidation is part of the final-dataset assembly plan executed on 2026-06-13.
