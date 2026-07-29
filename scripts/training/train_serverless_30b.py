"""
W&B Serverless RL Training for Qwen3-14B (after SFT warmup)
Uses OpenPipe ART framework with ServerlessBackend + GRPO.
"""

import asyncio
import json
import logging
import os
import tempfile

import art
import weave
from art.serverless.backend import ServerlessBackend
from art.utils.sft import train_sft_from_file
from serverless_utils import (
    ShuffledEpochIterator,
    apply_prune_filter,
    compute_step_metrics,
    load_dataset,
    log_rl_step,
    rollout,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
apply_prune_filter()

# Required environment variable
WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required for serverless training.")

# Configuration
PROJECT = "wayfarer-ab-test"
MODEL_NAME = "qwen3-30b-serverless-rl-v2"
BASE_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

# RL Hyperparameters
GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 8
LEARNING_RATE = 1e-5
MAX_RL_STEPS = 100
SFT_WARMUP_STEPS = 50  # Number of SFT steps to run before RL


# NOTE: ``rollout`` and ``compute_ngram_overlap`` are imported from
# ``serverless_utils`` (see import block above).  The imported ``rollout``
# signature is ``rollout(_model, messages, _step=0)``; it generates completions
# through the model's own serverless inference endpoint and injects the
# token IDs that the W&B serverless backend requires, so we reuse it
# instead of redefining a local copy here.


async def main():
    weave.init(PROJECT)
    logging.info("Loading dataset...")
    examples = load_dataset(DATASET_PATH)
    logging.info(f"Loaded {len(examples)} deduplicated examples. Will iterate epoch-wise during RL.")

    # Write deduped dataset to temp file so SFT warmup uses the same data as RL
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as tmp:
        for msgs in examples:
            tmp.write(json.dumps({"messages": msgs}) + "\n")
        deduped_dataset_path = tmp.name
    logging.info(f"Deduped dataset written to {deduped_dataset_path}")

    # Create/load model (starts from SFT checkpoint as BASE_MODEL)
    logging.info("Loading model...")
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        entity="wutang",
        base_model=BASE_MODEL,
    )

    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    logging.info(f"Starting SFT Warmup (limited to {SFT_WARMUP_STEPS} steps)...")
    await train_sft_from_file(
        model=model,
        file_path=deduped_dataset_path,
        epochs=1,
        final_step=SFT_WARMUP_STEPS,
    )

    start_step = await model.get_step()
    logging.info(f"Starting RL from step {start_step}")

    # Publish dataset to Weave
    logging.info("Publishing dataset to Weave...")
    weave_dataset = weave.Dataset(
        name=f"{MODEL_NAME}-dataset",
        rows=[{"messages": msgs} for msgs in examples],
    )
    weave.publish(weave_dataset)

    # Epoch-based iterator
    rl_steps_already_done = max(0, start_step - SFT_WARMUP_STEPS)
    examples_to_skip = rl_steps_already_done * GROUPS_PER_STEP
    iterator = ShuffledEpochIterator(examples, GROUPS_PER_STEP)
    iterator.skip(examples_to_skip)
    logging.info(
        f"Dataset iterator: skipping {examples_to_skip} examples (epoch {iterator.epoch}, index {iterator.index})"
    )

    # RL training loop
    for step in range(MAX_RL_STEPS):
        batch = iterator.next_batch()

        # Generate rollouts with Weave step attribution
        with weave.attributes({"rl_step": step + start_step, "model": MODEL_NAME}):
            train_groups = await art.gather_trajectory_groups(
                (
                    art.TrajectoryGroup(
                        rollout(model, messages, _step=step + start_step) for _ in range(ROLLOUTS_PER_GROUP)
                    )
                    for messages in batch
                ),
                pbar_desc=f"RL step {step + start_step}",
            )

        # Train with retry
        max_retries = 5
        result = None
        for attempt in range(max_retries):
            try:
                result = await backend.train(model, train_groups, learning_rate=LEARNING_RATE)
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    wait = 60 * (2**attempt)
                    logging.warning(f"backend.train() failed (attempt {attempt + 1}/{max_retries}): {e}")
                    logging.warning(f"Retrying in {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    raise
        assert result is not None
        await model.log(
            train_groups,
            metrics=result.metrics,
            step=result.step,
            split="train",
        )

        avg_reward, metrics = compute_step_metrics(train_groups)
        log_rl_step(step=result.step, avg_reward=avg_reward, metrics=metrics)
        logging.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")

    logging.info("RL training complete!")


if __name__ == "__main__":
    asyncio.run(main())
