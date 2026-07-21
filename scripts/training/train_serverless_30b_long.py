"""
W&B Serverless RL Training for Qwen3-30B — LONG RUN
SFT warmup + 500 RL steps.
"""

import asyncio
import json
import logging
import math
import os
import random

import art
from art.serverless.backend import ServerlessBackend
from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(message)s")

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required for serverless training.")

PROJECT = "wayfarer-ab-test"
MODEL_NAME = "qwen3-30b-serverless-rl-long"
BASE_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 8
LEARNING_RATE = 1e-5
MAX_RL_STEPS = 5000
SFT_WARMUP_STEPS = 500

# Alibaba Cloud
ALIBABA_CLIENT = AsyncOpenAI(
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    api_key=os.environ.get("ALIBABA_CLOUD_API_KEY", ""),
)
ALIBABA_MODEL = "qwen-max"


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


async def rollout(model: art.Model, messages: list) -> art.Trajectory:
    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )
    trajectory.messages_and_choices = list(context)

    completion = await ALIBABA_CLIENT.chat.completions.create(
        model=ALIBABA_MODEL,
        messages=trajectory.messages(),
        max_tokens=1024,
        temperature=0.8,
        logprobs=True,
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


async def main():
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
    )
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    from art.utils.sft import train_sft_from_file

    logging.info(f"Starting SFT Warmup ({SFT_WARMUP_STEPS} steps)...")
    await train_sft_from_file(
        model=model,
        file_path=DATASET_PATH,
        epochs=1,
        final_step=SFT_WARMUP_STEPS,
    )

    start_step = await model.get_step()
    logging.info(f"Starting RL from step {start_step}")

    for step in range(MAX_RL_STEPS):
        batch = random.sample(examples, min(GROUPS_PER_STEP, len(examples)))
        train_groups = await art.gather_trajectory_groups(
            (art.TrajectoryGroup(rollout(model, messages) for _ in range(ROLLOUTS_PER_GROUP)) for messages in batch),
            pbar_desc=f"RL step {step + start_step}",
        )
        result = await backend.train(model, train_groups, learning_rate=LEARNING_RATE)
        await model.log(
            train_groups,
            metrics=result.metrics,
            step=result.step,
            split="train",
        )
        all_rewards = [t.reward for g in train_groups for t in g.trajectories]
        avg_reward = sum(all_rewards) / len(all_rewards) if all_rewards else 0.0
        logging.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")

    logging.info("RL training complete!")


if __name__ == "__main__":
    asyncio.run(main())
