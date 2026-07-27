"""
W&B Serverless RL Training for Qwen3-30B — LONG RUN
SFT warmup + 5000 RL steps with auto-resume supervisor.
"""

import asyncio
import datetime
import json
import logging
import os
import signal
import tempfile

import art
import httpx
import weave
from art.serverless.backend import ServerlessBackend
from art.utils.sft import train_sft_from_file
from openai import AsyncOpenAI
from serverless_utils import (
    ShuffledEpochIterator,
    apply_prune_filter,
    compute_step_metrics,
    load_dataset,
    log_rl_step,
    rollout,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
apply_prune_filter()

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


def _handle_signal(signum, _frame):
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


async def _train_once(examples: list, dataset_path: str):
    """Single training attempt. Raises on unrecoverable failure."""
    weave.init(PROJECT)
    logging.info("Loading model...")
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        entity="wutang",
        base_model=BASE_MODEL,
    )
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    # Fallback to Ollama for inference (Azure/W&B inference quota exceeded)
    ollama_base_url = os.environ.get("OLLAMA_BASE_URL", "https://ollama.pixelated.love/v1")
    ollama_api_key = os.environ.get("OLLAMA_API_KEY", "ollama")
    ollama_model = os.environ.get("OLLAMA_MODEL", "qwen3:30b-a3b")
    model.inference_base_url = ollama_base_url
    model.inference_api_key = ollama_api_key
    model.inference_model_name = ollama_model
    # Build a custom OpenAI client with a non-OpenAI User-Agent to avoid WAF blocks
    model._openai_client = AsyncOpenAI(
        base_url=ollama_base_url,
        api_key=ollama_api_key,
        default_headers={"User-Agent": "pixelated-training/1.0"},
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(timeout=1200, connect=5.0),
            limits=httpx.Limits(max_connections=100_000, max_keepalive_connections=100_000),
        ),
    )
    # Monkey-patch backend inference name so rollouts use the Ollama model name
    backend._model_inference_name = lambda _model, step=None: ollama_model  # type: ignore[method-assign]
    logging.info(f"Inference overridden to Ollama: {ollama_base_url} model={ollama_model}")

    wandb_step = await model.get_step()
    checkpoint = load_checkpoint()
    saved_step = checkpoint.get("last_completed_step", 0)
    resume_step = max(wandb_step, saved_step)
    logging.info(f"W&B step: {wandb_step}, checkpoint: {saved_step}, resuming from: {resume_step}")

    if resume_step < SFT_WARMUP_STEPS:
        logging.info(f"Starting SFT Warmup ({SFT_WARMUP_STEPS} steps)...")
        await train_sft_from_file(
            model=model,
            file_path=dataset_path,
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

    # Write deduped dataset to temp file so SFT warmup uses the same data as RL
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as tmp:
        for msgs in examples:
            tmp.write(json.dumps({"messages": msgs}) + "\n")
        deduped_dataset_path = tmp.name
    logging.info(f"Deduped dataset written to {deduped_dataset_path}")

    if not SUPERVISE:
        await _train_once(examples, deduped_dataset_path)
        return

    attempt = 0
    while not SHUTDOWN.is_set():
        attempt += 1
        logging.info(f"=== Training attempt #{attempt} ===")
        try:
            await _train_once(examples, deduped_dataset_path)
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
