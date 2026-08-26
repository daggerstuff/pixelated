# Clinical Validity Closed-Loop Feedback Pipeline

This document describes the Mission 3/3 closed-loop pipeline that closes the
human-in-the-loop feedback cycle, integrating the production pilot scorer into
the SDG pipeline and adding advanced routing rules driven by calibration
metadata.

## Pipeline Overview

```
SDG Pipeline (synthetic data generation)
    │
    ▼
┌─────────────────────────────┐
│  Hybrid Scorer             │
│  ┌───────────────────────┐ │
│  │ Regex Scorer (default)│ │
│  │ or                    │ │
│  │ Pilot Scorer (opt-in) │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
    │
    ├─── score >= 0.6 ────────────────────────────► Accepted (output JSONL)
    │
    ├─── 0.4 <= score < 0.6 ─────────────────────► Borderline
    │                                                   │
    ▼                                                   ▼
┌─────────────────────────────┐              ┌─────────────────────────┐
│  Routing Decider           │              │  Annotation Queue       │
│  + Advanced Routing Rules  │              │  (FastAPI, port 3102)   │
└─────────────────────────────┘              └─────────────────────────┘
    │                                                   │
    │                                                   ▼
    │                                          ┌─────────────────────────┐
    │                                          │  Expert Review         │
    │                                          │  (PATCH /queue/{id}/    │
    │                                          │   review)               │
    │                                          └─────────────────────────┘
    │                                                   │
    │                                                   ▼
    │                                          ┌─────────────────────────┐
    └─── score < 0.4 ────────────────────────► │  Closed-Loop            │
                                                │  Promotion Service      │
                                                │  (run-once CLI)         │
                                                └─────────────────────────┘
                                                     │
                        ┌────────────────────────────┼────────────────────────────┐
                        ▼                            ▼                            ▼
              ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
              │ Validated       │         │ Rejected         │         │ Merged           │
              │ (validated/     │         │ (rejection       │         │ (merged into     │
              │  {timestamp}.   │         │  reasons:        │         │  final dataset)  │
              │  jsonl)         │         │  low_agreement,  │         │                  │
              │                │         │  safety_violation│        │                  │
              │                │         │  duplicate_text, │         │                  │
              │                │         │  schema_violation│        │                  │
              └──────────────────┘         └──────────────────┘         └──────────────────┘
```

## Environment Variables

| Variable                      | Default                              | Description                                             |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `CLINICAL_VALIDITY_USE_PILOT` | `0` (not set)                        | Set to `1` to enable the production pilot scorer.       |
| `CLINICAL_VALIDITY_FORCE_CPU` | `0` (not set)                        | Set to `1` to force CPU mode even if CUDA is available. |
| `ANNOTATION_API_URL`          | `http://localhost:3102`              | Base URL of the annotation queue FastAPI service.       |
| `DATABASE_URL`                | `sqlite:///data/annotation_queue.db` | SQLAlchemy database URL for the annotation queue.       |

## Scorer Selection

The hybrid scorer factory selects between:

- **Regex Scorer** (default): Always available, CPU-only, based on
  keyword-density regex across 6 dimensions.
- **Pilot Scorer** (opt-in): GPU-accelerated production model. Enabled when
  `CLINICAL_VALIDITY_USE_PILOT=1` and CUDA is available. Auto-falls back to
  regex if pilot is unavailable.

## Manual Trigger Recipe

To run the closed-loop promotion service once (useful for cron jobs, GHA
workflows, or manual triggering):

```bash
uv run python -m training.coaching_safety.closed_loop_promotion run-once
```

Optional flags:

```bash
uv run python -m training.coaching_safety.closed_loop_promotion run-once \
  --gold-set-threshold 0.6 \
  --annotation-api-url http://localhost:3102 \
  --database-url "sqlite:///data/annotation_queue.db" \
  --verbose
```

The service will:

1. Fetch all queue items with status `reviewed` from the database.
2. Validate each item (see Decision Rules below).
3. Export validated items to `data/closed_loop/validated/{timestamp}.jsonl`.
4. Merge validated items into the final dataset via `merge_final_dataset.py`.
5. Write a promotion report to
   `data/closed_loop/reports/promotion_report_{timestamp}.json`.

## Promotion Decision Rules

Each reviewed item is validated against the following rules in order. An item is
**rejected** if any rule fails.

| Rule                | Threshold                     | Rejection Reason   | Description                                       |
| ------------------- | ----------------------------- | ------------------ | ------------------------------------------------- |
| Gold-set agreement  | `agreement < 0.6`             | `low_agreement`    | Reviewer score must agree with original score.    |
| Schema validation   | `score not in [0, 1]`         | `schema_violation` | All scores must be in [0, 1].                     |
| Safety check        | `safety_violation detected`   | `safety_violation` | Text must not trigger crisis patterns.            |
| Duplicate detection | `text hash exists in dataset` | `duplicate_text`   | Text must not duplicate existing dataset entries. |

If all rules pass, the item is **validated** and exported.

### Rejection Reason Breakdown

The promotion report includes a `reasons` field with counts per rejection type:

```json
{
  "received": 10,
  "validated": 7,
  "rejected": 3,
  "merged": 7,
  "reasons": {
    "low_agreement": 1,
    "safety_violation": 1,
    "duplicate_text": 1
  }
}
```

## Staged Workflow

Promotion follows a strict staged workflow that cannot be skipped:

```
pending_review → reviewed → validated → merged
```

- `pending_review`: Initial state when item enters queue.
- `reviewed`: Expert has submitted a review (via `PATCH /queue/{id}/review`).
- `validated`: Closed-loop promotion service has validated the item.
- `merged`: Item has been merged into the final dataset.

Skipping stages (e.g., promoting directly from `pending_review` to `merged`)
returns HTTP 409 Conflict.

## API Endpoints (Mission 3/3)

| Method | Endpoint                   | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| PATCH  | `/queue/{item_id}/review`  | Submit expert review (reviewer_score). |
| POST   | `/queue/{item_id}/promote` | Promote item to next workflow stage.   |

## Calibration Metrics

The `CalibrationMetricsAggregator` computes metrics from routing and scoring
reports:

- **borderline_rate**: Fraction of scores in [0.4, 0.6).
- **expert_disagreement_rate**: Fraction of reviewed items where |expert -
  scorer| > 0.2.
- **safety_variance**: Standard deviation of safety scores per scorer.

These metrics feed into `AdvancedRoutingRules` for dynamic routing decisions.

## Related Files

| File                                                   | Purpose                              |
| ------------------------------------------------------ | ------------------------------------ |
| `ai/training/coaching_safety/closed_loop_promotion.py` | Promotion service implementation     |
| `ai/training/coaching_safety/calibration_metrics.py`   | Calibration metrics aggregator       |
| `ai/training/coaching_safety/advanced_routing.py`      | Advanced routing rules               |
| `ai/training/sdg_pipeline.py`                          | SDG pipeline with clinical validity  |
| `ai/annotation_api/main.py`                            | Annotation queue FastAPI service     |
| `ai/training/clinical_validity_scorer.py`              | Regex-based clinical validity scorer |
| `ai/training/pixelated_production_pilot.py`            | Production pilot model (GPU)         |
