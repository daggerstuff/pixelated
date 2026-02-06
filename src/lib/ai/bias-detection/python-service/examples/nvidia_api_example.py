"""
Example script demonstrating how to use the Kimi-k2.5 model via NVIDIA API
"""

import asyncio
import json
import sys
from typing import Dict, List

# Add the service path to sys.path so we can import the service
sys.path.append("/home/vivi/pixelated/src/lib/ai/bias-detection/python-service")

from bias_detection.services.nvidia_api_service import NvidiaAPIService, kimi_chat_completion


async def basic_example():
    """Basic example of using Kimi-k2.5 model"""
    print("=== Basic Kimi-k2.5 Example ===")

    # Initialize the service
    service = NvidiaAPIService()

    # Check health
    print("Checking service health...")
    health = await service.health_check()
    print(f"Health status: {json.dumps(health, indent=2)}")

    # Simple conversation
    messages = [
        {"role": "user", "content": "Hello! Can you tell me about yourself?"}
    ]

    print("\nSending message to Kimi-k2.5...")
    try:
        response = await service.chat_completion(messages)
        print("Response:")
        print(json.dumps(response, indent=2))
    except Exception as e:
        print(f"Error: {e}")


async def streaming_example():
    """Example of streaming response from Kimi-k2.5"""
    print("\n=== Streaming Example ===")

    service = NvidiaAPIService()

    messages = [
        {"role": "user", "content": "Write a short poem about artificial intelligence."}
    ]

    print("Streaming response from Kimi-k2.5:")
    print("-" * 40)

    try:
        response_generator = await service.chat_completion(messages, stream=True)

        # Handle the streaming response
        if hasattr(response_generator, '__aiter__'):
            async for chunk in response_generator:
                if isinstance(chunk, dict):
                    # Handle JSON chunks
                    if "choices" in chunk and len(chunk["choices"]) > 0:
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            print(content, end="", flush=True)
                else:
                    # Handle raw text chunks
                    print(chunk, end="", flush=True)
            print()  # New line at the end
        else:
            print("Received non-streaming response:", response_generator)

    except Exception as e:
        print(f"\nError during streaming: {e}")


async def conversation_example():
    """Example of multi-turn conversation"""
    print("\n=== Multi-turn Conversation Example ===")

    service = NvidiaAPIService()

    # Start conversation
    conversation_history = [
        {"role": "user", "content": "Hi! I'm learning about machine learning. Can you help me?"}
    ]

    print("Starting conversation with Kimi-k2.5...")

    try:
        # First response
        response = await service.chat_completion(conversation_history)
        assistant_message = response["choices"][0]["message"]["content"]
        print(f"Assistant: {assistant_message}")

        # Add to conversation history
        conversation_history.append({"role": "assistant", "content": assistant_message})

        # Second user message
        conversation_history.append({"role": "user", "content": "That's helpful! Can you give me an example?"})

        # Second response
        response = await service.chat_completion(conversation_history)
        assistant_message = response["choices"][0]["message"]["content"]
        print(f"Assistant: {assistant_message}")

    except Exception as e:
        print(f"Error in conversation: {e}")


async def parameter_tuning_example():
    """Example showing different parameter settings"""
    print("\n=== Parameter Tuning Example ===")

    service = NvidiaAPIService()

    messages = [
        {"role": "user", "content": "Tell me a creative story about a robot learning to paint."}
    ]

    # Different parameter combinations
    settings = [
        {"temperature": 0.3, "top_p": 0.9, "description": "More focused, deterministic"},
        {"temperature": 0.7, "top_p": 0.9, "description": "Balanced creativity"},
        {"temperature": 1.0, "top_p": 1.0, "description": "Highly creative, diverse"}
    ]

    for setting in settings:
        print(f"\n--- {setting['description']} ---")
        print(f"Temperature: {setting['temperature']}, Top-p: {setting['top_p']}")

        try:
            response = await service.chat_completion(
                messages=messages,
                temperature=setting["temperature"],
                top_p=setting["top_p"],
                max_tokens=1000
            )
            content = response["choices"][0]["message"]["content"]
            print(f"Story: {content[:200]}...")  # Print first 200 characters
        except Exception as e:
            print(f"Error: {e}")


async def convenience_function_example():
    """Example using the convenience function"""
    print("\n=== Convenience Function Example ===")

    messages = [
        {"role": "user", "content": "Explain what makes a good chatbot in one sentence."}
    ]

    try:
        response = await kimi_chat_completion(messages)
        content = response["choices"][0]["message"]["content"]
        print(f"Response: {content}")
    except Exception as e:
        print(f"Error: {e}")


async def main():
    """Run all examples"""
    print("Kimi-k2.5 NVIDIA API Examples")
    print("=" * 50)

    # Run examples
    await basic_example()
    await streaming_example()
    await conversation_example()
    await parameter_tuning_example()
    await convenience_function_example()

    print("\n" + "=" * 50)
    print("All examples completed!")


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
