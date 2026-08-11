# wandb/experiments/config_experiment_3.py
# Experiment #3: 2048 RL
# A: default reward, B: custom reward weight (single parameter variation)

from typing import Any

from experiments.experiment_runner import run_experiment_pair, run_sft_then_rl


CONFIG_EXP_3_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "default",
    "context_length": 2048,
    "data_path": "data/train.jsonl",
}

CONFIG_EXP_3_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "custom_weight",
    "reward_weight": 2.0,
    "context_length": 2048,
    "data_path": "data/train.jsonl",
}


async def run_exp_3():
    """Run Experiment #3 A/B pair: 2048 RL, varying reward type."""
    return await run_experiment_pair("3", CONFIG_EXP_3_A, CONFIG_EXP_3_B, training_fn=run_sft_then_rl)