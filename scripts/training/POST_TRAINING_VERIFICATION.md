# Post-Training Verification

Use this checklist after the anti-repetition retrain finishes.

## 1. Merge or point to the adapter

If you trained a LoRA/QLoRA adapter, either:

- evaluate the adapter directly with `--adapter-path`, or
- merge it first with `scripts/training/merge_lora.py`

## 2. Run repetition evaluation

```bash
uv run python scripts/training/evaluate_repetition.py \
  --model-path LatitudeGames/Wayfarer-2-12B \
  --adapter-path ./pixelated-v2-qlora \
  --prompts-file ai/lab/evals/golden_questions.json \
  --output-file ai/lab/evals/repetition_report.json
```

## 3. Review pass criteria

- `passes_target` must be `true`
- `repetition_rate` must be below `0.05`
- `degenerate_outputs` should be `0` or otherwise clearly acceptable

## 4. Inspect samples

Open `ai/lab/evals/repetition_report.json` and manually inspect generated responses for:

- repeated tokens or phrases
- collapsed outputs like `ops ops ops`
- obvious generic loops

## 5. Close the task

When the report passes:

- attach or link the repetition report in Asana
- note the adapter/model path that was evaluated
- mark the retraining task complete
