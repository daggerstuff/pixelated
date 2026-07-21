#!/usr/bin/env python3
"""
Recreate W&B Serverless Training Runs
======================================

This script accesses wandb logs for the latest serverless runs and recreates them.
It also generates a comprehensive report of previous runs.

Previous runs (from wayfarer-ab-test project):
- wayfarer-2-12b-serverless-sft: Finished, 297 steps, ~3.3h, reward=0.317
- wayfarer-2-12b-serverless-rl-v2: Finished, 100 steps, ~47min, reward=0.400
- qwen3-30b-serverless-rl: FAILED after 114s (SFT warmup issue)
- test-model: FAILED after 5s (artifact upload only)

Usage:
    export WANDB_API_KEY=...
    python scripts/training/recreate_serverless_runs.py --report
    python scripts/training/recreate_serverless_runs.py --run-30b
    python scripts/training/recreate_serverless_runs.py --evaluate-12b
"""

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path

from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
PROJECT = "wayfarer-ab-test"

# Use local Ollama for rollouts to avoid W&B inference quota costs.
OLLAMA_CLIENT = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
OLLAMA_MODEL = "hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_S"


def generate_report():
    """Fetch all runs from wandb and generate a comprehensive report."""
    import wandb

    api = wandb.Api()
    runs = api.runs(PROJECT, per_page=50)

    report_lines = [
        "# W&B Serverless Runs Report",
        f"Generated: {datetime.utcnow().isoformat()}Z",
        f"Project: {PROJECT}",
        "",
        "## Summary",
        "",
    ]

    for r in runs:
        runtime = r.summary.get("_wandb", {}).get("runtime", "N/A")
        steps = r.summary.get("training_step", "N/A")
        reward = r.summary.get("train/reward", "N/A")
        loss = r.summary.get("loss/train", "N/A")

        status_icon = "✅" if r.state == "finished" and steps != "N/A" else "⚠️" if r.state == "finished" else "❌"

        report_lines.append(f"### {status_icon} {r.name}")
        report_lines.append(f"- **State:** {r.state}")
        report_lines.append(f"- **Created:** {r.created_at}")
        report_lines.append(f"- **Runtime:** {runtime}s")
        report_lines.append(f"- **Training Steps:** {steps}")
        report_lines.append(f"- **Final Reward:** {reward}")
        report_lines.append(f"- **Final Loss:** {loss}")
        report_lines.append("")

    report_text = "\n".join(report_lines)
    report_path = Path("/tmp/wandb_serverless_report.md")
    report_path.write_text(report_text)
    logger.info(f"Report saved to {report_path}")
    print(report_text)
    return report_text


def fetch_run_history(run_name: str):
    """Fetch detailed history for a specific run."""
    import wandb

    api = wandb.Api()
    run = api.run(f"{PROJECT}/{run_name}")
    history = run.history()

    output_path = Path(f"/tmp/{run_name}_history.json")
    history.to_json(output_path, orient="records")
    logger.info(f"History for {run_name} saved to {output_path} ({len(history)} rows)")
    return history


async def run_30b_experiment():
    """Re-run the 30B serverless RL experiment."""
    import art
    from art.serverless.backend import ServerlessBackend

    if not WANDB_API_KEY:
        raise ValueError("WANDB_API_KEY is required")

    MODEL_NAME = "qwen3-30b-serverless-rl-v2"
    BASE_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"
    DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

    GROUPS_PER_STEP = 5
    ROLLOUTS_PER_GROUP = 8
    LEARNING_RATE = 1e-5
    MAX_RL_STEPS = 100

    logger.info("Loading dataset...")
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                examples.append(messages)
    logger.info(f"Loaded {len(examples)} examples")

    logger.info("Initializing 30B model...")
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        entity="wutang",
        base_model=BASE_MODEL,
    )
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    # Try SFT warmup with better error handling
    from art.utils.sft import train_sft_from_file

    logger.info("Starting SFT Warmup...")
    try:
        await train_sft_from_file(
            model=model,
            file_path=DATASET_PATH,
            epochs=1,
        )
        logger.info("SFT Warmup complete!")
    except Exception as e:
        logger.error(f"SFT Warmup failed: {e}")
        logger.info("Attempting to continue with RL without SFT warmup...")

    start_step = await model.get_step()
    logger.info(f"Starting RL from step {start_step}")

    for step in range(MAX_RL_STEPS):
        import random

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
        logger.info(f"Step {result.step}: avg_reward={avg_reward:.3f}")

    logger.info("30B RL training complete!")


async def rollout(model, messages: list):
    """Generate a response and compute reward via local Ollama."""
    import math

    import art

    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )
    trajectory.messages_and_choices = list(context)

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

    response_len = len(response.split())
    expected_len = len(expected.split())
    target_len = max(expected_len, 100)
    sigma = 150.0
    length_reward = math.exp(-((response_len - target_len) ** 2) / (2 * sigma**2))

    res_words = response.lower().split()
    exp_words = expected.lower().split()
    n = 2
    if len(res_words) >= n and len(exp_words) >= n:
        res_ngrams = {tuple(res_words[i : i + n]) for i in range(len(res_words) - n + 1)}
        exp_ngrams = {tuple(exp_words[i : i + n]) for i in range(len(exp_words) - n + 1)}
        intersection = len(res_ngrams & exp_ngrams)
        union = len(res_ngrams | exp_ngrams)
        overlap = intersection / union if union > 0 else 0.0
    else:
        res_set = set(res_words)
        exp_set = set(exp_words)
        overlap = len(res_set & exp_set) / len(exp_set) if exp_set else 0.0

    trajectory.reward = length_reward * 0.4 + overlap * 0.6
    trajectory.metrics["response_len"] = response_len
    trajectory.metrics["expected_len"] = expected_len
    trajectory.metrics["length_ratio"] = response_len / max(expected_len, 1)
    trajectory.metrics["overlap"] = overlap

    return trajectory


async def evaluate_12b_model():
    """Evaluate on golden questions using local Ollama (NOT the trained W&B model).

    NOTE: W&B inference is not free for us, so we use Ollama for evaluation.
    This evaluates the local Ollama model, not the W&B serverless checkpoint.
    """
    # Load golden questions
    golden_path = Path("ai/lab/evals/golden_questions.json")
    if not golden_path.exists():
        logger.warning(f"Golden questions not found at {golden_path}")
        return

    with open(golden_path) as f:
        questions = json.load(f)

    logger.info(f"Evaluating on {len(questions)} questions via Ollama...")
    results = []
    for q in questions[:5]:  # Test with first 5
        prompt = q.get("question", q.get("prompt", ""))
        completion = await OLLAMA_CLIENT.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
            temperature=0.8,
        )
        response = completion.choices[0].message.content
        results.append({"prompt": prompt, "response": response})
        logger.info(f"Q: {prompt[:80]}...")
        logger.info(f"A: {response[:200]}...")

    output_path = Path("/tmp/12b_evaluation_results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"Evaluation results saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Recreate W&B serverless training runs")
    parser.add_argument("--report", action="store_true", help="Generate report of previous runs")
    parser.add_argument("--fetch-history", type=str, help="Fetch history for a specific run name")
    parser.add_argument("--run-30b", action="store_true", help="Re-run the 30B experiment")
    parser.add_argument("--evaluate-12b", action="store_true", help="Evaluate the 12B model")
    args = parser.parse_args()

    if args.report:
        generate_report()
    elif args.fetch_history:
        fetch_run_history(args.fetch_history)
    elif args.run_30b:
        asyncio.run(run_30b_experiment())
    elif args.evaluate_12b:
        asyncio.run(evaluate_12b_model())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
