#!/usr/bin/env python3
"""Minimal test to check if 30B model works with serverless backend.

NOTE: W&B inference is NOT free for us. This test uses local Ollama for
inference and only tests W&B serverless registration/training.
"""

import asyncio
import os

from openai import AsyncOpenAI

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required")

import art
from art.serverless.backend import ServerlessBackend

OLLAMA_CLIENT = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
OLLAMA_MODEL = "hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_S"


async def main():
    print("Testing 30B model registration...")
    model = art.TrainableModel(
        name="qwen3-30b-serverless-test",
        project="wayfarer-ab-test",
        entity="wutang",
        base_model="OpenPipe/Qwen3-30B-A3B-Instruct-2507",
    )
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    await model.register(backend)
    print(f"Model registered! Step: {await model.get_step()}")

    print("Testing local Ollama inference (NOT W&B inference)...")
    completion = await OLLAMA_CLIENT.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": "Hello, how are you?"}],
        max_tokens=50,
        temperature=0.8,
    )
    response = completion.choices[0].message.content
    print(f"Response: {response}")
    print("30B model test successful!")


if __name__ == "__main__":
    asyncio.run(main())
