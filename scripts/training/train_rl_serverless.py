"""
W&B Serverless RL Training for Qwen3-14B (after SFT warmup)
Uses OpenPipe ART framework with ServerlessBackend + GRPO.
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

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")

# Required environment variable
WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required for serverless training.")

# Configuration
PROJECT = "wayfarer-ab-test"  # Keeping project name as is, unless you want this changed too!
MODEL_NAME = "qwen3-14b-serverless-rl"
BASE_MODEL = "OpenPipe/Qwen3-14B-Instruct"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

# RL Hyperparameters
GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 8
LEARNING_RATE = 1e-5
MAX_RL_STEPS = 100

# Use local Ollama for rollouts to avoid W&B inference quota costs.
# W&B serverless training remains free for us; inference is not.
OLLAMA_CLIENT = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
OLLAMA_MODEL = "hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_S"


def compute_ngram_overlap(response: str, expected: str, n: int = 2) -> float:
    """Compute n-gram Jaccard similarity for better semantic overlap estimation."""
    res_words = response.lower().split()
    exp_words = expected.lower().split()

    if len(res_words) < n or len(exp_words) < n:
        # Fallback to unigram overlap if very short
        res_set = set(res_words)
        exp_set = set(exp_words)
        return len(res_set & exp_set) / len(exp_set) if exp_set else 0.0

    res_ngrams = {tuple(res_words[i : i + n]) for i in range(len(res_words) - n + 1)}
    exp_ngrams = {tuple(exp_words[i : i + n]) for i in range(len(exp_words) - n + 1)}

    intersection = len(res_ngrams & exp_ngrams)
    union = len(res_ngrams | exp_ngrams)
    return intersection / union if union > 0 else 0.0


async def rollout(model: art.Model, messages: list) -> art.Trajectory:
    """Generate a response and compute reward."""
    # Build trajectory from messages (all but last = context, last = expected assistant)
    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )

    # Ensure trajectory ends with user message for generation
    trajectory.messages_and_choices = list(context)

    # Generate completion via local Ollama (free) instead of W&B inference (paid)
    completion = await OLLAMA_CLIENT.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=trajectory.messages(),
        max_tokens=1024,
        temperature=0.8,
        logprobs=True,
    )
    choice = completion.choices[0]

    trajectory.messages_and_choices.append(choice)
    response = choice.message.content or ""

    # Compute reward
    response_len = len(response.split())
    expected_len = len(expected.split())

    # Smooth Length reward (Gaussian penalty centered around target length)
    target_len = max(expected_len, 100)  # Aim for expected length or at least 100 words
    sigma = 150.0  # Tolerance for length variance
    length_reward = math.exp(-((response_len - target_len) ** 2) / (2 * sigma**2))

    # Advanced Similarity reward (N-gram overlap)
    overlap = compute_ngram_overlap(response, expected, n=2)

    # Combine rewards (weighting semantic overlap slightly higher)
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

    logging.info(f"Loaded {len(examples)} total examples. Will random sample during RL.")

    # Create/load model (starts from SFT checkpoint as BASE_MODEL)
    logging.info("Loading model...")
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        entity="wutang",
        base_model=BASE_MODEL,
    )

    backend = ServerlessBackend(api_key=WANDB_API_KEY)

    logging.info("Forking from SFT checkpoint...")
    await backend._experimental_fork_checkpoint(
        model,
        from_model="wayfarer-2-12b-serverless-sft",
        verbose=True,
    )

    await model.register(backend)

    start_step = await model.get_step()
    logging.info(f"Starting RL from step {start_step}")

    # RL training loop
    for step in range(MAX_RL_STEPS):
        # Sample batch randomly from the entire dataset pool
        batch = random.sample(examples, min(GROUPS_PER_STEP, len(examples)))

        # Generate rollouts
        train_groups = await art.gather_trajectory_groups(
            (art.TrajectoryGroup(rollout(model, messages) for _ in range(ROLLOUTS_PER_GROUP)) for messages in batch),
            pbar_desc=f"RL step {step + start_step}",
        )

        # Train
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
