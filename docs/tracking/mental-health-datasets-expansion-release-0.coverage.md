# Release 0 Coverage Matrix

Generated coverage summary for the canonical Release 0 dataset families.

| Stage | Dataset Family | Prefixes | Status | Sample keys | Notes |
| --- | --- | --- | --- | --- | --- |
| Stage 1 — Foundation | Therapeutic dialogues (canonical or consolidated) | gdrive/processed/professional_therapeutic/, datasets/consolidated/conversations/ | present | datasets/consolidated/conversations/edge_case_dialogues.jsonl, datasets/consolidated/conversations/pixelated_empathy_train_20250526_174637.jsonl, datasets/consolidated/conversations/pixelated_empathy_val_20250526_174637.jsonl, datasets/consolidated/conversations/training_data.jsonl, datasets/consolidated/conversations/unpacked.json | High-quality therapeutic conversations and consolidated conversation exports. |
| Stage 1 — Foundation | Priority datasets | gdrive/processed/priority/, datasets/training_v2/priority/, datasets/training_v3/priority/ | missing | (none) | Priority JSONL exports referenced by curriculum routing. |
| Stage 2 — Therapeutic expertise | Chain-of-thought reasoning | gdrive/processed/cot_reasoning/, datasets/training_v2/cot_reasoning/, datasets/training_v3/cot_reasoning/ | missing | (none) | Clinical reasoning examples (CoT) used for expertise stage. |
| Stage 3 — Edge stress test | Edge/case datasets | gdrive/processed/edge_cases/, edge_cases/, datasets/consolidated/conversations/ | present | datasets/consolidated/conversations/edge_case_dialogues.jsonl, datasets/consolidated/conversations/pixelated_empathy_train_20250526_174637.jsonl, datasets/consolidated/conversations/pixelated_empathy_val_20250526_174637.jsonl, datasets/consolidated/conversations/training_data.jsonl, datasets/consolidated/conversations/unpacked.json | Processed crisis and edge-case scenarios (including consolidated edge_case_dialogues). |
| Stage 4 — Voice/persona | Voice persona assets | voice/, datasets/training_v3/voice/ | missing | (none) | Tim Fletcher + synthetic voice persona files. |
