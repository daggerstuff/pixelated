# wandb/experiments/experiment_runner.py
import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable

from art.serverless.backend import ServerlessBackend
from art import TrainableModel, Trajectory, TrajectoryGroup, TrainSFTConfig

WANDB_API_KEY = os.environ.get("WANDB_API_KEY")


@dataclass
class LabeledModel:
    """TrainableModel with A/B tags attached."""
    model: TrainableModel
    tags: list[str]


def load_trajectories_from_jsonl(data_path: str) -> list[Trajectory]:
    """Load SFT training data from a JSONL file into Trajectory objects.

    Each line should be a JSON object with a 'messages_and_choices' key
    containing a list of chat messages in OpenAI format.
    """
    trajectories: list[Trajectory] = []
    path = Path(data_path)
    if not path.exists():
        raise FileNotFoundError(f"Training data not found: {data_path}")
    for line in path.read_text().strip().splitlines():
        record = json.loads(line)
        traj = Trajectory(
            messages_and_choices=record.get("messages_and_choices", []),
            reward=record.get("reward", 0.0),
            metrics=record.get("metrics", {}),
        )
        trajectories.append(traj)
    return trajectories


async def train_sft(model: TrainableModel, config: dict[str, Any]) -> None:
    """Run SFT training on a model using config parameters."""
    sft_config = TrainSFTConfig(
        learning_rate=config.get("sft_learning_rate", 5e-6),
        batch_size=config.get("batch_size", "auto"),
    )
    data_path = config.get("data_path", "data/train.jsonl")
    trajectories = load_trajectories_from_jsonl(data_path)
    epochs = config.get("sft_epochs", 1)
    for _ in range(epochs):
        await model.train_sft(trajectories, sft_config)


async def train_rl(model: TrainableModel, config: dict[str, Any]) -> None:
    """Run RL training on a model using backend.train()."""
    backend = model.backend()
    learning_rate = config.get("rl_learning_rate", 1e-6)
    rl_epochs = config.get("rl_epochs", 1)
    data_path = config.get("data_path", "data/rl_trajectories.jsonl")

    trajectory_groups = _load_trajectory_groups(data_path)
    for _ in range(rl_epochs):
        await backend.train(model, trajectory_groups, learning_rate=learning_rate)


def _load_trajectory_groups(data_path: str) -> Iterable[TrajectoryGroup]:
    """Load trajectory groups from a JSONL file for RL training."""
    path = Path(data_path)
    if not path.exists():
        raise FileNotFoundError(f"RL trajectory data not found: {data_path}")
    groups: list[TrajectoryGroup] = []
    for line in path.read_text().strip().splitlines():
        record = json.loads(line)
        trajectories = [
            Trajectory(
                messages_and_choices=t.get("messages_and_choices", []),
                reward=t.get("reward", 0.0),
                metrics=t.get("metrics", {}),
            )
            for t in record.get("trajectories", [])
        ]
        groups.append(TrajectoryGroup(trajectories=trajectories))
    return groups


async def run_sft_then_rl(model: TrainableModel, config: dict[str, Any]) -> None:
    """SFT warm-up followed by RL training."""
    await train_sft(model, config)
    await train_rl(model, config)


async def run_distillation(model: TrainableModel, config: dict[str, Any]) -> None:
    """Distillation: SFT using teacher model outputs.

    The teacher model generates completions that are used as SFT training data.
    """
    sft_config = TrainSFTConfig(
        learning_rate=config.get("distill_learning_rate", 5e-6),
        batch_size=config.get("batch_size", "auto"),
    )
    data_path = config.get("data_path", "data/distill.jsonl")
    trajectories = load_trajectories_from_jsonl(data_path)
    epochs = config.get("distill_epochs", 1)
    for _ in range(epochs):
        await model.train_sft(trajectories, sft_config)


TrainingFn = Callable[[TrainableModel, dict[str, Any]], Any]


async def run_experiment_pair(
    exp_id: str,
    a_config: dict,
    b_config: dict,
    training_fn: TrainingFn | None = None,
):
    """Run A/B pair. Returns tuple (LabeledModel_a, LabeledModel_b) with tags.

    If training_fn is provided, it will be called on each model after registration.
    """
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    # A variant
    model_a = TrainableModel(
        name=f"exp-{exp_id}-A",
        project="serverless-ab",
        base_model=a_config.get("base_model", "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    )
    await model_a.register(backend)
    # B variant
    model_b = TrainableModel(
        name=f"exp-{exp_id}-B",
        project="serverless-ab",
        base_model=b_config.get("base_model", "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    )
    await model_b.register(backend)

    if training_fn is not None:
        await training_fn(model_a, a_config)
        await training_fn(model_b, b_config)

    return (
        LabeledModel(model=model_a, tags=["A", f"group:{exp_id}"]),
        LabeledModel(model=model_b, tags=["B", f"group:{exp_id}"]),
    )


async def launch_parallel_start():
    """Launch #1 and #3 A/B pairs in parallel (4 runs)."""
    from experiments.config_experiment_1 import run_exp_1
    from experiments.config_experiment_3 import run_exp_3

    results = await asyncio.gather(
        run_exp_1(),  # returns (model_1a, model_1b)
        run_exp_3(),
    )
    # results[0] = (model_1a, model_1b), results[1] = (model_3a, model_3b)
    return results


async def launch_remaining_batch():
    """Launch remaining 4 pairs = 8 runs."""
    from experiments.config_experiments_2_4_5_6 import run_exp_2, run_exp_4, run_exp_5, run_exp_6

    results = await asyncio.gather(run_exp_2(), run_exp_4(), run_exp_5(), run_exp_6())
    return results  # 4 tuples of (A, B)