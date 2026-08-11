# wandb/experiments/config_experiment_1.py
# Experiment #1: SFT → RL Warm-Up
# A: 1 SFT epoch, B: 2 SFT epochs (single parameter variation)

from typing import Any

from experiments.experiment_runner import run_experiment_pair, run_sft_then_rl


CONFIG_EXP_1_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "default",
    "data_path": "data/train.jsonl",
}

CONFIG_EXP_1_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 2,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "default",
    "data_path": "data/train.jsonl",
}


async def run_exp_1():
    """Run Experiment #1 A/B pair: SFT→RL warm-up, varying SFT epochs."""
    return await run_experiment_pair("1", CONFIG_EXP_1_A, CONFIG_EXP_1_B, training_fn=run_sft_then_rl)
