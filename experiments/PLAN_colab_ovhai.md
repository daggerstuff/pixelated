# PLAN — Colab/OVHai Heavy Experiment Path

## Goal

Run the 6 A/B experiment pairs on heavier infrastructure (Google Colab GPU, OVHai) for full-scale training that exceeds serverless limits. The serverless path handles registration and lightweight LoRA; this plan covers local GPU training with the same configs and A/B labeling.

## Resources

- **GPU Ollama Server**: Local GPU for inference and small-scale fine-tuning
- **Google Colab**: T4/A100 credits for medium-scale training runs
- **OVHai**: Managed GPU instances for large-scale training (7B–30B models)

## Architecture

```
Local (experiment_runner.py)
  → registers models via ServerlessBackend
  → launches training_fn (train_sft / train_rl / run_sft_then_rl / run_distillation)
  → training_fn loads data from JSONL, calls art API
  → art delegates to backend (serverless for small, local GPU for heavy)

Heavy path:
  Colab/OVHai notebook
    → installs art, wandb, openai
    → imports configs from wandb/experiments/
    → runs training_fn with LocalBackend or GPU backend
    → logs metrics to W&B under same project/entity
    → saves checkpoints as W&B artifacts
```

## Phase 1 — Colab Notebook (T4/A100)

### File: `wandb/experiments/colab_runner.ipynb`

**Setup cell:**
```python
!pip install art wandb openai
import wandb, art
from art import TrainableModel, TrainSFTConfig
```

**Run a single experiment pair:**
```python
import asyncio
from wandb.experiments.config_experiment_1 import run_exp_1

# Set WANDB_API_KEY as Colab secret
results = await run_exp_1()
```

**Colab-specific considerations:**
- Mount Google Drive for persistent data storage
- Use `wandb.init()` to log to the same project (`serverless-ab`)
- T4:适合 7B models; A100: suitable for 13B–30B
- Runtime timeout: 12h max — checkpoint periodically
- Save LoRA adapters to Google Drive + W&B artifacts

### Experiment sizing by GPU

| GPU   | Model Size | Experiments              | Est. Time/Run |
|-------|-----------|--------------------------|---------------|
| T4    | 7B        | #2 (distill), #4 (SFT)  | 1–3h          |
| A100  | 13B–30B   | #1 (SFT→RL), #3 (RL)    | 3–8h          |
| A100  | 30B       | #5 (endpoint), #6 (RL) | 4–10h         |

## Phase 2 — OVHai Managed Instances

### Setup

```bash
# Launch OVHai GPU instance
ovhai job create <region> <flavor> --gpu <count> \
  --volume data:/data \
  --env WANDB_API_KEY=$WANDB_API_KEY \
  --env OPENAI_API_KEY=$OPENAI_API_KEY
```

### Run via SSH

```bash
# Clone repo, install deps
pip install art wandb openai

# Run a specific experiment pair
python -c "
import asyncio
from wandb.experiments.config_experiment_3 import run_exp_3
asyncio.run(run_exp_3())
"
```

### OVHai advantages
- Persistent storage between runs
- Full GPU control (no timeout)
- Suitable for multi-day RL training (#3, #6)
- Can run all 6 pairs sequentially without interruption

## Phase 3 — Local Ollama Server

### Use case
- Quick iteration on configs and data prep
- Inference for endpoint comparison (Experiment #5)
- Lightweight SFT on small datasets

### Setup
```bash
# Start ollama server
ollama serve

# Pull base model
ollama pull qwen3:30b

# Run local inference for endpoint comparison
python -c "
from wandb.experiments.compare_endpoints import compare_best_vs_final
import asyncio
asyncio.run(compare_best_vs_final(
    entity='your-entity',
    project='serverless-ab',
    model_name='exp-5-A',
    best_step=100,
    final_step=500,
    prompt='What is the capital of France?'
))
"
```

## Execution Strategy

1. **Serverless** (already wired): Launch #1 + #3 in parallel, then #2, #4, #5, #6 in batch
2. **Colab**: Run #2 and #4 (lighter SFT/distillation) on T4 credits
3. **OVHai**: Run #1, #3, #5, #6 (heavier SFT→RL and RL) on A100
4. **Ollama**: Use for endpoint comparison and inference evaluation post-training

## Data Preparation

All experiments expect JSONL training data at the paths specified in configs:

| Experiment | data_path                  | Format                          |
|-----------|---------------------------|---------------------------------|
| #1        | `data/train.jsonl`         | SFT + RL trajectories           |
| #2        | `data/distill.jsonl`        | Teacher outputs + student inputs|
| #3        | `data/train.jsonl`         | RL trajectories (2048 context)  |
| #4        | `data/cookbook_train.jsonl`| Mixed format/tool-call datasets |
| #5        | `data/train.jsonl`         | SFT data for endpoint eval      |
| #6        | `data/train.jsonl`         | RL trajectories (inverted reward)|

Each JSONL line:
```json
{"messages_and_choices": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}], "reward": 0.0, "metrics": {}}
```

## Verification Checklist

- [ ] Colab notebook can import all config files
- [ ] W&B run names match A/B convention (`exp-N-A`, `exp-N-B`)
- [ ] Tags include `A`/`B` and `group:N` on every run
- [ ] OVHai instance persists data between restarts
- [ ] Ollama endpoint comparison returns meaningful results
- [ ] All 12 runs complete and log metrics to W&B project `serverless-ab`
- [ ] Experiment #5 endpoint comparison identifies best-eval vs final-step winner
