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
import weave
from art.serverless.backend import ServerlessBackend
from art.utils.sft import train_sft_from_file
from openai import AsyncOpenAI

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")


# Suppress harmless W&B artifact-pruning warnings from serverless backend
class _PruneWarningFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "Could not prune old train-state artifacts" not in msg and "404 Client Error" not in msg


for logger_name in [*logging.root.manager.loggerDict.keys(), ""]:
    logging.getLogger(logger_name).addFilter(_PruneWarningFilter())

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
SFT_WARMUP_STEPS = 50

AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
if not AZURE_API_KEY:
    raise ValueError("AZURE_OPENAI_API_KEY is required for Azure rollouts.")

AZURE_CLIENT = AsyncOpenAI(
    api_key=AZURE_API_KEY,
    base_url=os.environ.get("AZURE_OPENAI_ENDPOINT", "https://slutrock-resource.services.ai.azure.com/openai/v1"),
)
AZURE_MODEL = os.environ.get("AZURE_OPENAI_MODEL_NAME", "masked-qwen")


@weave.op()
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


@weave.op()
async def rollout(_model: art.Model, messages: list, _step: int = 0) -> art.Trajectory:
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

    # Generate completion via Azure OpenAI-compatible endpoint
    completion = await AZURE_CLIENT.chat.completions.create(
        model=AZURE_MODEL,
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


@weave.op()
def log_rl_step(
    step: int,
    avg_reward: float,
    metrics: dict[str, float],
) -> dict:
    """Log per-step RL metrics to Weave."""
    return {
        "step": step,
        "avg_reward": avg_reward,
        "avg_response_len": metrics["response_len"],
        "avg_expected_len": metrics["expected_len"],
        "avg_length_ratio": metrics["length_ratio"],
        "avg_overlap": metrics["overlap"],
    }


class ShuffledEpochIterator:
    """Yield batches from a shuffled dataset, reshuffling at epoch boundaries."""

    def __init__(self, examples: list, batch_size: int, seed: int = 42):
        self.examples = examples
        self.batch_size = batch_size
        self.seed = seed
        self.epoch = 0
        self.index = 0
        self._indices: list[int] = []
        self._shuffle()

    def _shuffle(self) -> None:
        rng = random.Random(self.seed + self.epoch)
        self._indices = list(range(len(self.examples)))
        rng.shuffle(self._indices)
        self.index = 0

    def skip(self, n: int) -> None:
        """Skip n examples (used for resume)."""
        while n > 0:
            remaining = len(self._indices) - self.index
            if n >= remaining:
                n -= remaining
                self.epoch += 1
                self._shuffle()
            else:
                self.index += n
                n = 0

    def next_batch(self) -> list:
        """Return the next batch of examples."""
        if self.index + self.batch_size > len(self._indices):
            self.epoch += 1
            self._shuffle()
        batch_indices = self._indices[self.index : self.index + self.batch_size]
        self.index += self.batch_size
        return [self.examples[i] for i in batch_indices]


async def main():
    weave.init(PROJECT)
    logging.info("Loading dataset...")
    seen: set[str] = set()
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                user_content = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")[:120]
                assistant_content = next((m.get("content", "") for m in messages if m.get("role") == "assistant"), "")[
                    :120
                ]
                fingerprint = f"{user_content}||{assistant_content}"
                if fingerprint not in seen:
                    seen.add(fingerprint)
                    examples.append(messages)

    logging.info(f"Loaded {len(examples)} deduplicated examples. Will iterate epoch-wise during RL.")

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
        file_path=DATASET_PATH,
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
        logging.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")

    logging.info("RL training complete!")


if __name__ == "__main__":
    asyncio.run(main())
