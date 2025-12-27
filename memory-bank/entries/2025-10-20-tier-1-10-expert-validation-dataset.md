# Tier 1.10 – Expert Validation Dataset (No Model Needed)

Date: 2025-10-20
Author: Rovo Dev

Summary
- Implemented expert validation dataset schema and utilities without any model dependency.
- Added JSONL export/import with manifest and validation logic that enforces crisis-preservation and basic data integrity.
- Created sample conversation builder to support quick curation demos and tests.

Key Files
- ai/pixel/training/expert_validation_dataset.py
  - ExpertValidationExample: encapsulates a conversation, scenario type, guidance, annotations, and safety labels.
  - ExpertValidationDataset: collection with stats(), to_jsonl(), from_jsonl(), and curate_from_conversations().
  - build_sample_conversations(): seeds a few diverse examples (anxiety, relationship, crisis) for demos/tests.
- ai/pixel/training/test_expert_validation_dataset.py
  - Round-trip JSONL export/import test.
  - Manifest file creation and verification test.
  - Schema validation failure test for invalid examples.

How to Run
- Python toolchain: uv
- Run tests for this tier only:
  uv run pytest -q ai/pixel/training/test_expert_validation_dataset.py

Notes
- Uses existing schemas when available: Conversation/Message and MetadataSchema/DatasetType. Provides light-weight shims when imports aren’t available, so utilities remain usable in isolation or during partial checkouts.
- Crisis preservation enforced: if crisis keywords detected in conversation text, example.is_crisis must be True (validated).
- Output: JSONL dataset plus a sidecar manifest JSON summarizing size and scenario coverage.

Next Suggestions
- Expand curate_from_conversations() to include diversity balancing and richer scenario inference.
- Integrate with ai/dataset_pipeline/training_manifest.py for registry and reproducibility.
- Wire into expert_workflow to create review tasks from dataset examples (no model needed).
