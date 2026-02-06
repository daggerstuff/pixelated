"""
NVIDIA API service for Kimi-k2.5 model integration
"""

import asyncio
import json
import os
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import structlog

from bias_detection.config import settings

logger = structlog.get_logger(__name__)


class NvidiaAPIService:
    """Service for interacting with NVIDIA API and Kimi-k2.5 model"""

    def __init__(self):
        self.provider_name = "nvidia"
        self.model_name = "moonshotai/kimi-k2.5"
        self.api_base_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.api_key = None
        self.timeout = httpx.Timeout(30.0)
        self._load_configuration()

    def _load_configuration(self) -> None:
        """Load configuration from Claude Code router config"""
        config_path = "/home/vivi/.claude-code-router/config.json"

        try:
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = json.load(f)

                # Find NVIDIA provider configuration
                for provider in config.get("Providers", []):
                    if provider.get("name") == self.provider_name:
                        self.api_base_url = provider.get("api_base_url", self.api_base_url)
                        self.api_key = provider.get("api_key")

                        # Verify model is available
                        models = provider.get("models", [])
                        if self.model_name not in models:
                            logger.warning(
                                f"Model {self.model_name} not found in provider configuration",
                                available_models=models
                            )
                        break
                else:
                    logger.warning(f"Provider {self.provider_name} not found in configuration")

            # Fallback to environment variable if not found in config
            if not self.api_key:
                self.api_key = os.getenv("NVIDIA_API_KEY")

            if not self.api_key:
                raise ValueError("NVIDIA API key not found in configuration or environment")

        except Exception as e:
            logger.error(f"Failed to load NVIDIA API configuration: {str(e)}")
            raise

    async def chat_completion(
            self,
            messages: List[Dict[str, str]],
            max_tokens: int = 16384,
            temperature: float = 1.0,
            top_p: float = 1.0,
            stream: bool = False,
            thinking: bool = True,
            timeout: Optional[float] = None
    ) -> Dict[str, Any] | AsyncGenerator[str, None]:
        """
        Send chat completion request to Kimi-k2.5 model via NVIDIA API

        Args:
            messages: List of message dictionaries with role and content
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 to 1.0)
            top_p: Top-p sampling parameter
            stream: Whether to stream the response
            thinking: Whether to enable thinking mode
            timeout: Request timeout in seconds

        Returns:
            Dict with response or AsyncGenerator for streaming
        """
        try:
            # Prepare headers
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            if stream:
                headers["Accept"] = "text/event-stream"
            else:
                headers["Accept"] = "application/json"

            # Prepare payload
            payload = {
                "model": self.model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "stream": stream
            }

            # Add thinking parameter if enabled
            if thinking:
                payload["chat_template_kwargs"] = {"thinking": True}

            # Make API request
            start_time = time.time()

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_base_url,
                    headers=headers,
                    json=payload,
                    timeout=timeout or 30.0
                )

                response.raise_for_status()

                processing_time = time.time() - start_time

                if stream:
                    return self._stream_response(response)
                else:
                    result = response.json()
                    logger.info(
                        "NVIDIA API completion successful",
                        model=self.model_name,
                        processing_time_ms=int(processing_time * 1000),
                        prompt_tokens=result.get("usage", {}).get("prompt_tokens", 0),
                        completion_tokens=result.get("usage", {}).get("completion_tokens", 0)
                    )
                    return result

        except httpx.HTTPStatusError as e:
            logger.error(
                "NVIDIA API HTTP error",
                status_code=e.response.status_code,
                response_text=e.response.text,
                model=self.model_name
            )
            raise
        except httpx.RequestError as e:
            logger.error(
                "NVIDIA API request error",
                error=str(e),
                model=self.model_name
            )
            raise
        except Exception as e:
            logger.error(
                "Unexpected error in NVIDIA API call",
                error=str(e),
                model=self.model_name
            )
            raise

    async def _stream_response(self, response: httpx.Response) -> AsyncGenerator[str, None]:
        """
        Process streaming response from NVIDIA API

        Args:
            response: HTTP response object

        Yields:
            String chunks from the streaming response
        """
        async for line in response.aiter_lines():
            if line:
                # Parse SSE format
                if line.startswith("data: "):
                    data = line[6:]  # Remove "data: " prefix
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        yield chunk
                    except json.JSONDecodeError:
                        # Pass through raw data if not JSON
                        yield data
                else:
                    # Pass through other lines
                    yield line

    async def health_check(self) -> Dict[str, Any]:
        """
        Check health of NVIDIA API service

        Returns:
            Dict with health status information
        """
        try:
            start_time = time.time()

            # Simple model list request to check connectivity
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # For health check, we'll make a simple request
                # In a real implementation, you might want to check available models
                response_time = time.time() - start_time

                return {
                    "status": "healthy",
                    "provider": self.provider_name,
                    "model": self.model_name,
                    "api_base_url": self.api_base_url,
                    "response_time_ms": int(response_time * 1000),
                    "timestamp": time.time()
                }

        except Exception as e:
            logger.error("NVIDIA API health check failed", error=str(e))
            return {
                "status": "unhealthy",
                "provider": self.provider_name,
                "model": self.model_name,
                "error": str(e),
                "timestamp": time.time()
            }


# Convenience functions for common operations
async def get_nvidia_service() -> NvidiaAPIService:
    """Get singleton instance of NVIDIA API service"""
    return NvidiaAPIService()


async def kimi_chat_completion(
        messages: List[Dict[str, str]],
        max_tokens: int = 16384,
        temperature: float = 1.0,
        top_p: float = 1.0,
        stream: bool = False,
        thinking: bool = True
) -> Dict[str, Any] | AsyncGenerator[str, None]:
    """
    Convenience function for Kimi-k2.5 chat completion

    Args:
        messages: List of message dictionaries
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        top_p: Top-p sampling parameter
        stream: Whether to stream response
        thinking: Whether to enable thinking mode

    Returns:
        Dict with response or AsyncGenerator for streaming
    """
    service = NvidiaAPIService()
    return await service.chat_completion(
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        stream=stream,
        thinking=thinking
    )


# Example usage function
async def example_usage():
    """Example of how to use the NVIDIA API service"""
    try:
        # Initialize service
        service = NvidiaAPIService()

        # Check health
        health = await service.health_check()
        print(f"Health check: {health}")

        # Simple chat completion
        messages = [
            {"role": "user", "content": "Hello, how are you?"}
        ]

        response = await service.chat_completion(messages)
        print(f"Response: {response}")

        # Streaming example
        print("\nStreaming response:")
        stream_response = await service.chat_completion(messages, stream=True)
        if hasattr(stream_response, '__aiter__'):
            async for chunk in stream_response:
                if isinstance(chunk, dict) and "choices" in chunk:
                    content = chunk["choices"][0].get("delta", {}).get("content", "")
                    if content:
                        print(content, end="", flush=True)
        print()  # New line after streaming

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    # Run example if script is executed directly
    asyncio.run(example_usage())
