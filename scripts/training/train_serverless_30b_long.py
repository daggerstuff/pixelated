"""
W&B Serverless RL Training for Qwen3-30B — LONG RUN
SFT warmup + 5000 RL steps with auto-resume supervisor.
"""

import asyncio
import datetime
import json
import logging
import math
import os
import random
import signal

import art
import weave
from art.serverless.backend import ServerlessBackend
from art.utils.sft import train_sft_from_file
from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(message)s")


# Suppress harmless W&B artifact-pruning warnings from serverless backend
class _PruneWarningFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "Could not prune old train-state artifacts" not in msg and "404 Client Error" not in msg


# Apply to root logger and all existing loggers
for logger_name in [*logging.root.manager.loggerDict.keys(), ""]:
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
    f"qwen3-30b-serverless-rl-long-{datetime.datetime.now(tz=datetime.timezone.utc).strftime('%Y%m%d-%H%M')}",
)
BASE_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 8
LEARNING_RATE = 1e-5
MAX_RL_STEPS = 5000
SFT_WARMUP_STEPS = 50

CHECKPOINT_PATH = f"/tmp/serverless_checkpoint_{MODEL_NAME}.json"
SUPERVISE = os.environ.get("SUPERVISE", "1") == "1"
SHUTDOWN = asyncio.Event()


def _handle_signal(signum, frame):
    logging.info(f"Received signal {signum}, shutting down gracefully...")
    SHUTDOWN.set()


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)


def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH) as f:
                return json.load(f)
        except Exception:
            logging.warning("Failed to load checkpoint, starting fresh.")
    return {}


def save_checkpoint(step: int):
    data = {
        "model_name": MODEL_NAME,
        "last_completed_step": step,
        "timestamp": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
    }
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(data, f, indent=2)
    logging.info(f"Checkpoint saved: step {step}")


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
async def rollout(_model: art.Model, messages: list, _step: int = 0) -> art.Trajectory:
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


def load_dataset(path: str) -> list:
    """Load, filter, and deduplicate training dataset."""
    seen: set[str] = set()
    examples = []
    with open(path) as f:
        for line in f:
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                # Fingerprint on first user + first assistant content to dedupe
                user_content = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")[:120]
                assistant_content = next((m.get("content", "") for m in messages if m.get("role") == "assistant"), "")[
                    :120
                ]
                fingerprint = f"{user_content}||{assistant_content}"
                if fingerprint not in seen:
                    seen.add(fingerprint)
                    examples.append(messages)
    return examples


def compute_step_metrics(
    train_groups: list,
) -> tuple[float, dict[str, float]]:
    """Compute average reward and metrics dict from train groups."""
    all_rewards = [t.reward for g in train_groups for t in g.trajectories]
    avg_reward = sum(all_rewards) / len(all_rewards) if all_rewards else 0.0

    all_response_lens = [t.metrics.get("response_len", 0) for g in train_groups for t in g.trajectories]
    all_expected_lens = [t.metrics.get("expected_len", 0) for g in train_groups for t in g.trajectories]
    all_length_ratios = [t.metrics.get("length_ratio", 0) for g in train_groups for t in g.trajectories]
    all_overlaps = [t.metrics.get("overlap", 0) for g in train_groups for t in g.trajectories]

    metrics = {
        "response_len": sum(all_response_lens) / len(all_response_lens) if all_response_lens else 0.0,
        "expected_len": sum(all_expected_lens) / len(all_expected_lens) if all_expected_lens else 0.0,
        "length_ratio": sum(all_length_ratios) / len(all_length_ratios) if all_length_ratios else 0.0,
        "overlap": sum(all_overlaps) / len(all_overlaps) if all_overlaps else 0.0,
    }
    return avg_reward, metrics


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


async def _train_once(examples: list):
    """Single training attempt. Raises on unrecoverable failure."""
    weave.init(PROJECT)
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

    wandb_step = await model.get_step()
    checkpoint = load_checkpoint()
    saved_step = checkpoint.get("last_completed_step", 0)
    resume_step = max(wandb_step, saved_step)
    logging.info(f"W&B step: {wandb_step}, checkpoint: {saved_step}, resuming from: {resume_step}")

    if resume_step < SFT_WARMUP_STEPS:
        logging.info(f"Starting SFT Warmup ({SFT_WARMUP_STEPS} steps)...")
        await train_sft_from_file(
            model=model,
            file_path=DATASET_PATH,
            epochs=1,
            initial_step=resume_step,
            final_step=SFT_WARMUP_STEPS,
            verbose=True,
        )
        logging.info("SFT warmup complete.")
        resume_step = await model.get_step()
    else:
        logging.info(f"SFT warmup already complete ({resume_step} >= {SFT_WARMUP_STEPS}), skipping.")

    logging.info(f"Starting RL from step {resume_step}")

    # Publish dataset to Weave
    logging.info("Publishing dataset to Weave...")
    weave_dataset = weave.Dataset(
        name=f"{MODEL_NAME}-dataset",
        rows=[{"messages": msgs} for msgs in examples],
    )
    weave.publish(weave_dataset)

    # Epoch-based iterator: skip examples already consumed in prior runs
    rl_steps_already_done = max(0, resume_step - SFT_WARMUP_STEPS)
    examples_to_skip = rl_steps_already_done * GROUPS_PER_STEP
    iterator = ShuffledEpochIterator(examples, GROUPS_PER_STEP)
    iterator.skip(examples_to_skip)
    logging.info(
        f"Dataset iterator: skipping {examples_to_skip} examples (epoch {iterator.epoch}, index {iterator.index})"
    )

    max_retries = 5
    for step in range(MAX_RL_STEPS):
        if SHUTDOWN.is_set():
            logging.info("Shutdown requested, exiting loop.")
            break

        actual_step = step + resume_step
        batch = iterator.next_batch()

        with weave.attributes({"rl_step": actual_step, "model": MODEL_NAME}):
            train_groups = await art.gather_trajectory_groups(
                (
                    art.TrajectoryGroup(rollout(model, messages, _step=actual_step) for _ in range(ROLLOUTS_PER_GROUP))
                    for messages in batch
                ),
                pbar_desc=f"RL step {actual_step}",
            )

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

        log_rl_step(
            step=result.step,
            avg_reward=avg_reward,
            metrics=metrics,
        )
        logging.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")
        save_checkpoint(result.step)

    logging.info("RL training complete!")


async def main():
    logging.info("Loading dataset...")
    examples = load_dataset(DATASET_PATH)
    logging.info(f"Loaded {len(examples)} total examples.")

    if not SUPERVISE:
        await _train_once(examples)
        return

    attempt = 0
    while not SHUTDOWN.is_set():
        attempt += 1
        logging.info(f"=== Training attempt #{attempt} ===")
        try:
            await _train_once(examples)
            logging.info("Training finished successfully.")
            break
        except Exception as e:
            logging.exception(f"Training crashed on attempt #{attempt}: {e}")
            if SHUTDOWN.is_set():
                logging.info("Shutdown requested, not restarting.")
                break
            wait = min(300, 60 * (2 ** min(attempt - 1, 4)))
            logging.info(f"Auto-restarting in {wait}s...")
            try:
                await asyncio.wait_for(SHUTDOWN.wait(), timeout=wait)
                logging.info("Shutdown signal received during wait, exiting.")
                break
            except TimeoutError:
                continue

    logging.info("Supervisor exiting.")


if __name__ == "__main__":
    asyncio.run(main())
