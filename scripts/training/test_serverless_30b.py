#!/usr/bin/env python3
"""Minimal test to check if 30B model works with serverless backend."""

import asyncio
import os

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
if not WANDB_API_KEY:
    raise ValueError("WANDB_API_KEY is required")

import art
from art.serverless.backend import ServerlessBackend


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

    print("Testing inference...")
    client = model.openai_client()
    completion = await client.chat.completions.create(
        model=model.get_inference_name(),
        messages=[{"role": "user", "content": "Hello, how are you?"}],
        max_tokens=50,
        temperature=0.8,
    )
    response = completion.choices[0].message.content
    print(f"Response: {response}")
    print("30B model test successful!")


if __name__ == "__main__":
    asyncio.run(main())
