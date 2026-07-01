"""
Example script demonstrating how to use the Kimi-k2.5 model via NVIDIA API
"""

import asyncio
import sys

# Add the service path to sys.path so we can import the service
sys.path.append("/home/vivi/pixelated/src/lib/ai/bias-detection/python-service")

import contextlib

from bias_detection.services.nvidia_api_service import (
    NvidiaAPIService,
    kimi_chat_completion,
)


async def basic_example():
    """Basic example of using Kimi-k2.5 model"""

    # Initialize the service
    service = NvidiaAPIService()

    # Check health
    await service.health_check()

    # Simple conversation
    messages = [{"role": "user", "content": "Hello! Can you tell me about yourself?"}]

    with contextlib.suppress(Exception):
        await service.chat_completion(messages)


async def streaming_example():
    """Example of streaming response from Kimi-k2.5"""

    service = NvidiaAPIService()

    messages = [{"role": "user", "content": "Write a short poem about artificial intelligence."}]

    try:
        response_generator = await service.chat_completion(messages, stream=True)

        # Handle the streaming response
        if hasattr(response_generator, "__aiter__"):
            async for chunk in response_generator:
                if isinstance(chunk, dict):
                    # Handle JSON chunks
                    if "choices" in chunk and len(chunk["choices"]) > 0:
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            pass
                else:
                    # Handle raw text chunks
                    pass
        else:
            pass

    except Exception:
        pass


async def conversation_example():
    """Example of multi-turn conversation"""

    service = NvidiaAPIService()

    # Start conversation
    conversation_history = [
        {
            "role": "user",
            "content": "Hi! I'm learning about machine learning. Can you help me?",
        }
    ]

    try:
        # First response
        response = await service.chat_completion(conversation_history)
        assistant_message = response["choices"][0]["message"]["content"]

        # Add to conversation history
        conversation_history.append({"role": "assistant", "content": assistant_message})

        # Second user message
        conversation_history.append({"role": "user", "content": "That's helpful! Can you give me an example?"})

        # Second response
        response = await service.chat_completion(conversation_history)
        assistant_message = response["choices"][0]["message"]["content"]

    except Exception:
        pass


async def parameter_tuning_example():
    """Example showing different parameter settings"""

    service = NvidiaAPIService()

    messages = [
        {
            "role": "user",
            "content": "Tell me a creative story about a robot learning to paint.",
        }
    ]

    # Different parameter combinations
    settings = [
        {
            "temperature": 0.3,
            "top_p": 0.9,
            "description": "More focused, deterministic",
        },
        {"temperature": 0.7, "top_p": 0.9, "description": "Balanced creativity"},
        {"temperature": 1.0, "top_p": 1.0, "description": "Highly creative, diverse"},
    ]

    for setting in settings:
        try:
            response = await service.chat_completion(
                messages=messages,
                temperature=setting["temperature"],
                top_p=setting["top_p"],
                max_tokens=1000,
            )
            response["choices"][0]["message"]["content"]
        except Exception:
            pass


async def convenience_function_example():
    """Example using the convenience function"""

    messages = [
        {
            "role": "user",
            "content": "Explain what makes a good chatbot in one sentence.",
        }
    ]

    try:
        response = await kimi_chat_completion(messages)
        response["choices"][0]["message"]["content"]
    except Exception:
        pass


async def main():
    """Run all examples"""

    # Run examples
    await basic_example()
    await streaming_example()
    await conversation_example()
    await parameter_tuning_example()
    await convenience_function_example()


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
