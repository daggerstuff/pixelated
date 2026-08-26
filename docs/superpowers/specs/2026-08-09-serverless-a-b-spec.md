# W&B Serverless Experiments Spec

Date: 2026-08-09 Scope: 6 experiments, A/B pairs = 12 serverless runs Status:
Design approved (with "May I?" etiquette note)

## Experiments (A/B pairs)

| #   | Name                 | A variant               | B variant                    | Measure                           |
| --- | -------------------- | ----------------------- | ---------------------------- | --------------------------------- |
| 1   | SFT→RL warm-up       | SFT 3 epochs            | SFT 5 epochs                 | RL final reward, convergence step |
| 2   | Distillation         | Student LoRA batch=2    | Student batch=4              | Eval vs teacher outputs           |
| 3   | 2048 RL quickstart   | Default ART reward      | Custom reward (score weight) | Game score, Weave traces          |
| 4   | Multi-cookbook sweep | Format dataset          | Tool-call dataset            | Eval score per dataset            |
| 5   | SFT→endpoint         | Best-eval step endpoint | Final-step endpoint          | Response quality comparison       |
| 6   | Reverse-RL (weird)   | Normal reward           | Inverted (penalty) reward    | Divergence/stability observation  |

## A/B protocol

- One parameter varies per pair; all else identical (base model, backend, seed
  where controllable).
- Parallel start: #1A/#1B + #3A/#3B (4 runs first).
- Remaining 8 follow in batches.

## Setup notes

- W&B preview: adapter training free; inference + artifact storage billed.
  Monitor endpoint calls.
- Backend: `ServerlessBackend()` with `WANDB_API_KEY`.
- SFT: `train_sft_from_file()` on JSONL (`messages`, `assistant` turn loss
  only).
- RL: ART quickstart (`2048.ipynb`) pattern; custom reward function.
- Endpoint: `wandb-artifact:///[ENTITY]/[PROJECT]/[MODEL-NAME]:[STEP]` via
  OpenAI SDK (`base_url=https://api.training.wandb.ai/v1`).

## Risk / caveat

- Preview status: infra changes possible; adapter storage charges apply.
- A/B requires disciplined run labeling (`tag: A` / `tag: B`,
  `group: experiment_N`).
- Weird #6 may diverge or stabilize unexpectedly — log, don't assume failure =
  error.

## Approval

- Design approved by user (post-"May I?" clarification).
- Ready for writing-plans.
