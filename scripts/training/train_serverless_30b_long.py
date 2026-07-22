"""
W&B Serverless RL Training for Qwen3-30B — LONG RUN
SFT warmup + 500 RL steps.
"""

import asyncio
import datetime
import json
import logging
import math
import os
import random

import art
import weave
from art.serverless.backend import ServerlessBackend
from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(message)s")


# Suppress harmless W&B artifact-pruning warnings from serverless backend
class _PruneWarningFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "Could not prune old train-state artifacts" not in msg and "404 Client Error" not in msg


# Apply to root logger and all existing loggers
for logger_name in list(logging.root.manager.loggerDict.keys()) + [""]:
    logging.getLogger(logger_name).addFilter(_PruneWarningFilter())

AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
if not AZURE_API_KEY:
    raise ValueError("AZURE_OPENAI_API_KEY is required for Azure rollouts.")

AZURE_CLIENT = AsyncOpenAI(
    api_key=AZURE_API_KEY,
    base_url=os.environ.get("AZURE_OPENAI_ENDPOINT", "https://slutrock-resource.services.ai.azure.com/openai/v1"),
)
AZURE_MODEL = os.environ.get("AZURE_OPENAI_MODEL_NAME", "masked-qwen")

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required for serverless training.")

PROJECT = "wayfarer-ab-test"
MODEL_NAME = os.environ.get(
    "MODEL_NAME",
    f"qwen3-30b-serverless-rl-long-{datetime.datetime.now().strftime('%Y%m%d-%H%M')}",
)
BASE_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 8
LEARNING_RATE = 1e-5
MAX_RL_STEPS = 5000
SFT_WARMUP_STEPS = 50


@weave.op()
def compute_ngram_overlap(response: str, expected: str, n: int = 2) -> float:
    res_words = response.lower().split()
    exp_words = expected.lower().split()
    if len(res_words) < n or len(exp_words) < n:
        res_set = set(res_words)
        exp_set = set(exp_words)
        return len(res_set & exp_set) / len(exp_set) if exp_set else 0.0
    res_ngrams = {tuple(res_words[i : i + n]) for i in range(len(res_words) - n + 1)}
    exp_ngrams = {tuple(exp_words[i : i + n]) for i in range(len(exp_words) - n + 1)}
    intersection = len(res_ngrams & exp_ngrams)
    union = len(res_ngrams | exp_ngrams)
    return intersection / union if union > 0 else 0.0


@weave.op()
async def rollout(model: art.Model, messages: list, step: int = 0) -> art.Trajectory:
    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )
    trajectory.messages_and_choices = list(context)

    completion = await AZURE_CLIENT.chat.completions.create(
        model=AZURE_MODEL,
        messages=trajectory.messages(),
        max_tokens=1024,
        temperature=0.8,
    )
    choice = completion.choices[0]
    trajectory.messages_and_choices.append(choice)
    response = choice.message.content or ""

    response_len = len(response.split())
    expected_len = len(expected.split())
    target_len = max(expected_len, 100)
    sigma = 150.0
    length_reward = math.exp(-((response_len - target_len) ** 2) / (2 * sigma**2))
    overlap = compute_ngram_overlap(response, expected, n=2)

    trajectory.reward = length_reward * 0.4 + overlap * 0.6
    trajectory.metrics["response_len"] = response_len
    trajectory.metrics["expected_len"] = expected_len
    trajectory.metrics["length_ratio"] = response_len / max(expected_len, 1)
    trajectory.metrics["overlap"] = overlap

    return trajectory


@weave.op()
def log_rl_step(
    step: int,
    avg_reward: float,
    response_len: float,
    expected_len: float,
    length_ratio: float,
    overlap: float,
) -> dict:
    """Log per-step RL metrics to Weave."""
    return {
        "step": step,
        "avg_reward": avg_reward,
        "avg_response_len": response_len,
        "avg_expected_len": expected_len,
        "avg_length_ratio": length_ratio,
        "avg_overlap": overlap,
    }


async def main():
    weave.init(PROJECT)
    logging.info("Loading dataset...")
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                examples.append(messages)
    logging.info(f"Loaded {len(examples)} total examples.")

    logging.info("Loading model...")
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        entity="wutang",
        base_model=BASE_MODEL,
        inference_api_key=AZURE_API_KEY,
        inference_base_url=os.environ.get(
            "AZURE_OPENAI_ENDPOINT", "https://slutrock-resource.services.ai.azure.com/openai/v1"
        ),
        inference_model_name=AZURE_MODEL,
    )
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    from art.utils.sft import train_sft_from_file

    start_step = await model.get_step()
    logging.info(f"Model current step: {start_step}")

    if start_step < SFT_WARMUP_STEPS:
        logging.info(f"Starting SFT Warmup ({SFT_WARMUP_STEPS} steps)...")
        await train_sft_from_file(
            model=model,
            file_path=DATASET_PATH,
            epochs=1,
            initial_step=start_step,
            final_step=SFT_WARMUP_STEPS,
            verbose=True,
        )
        logging.info("SFT warmup complete.")
        start_step = await model.get_step()
    else:
        logging.info(f"SFT warmup already complete ({start_step} >= {SFT_WARMUP_STEPS}), skipping.")

    logging.info(f"Starting RL from step {start_step}")

    # Publish dataset to Weave
    logging.info("Publishing dataset to Weave...")
    weave_dataset = weave.Dataset(
        name=f"{MODEL_NAME}-dataset",
        rows=[{"messages": msgs} for msgs in examples],
    )
    weave.publish(weave_dataset)

    MAX_RETRIES = 3
    for step in range(MAX_RL_STEPS):
        batch = random.sample(examples, min(GROUPS_PER_STEP, len(examples)))

        with weave.attributes({"rl_step": step + start_step, "model": MODEL_NAME}):
            train_groups = await art.gather_trajectory_groups(
                (
                    art.TrajectoryGroup(
                        rollout(model, messages, step=step + start_step) for _ in range(ROLLOUTS_PER_GROUP)
                    )
                    for messages in batch
                ),
                pbar_desc=f"RL step {step + start_step}",
            )

        result = None
        for attempt in range(MAX_RETRIES):
            try:
                result = await backend.train(model, train_groups, learning_rate=LEARNING_RATE)
                break
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    wait = 30 * (attempt + 1)
                    logging.warning(f"backend.train() failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
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
        all_rewards = [t.reward for g in train_groups for t in g.trajectories]
        avg_reward = sum(all_rewards) / len(all_rewards) if all_rewards else 0.0

        all_response_lens = [t.metrics.get("response_len", 0) for g in train_groups for t in g.trajectories]
        all_expected_lens = [t.metrics.get("expected_len", 0) for g in train_groups for t in g.trajectories]
        all_length_ratios = [t.metrics.get("length_ratio", 0) for g in train_groups for t in g.trajectories]
        all_overlaps = [t.metrics.get("overlap", 0) for g in train_groups for t in g.trajectories]

        log_rl_step(
            step=result.step,
            avg_reward=avg_reward,
            response_len=sum(all_response_lens) / len(all_response_lens) if all_response_lens else 0.0,
            expected_len=sum(all_expected_lens) / len(all_expected_lens) if all_expected_lens else 0.0,
            length_ratio=sum(all_length_ratios) / len(all_length_ratios) if all_length_ratios else 0.0,
            overlap=sum(all_overlaps) / len(all_overlaps) if all_overlaps else 0.0,
        )
        logging.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")

    logging.info("RL training complete!")


if __name__ == "__main__":
    asyncio.run(main())
