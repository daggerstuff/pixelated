# Handoff: Anti-sycophancy training dataset + wandb serverless

## Current state
- Repo: pixelated / ai / docs
- Last focus: anti-sycophancy training, wandb serverless training, dataset creation
- Recent work: Golden judge calibration set generation

## Files relevant
- `ai/training/data/golden_judge_calib_v2.jsonl` – current calibration set (200 samples target, 25 real + 175 synthetic)
- `ai/training/generate_golden_calib_serverless.py` – generator using Cloudflare Workers AI
- `ai/training/train_rl_serverless_fixed.py` – W&B serverless RL training script (Azure-coupled, dated 2026-08-24)
- `docs/training-pipeline-blueprint-2026-08-10.md`
- `docs/training-pipeline-audit-2026-08-24.md`
- `docs/superpowers/plans/2026-08-09-serverless-a-b-plan.md`
- `docs/superpowers/specs/2026-08-09-serverless-a-b-spec.md`
- `configs/models/training_config.json`
- `configs/models/training_config_v2_antirepetition.json`

## Recent changes
- Model age rule enforced: never use models <2026, no Llama
- Switched to Cloudflare Workers AI model `@cf/deepseek-ai/deepseek-v4-pro-0813`
- Generator rewritten to batch 3 samples at a time with 35s sleep to avoid rate limit
- First batch of 3 generated, but assistant responses are empty (see file)

## Open issues
1. Empty assistant responses from DeepSeek V4 Pro via Cloudflare Workers AI
   - Need to verify model exists and message format is correct
   - Check API response schema: may need `role: system` or different endpoint
   - Verify `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` are correct for inference
2. 175 synthetic samples still needed for golden judge calibration
3. WandB serverless training pipeline is Azure-coupled and old; user wants clean, non-Azure, non-fixed suffix scripts
4. Anti-sycophancy dataset creation pipeline incomplete

## Next steps
- Debug Cloudflare Workers AI call: log raw response, test single call with wrangler
- If DeepSeek model not working, pick alternative 2026+ non-Llama model from `wrangler ai models list`
- Generate remaining 172 synthetic samples in 3-sample batches
- Verify calibration with `python -m training.dual_judge --calibrate --golden ai/training/data/golden_judge_calib_v2.jsonl`
- Resume wandb serverless RL training for anti-sycophancy hardening

## Constraints
- No Llama models ever
- Never use models older than 2026
- No `*_fixed`, `*_cleaned`, `*_final` suffixes
- Use Cloudflare Workers AI, not Azure for calibration generation
- Preserve HIPAA boundaries

## Foresight memory
- Model age rule stored
- Pending items: training pipeline pending, train/val/test split pending
