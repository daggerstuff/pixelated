"""
W&B Serverless RL Training for Qwen3-14B (after SFT warmup)
Uses OpenPipe ART framework with ServerlessBackend + GRPO.
"""

import asyncio
import json
import os
import random

import art
from art.serverless.backend import ServerlessBackend

# Required environment variable
WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required for serverless training.")

# Configuration
PROJECT = "wayfarer-ab-test"
MODEL_NAME = "wayfarer-2-12b-serverless-sft"
BASE_MODEL = "OpenPipe/Qwen3-14B-Instruct"
DATASET_PATH = "/home/vivi/dataset/RL_training_dataset.jsonl"

# RL Hyperparameters
GROUPS_PER_STEP = 5
ROLLOUTS_PER_GROUP = 4
LEARNING_RATE = 5e-5
MAX_RL_STEPS = 100


async def rollout(model: art.Model, messages: list) -> art.Trajectory:
    """Generate a response and compute reward."""
    client = model.openai_client()

    # Build trajectory from messages (all but last = context, last = expected assistant)
    context = messages[:-1] if len(messages) > 1 else messages
    expected = messages[-1]["content"] if messages else ""

    trajectory = art.Trajectory(
        messages_and_choices=list(context),
        reward=0.0,
        metrics={"response_len": 0, "expected_len": 0, "length_ratio": 0.0},
    )

    # Add user prompt (last message before assistant)
    user_msg = context[-1] if context else {"role": "user", "content": "Hello"}
    if user_msg.get("role") != "user":
        user_msg = {"role": "user", "content": user_msg.get("content", "")}

    # Ensure trajectory ends with user message for generation
    trajectory.messages_and_choices = list(context)

    # Generate completion
    completion = await client.chat.completions.create(
        model=model.get_inference_name(),
        messages=trajectory.messages(),
        max_tokens=1024,
        temperature=0.8,
        logprobs=True,
        extra_body={"return_token_ids": True},
    )
    choice = completion.choices[0]

    # Extract prompt_token_ids from completion and attach to choice
    prompt_token_ids = getattr(completion, "prompt_token_ids", None)
    if prompt_token_ids is None and hasattr(completion, "model_extra") and completion.model_extra:
        prompt_token_ids = completion.model_extra.get("prompt_token_ids")

    if prompt_token_ids is not None:
        if getattr(choice, "__pydantic_extra__", None) is None:
            object.__setattr__(choice, "__pydantic_extra__", {})
        choice.__pydantic_extra__["prompt_token_ids"] = prompt_token_ids

    trajectory.messages_and_choices.append(choice)
    response = choice.message.content or ""

    # Compute reward
    response_len = len(response.split())
    expected_len = len(expected.split())

    # Length reward: prefer responses between 20-300 words
    if 20 <= response_len <= 300:
        length_reward = 1.0
    elif response_len < 10:
        length_reward = 0.1
    elif response_len > 500:
        length_reward = 0.3
    else:
        length_reward = 0.5

    # Similarity reward: rough token overlap ratio
    response_words = set(response.lower().split())
    expected_words = set(expected.lower().split())
    overlap = len(response_words & expected_words) / len(expected_words) if expected_words else 0.0

    # Combine rewards
    trajectory.reward = length_reward * 0.5 + overlap * 0.5
    trajectory.metrics["response_len"] = response_len
    trajectory.metrics["expected_len"] = expected_len
    trajectory.metrics["length_ratio"] = response_len / max(expected_len, 1)
    trajectory.metrics["overlap"] = overlap

    return trajectory


async def main():
    examples = []
    with open(DATASET_PATH) as f:
        for i, line in enumerate(f):
            if i >= 5000:  # Use 5k examples for RL
                break
            data = json.loads(line)
            messages = data.get("messages", [])
            if len(messages) >= 2 and messages[-1].get("role") == "assistant":
                examples.append(messages)

    # Create/load model (continues from SFT checkpoint)
    model = art.TrainableModel(
        name=MODEL_NAME,
        project=PROJECT,
        base_model=BASE_MODEL,
    )

    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)

    # SFT Warmup already completed via separate run or prior execution
    # from art.utils.sft import train_sft_from_file
    # print("Starting SFT Warmup...")
    # await train_sft_from_file(
    #     model=model,
    #     file_path=DATASET_PATH,
    #     epochs=1,
    # )

    start_step = await model.get_step()

    # RL training loop
    for step in range(MAX_RL_STEPS):
        # Sample batch
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

        # FIX: TrajectoryGroup has no .reward — average over the trajectories inside each group
        all_rewards = [t.reward for g in train_groups for t in g.trajectories]
        sum(all_rewards) / len(all_rewards) if all_rewards else 0.0


if __name__ == "__main__":
    asyncio.run(main())
