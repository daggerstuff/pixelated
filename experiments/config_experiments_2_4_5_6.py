# wandb/experiments/config_experiments_2_4_5_6.py
# Experiments #2, #4, #5, #6 — Remaining A/B pairs
# Each pair varies exactly one parameter

from typing import Any

from experiments.experiment_runner import (
    run_experiment_pair,
    train_sft,
    run_distillation,
    run_sft_then_rl,
)


# Experiment #2: Distillation
# A: batch size 2, B: batch size 4
CONFIG_EXP_2_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "distill_epochs": 1,
    "distill_learning_rate": 5e-6,
    "batch_size": 2,
    "teacher_model": "gpt-4o",
    "temperature": 0.7,
    "data_path": "data/distill.jsonl",
}

CONFIG_EXP_2_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "distill_epochs": 1,
    "distill_learning_rate": 5e-6,
    "batch_size": 4,
    "teacher_model": "gpt-4o",
    "temperature": 0.7,
    "data_path": "data/distill.jsonl",
}


# Experiment #4: Multi-cookbook sweep
# A: format dataset, B: tool-call dataset
CONFIG_EXP_4_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "dataset_type": "format",
    "dataset_size": 10000,
    "data_path": "data/cookbook_train.jsonl",
}

CONFIG_EXP_4_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "dataset_type": "tool_call",
    "dataset_size": 10000,
    "data_path": "data/cookbook_train.jsonl",
}


# Experiment #5: SFT → endpoint
# A: best-eval step endpoint, B: final-step endpoint
CONFIG_EXP_5_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 2,
    "sft_learning_rate": 5e-6,
    "endpoint_step": "best_eval",
    "rl_epochs": 0,
    "data_path": "data/train.jsonl",
}

CONFIG_EXP_5_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 2,
    "sft_learning_rate": 5e-6,
    "endpoint_step": "final",
    "rl_epochs": 0,
    "data_path": "data/train.jsonl",
}


# Experiment #6: Reverse-RL
# A: normal reward, B: inverted reward
CONFIG_EXP_6_A: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "normal",
    "context_length": 2048,
    "data_path": "data/train.jsonl",
}

CONFIG_EXP_6_B: dict[str, Any] = {
    "base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "sft_epochs": 1,
    "sft_learning_rate": 5e-6,
    "rl_epochs": 1,
    "rl_learning_rate": 1e-6,
    "reward_type": "inverted",
    "context_length": 2048,
    "data_path": "data/train.jsonl",
}


async def run_exp_2():
    """Run Experiment #2 A/B pair: Distillation, varying batch size."""
    return await run_experiment_pair("2", CONFIG_EXP_2_A, CONFIG_EXP_2_B, training_fn=run_distillation)


async def run_exp_4():
    """Run Experiment #4 A/B pair: Multi-cookbook sweep, varying dataset type."""
    return await run_experiment_pair("4", CONFIG_EXP_4_A, CONFIG_EXP_4_B, training_fn=train_sft)


async def run_exp_5():
    """Run Experiment #5 A/B pair: SFT→endpoint, best-eval vs final step."""
    return await run_experiment_pair("5", CONFIG_EXP_5_A, CONFIG_EXP_5_B, training_fn=train_sft)


async def run_exp_6():
    """Run Experiment #6 A/B pair: Reverse-RL, normal vs inverted reward."""
    return await run_experiment_pair("6", CONFIG_EXP_6_A, CONFIG_EXP_6_B, training_fn=run_sft_then_rl)