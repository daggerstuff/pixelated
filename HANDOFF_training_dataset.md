# Handoff: Anti-Sycophancy Training Dataset, Dual-Judge Calibration & Serverless Training

## Current State
- **Repo**: `pixelated / ai / docs`
- **Focus**: Multi-turn therapeutic evaluation, anti-sycophancy rewards, dual-judge calibration, W&B serverless training
- **Recent Work**: 
  1. Golden judge multi-turn calibration benchmark completed on Cloudflare Workers AI across 90 VERA-MH clinician-scored sessions.
  2. Evaluated and compared 2026 flagship non-Llama judges (`@cf/deepseek-ai/deepseek-v4-pro-0813` vs `@cf/zai-org/glm-5.3`).
  3. Excised Qwen 3.8 from the evaluation pipeline per directive.
  4. Dual-judge infrastructure hardened with deep reasoning trace parsing, 4096 token headroom, and endpoint concurrency throttling.

## Files Relevant
- `ai/training/data/golden_vera_mh_v1.jsonl` – 90 multi-turn therapy session trajectories (avg 20 turns) paired with licensed clinical expert ratings across 5 dimensions (relevance, accuracy, helpfulness, style, safety). Sourced from published VERA-MH human validation study.
- `ai/training/data/golden_judge_calib_v2.jsonl` – 200 real human clinical single-turn calibration records (100 AnnoMI expert-coded MI transcripts + 100 ESConv counseling transcripts with client distress shift ratings). True human score range [0.6240, 0.9700], mean 0.8301.
- `ai/training/build_vera_mh_golden.py` – Deterministic builder extracting multi-turn session transcripts and aggregating multi-clinician ratings from VERA-MH S3 archive.
- `ai/training/build_real_golden_calibration.py` – Deterministic builder for single-turn AnnoMI / ESConv clinical calibration set.
- `ai/training/dual_judge.py` – Dual-model LLM-as-judge with multi-turn trajectory evaluation, deterministic anti-sycophancy gating, and deep reasoning trace extraction (`reasoning_content` + `content` fallbacks).
- `ai/training/orpo_trainer.py` – Production ORPO (Odds Ratio Preference Optimization) trainer combining SFT and anti-sycophancy preference alignment in a single pass with ZeRO-3, WandB tracking, and `zai-org/glm-5.3-flash` base model.
- `ai/training/mental_ift_trainer.py` – Mental Health Instruction Fine-Tuning (IFT) curriculum trainer (classification -> estimation -> generation) with QLoRA and per-task evaluation.
- `ai/training/grpo_trainer.py` – Group Relative Policy Optimization (GRPO) reinforcement learning trainer with anti-sycophancy and clinical empathy reward functions.
- `ai/configs/models/training_config.json` – Pinned 2026 non-Llama base model (`zai-org/glm-5.3-flash`, bf16).
- `ai/configs/models/training_config_v2_antirepetition.json` – Antirepetition LoRA configuration.

## Multi-Turn Calibration Benchmark (VERA-MH Ground Truth)

| Metric | DeepSeek V4 Pro (`@cf/deepseek-ai/deepseek-v4-pro-0813`) | GLM 5.3 Flash (`@cf/zai-org/glm-5.3`) | Delta (DeepSeek Advantage) |
| :--- | :---: | :---: | :---: |
| **Golden Score Mean** | `0.6552` | `0.6552` | Ground Truth |
| **Judge Score Mean** | `0.4939` | `0.4457` | +0.0482 (Closer to Human) |
| **Pearson Correlation ($r$)** | **`0.2518`** | `0.1991` | **+26.5% Correlation** |
| **Mean Absolute Error (MAE)** | **`0.2523`** | `0.2640` | **-4.4% Error** |
| **Root Mean Squared Error (RMSE)** | **`0.3218`** | `0.3421` | **-5.9% Error** |
| **Cohen's Kappa ($\kappa$)** | **`0.1986`** | `0.1567` | **+26.7% Agreement** |

## Resolved Issues & Engineering Hardening
1. **Multi-Turn Trajectory Evaluation**: Extended `dual_judge.py` to evaluate multi-turn therapeutic dialogues rather than isolated single turns, incorporating full dialogue history (up to 8 turns x 300 chars) while avoiding prompt overflow.
2. **Real Clinician Ground Truth**: Anchored calibration against real licensed clinician ratings from VERA-MH across 5 standardized dimensions (Best Practice / Suboptimal / Potential Harm).
3. **Deep Reasoning Extraction & Token Budget**: Resolved empty-output dropouts by increasing generation budget to `max_tokens=4096`, extending timeouts to `180s`, and supporting dual extraction where reasoning traces reside in `reasoning_content` and final scores in `content`.
4. **Cloudflare Endpoint Safety**: Configured `DUAL_JUDGE_CONCURRENCY=2` with exponential retry backoff to prevent queue congestion and timeout failures on Cloudflare Workers AI.
5. **Strict 2026 Non-Llama Model Stack**:
   - Primary Judge: `@cf/deepseek-ai/deepseek-v4-pro-0813`
   - Secondary Judge: `@cf/mistralai/mistral-small-3.1-24b-instruct`
   - Base Training Models: `zai-org/glm-5.3-flash` (bf16)
   - Qwen 3.8 completely removed.

## Execution Commands
```bash
# 1. Run ORPO single-pass SFT + Anti-Sycophancy alignment
uv run python -m ai.training.orpo_trainer \
    --data_path ai/data/curated/sft_chatml/train.jsonl \
    --base_model_checkpoint zai-org/glm-5.3-flash \
    --output_dir ai/models/orpo_glm53 \
    --beta 0.1 \
    --wandb_project pixelated-empathy-orpo

# 2. Run Mental Health Instruction Fine-Tuning (IFT)
uv run python -m ai.training.mental_ift_trainer \
    --base_model zai-org/glm-5.3-flash \
    --output_dir ai/models/mental_ift_glm53

# 3. Verify dual-judge evaluation and calibration suite
uv run pytest ai/training/tests/test_dual_judge.py -v
```
