# Kimi-k2.5 NVIDIA API Integration

This document explains how to properly use the Kimi-k2.5 model from Moonshot AI via NVIDIA's API integration.

## Overview

The Kimi-k2.5 model is accessible through NVIDIA's API platform and has been integrated into our bias detection service.
This implementation provides:

1. Proper authentication using the configured API key
2. Support for both regular and streaming responses
3. Error handling for API calls
4. Configuration loading from Claude Code router
5. Convenience functions for easy usage

## Configuration

The service automatically loads configuration from `/home/vivi/.claude-code-router/config.json`. The relevant section
looks like:

```json
{
  "Providers": [
    {
      "name": "nvidia",
      "api_base_url": "https://integrate.api.nvidia.com/v1/chat/completions",
      "api_key": "nvapi-...",
      "models": [
        "moonshotai/kimi-k2.5"
      ]
    }
  ]
}
```

If the configuration file is not found, the service will fall back to using the `NVIDIA_API_KEY` environment variable.

## Usage Examples

### Basic Usage

```python
from bias_detection.services.nvidia_api_service import NvidiaAPIService

# Initialize service
service = NvidiaAPIService()

# Create messages
messages = [
    {"role": "user", "content": "Hello, how are you?"}
]

# Get response
response = await service.chat_completion(messages)
print(response["choices"][0]["message"]["content"])
```

### Streaming Response

```python
# Get streaming response
response_generator = await service.chat_completion(messages, stream=True)

async for chunk in response_generator:
    if isinstance(chunk, dict) and "choices" in chunk:
        content = chunk["choices"][0].get("delta", {}).get("content", "")
        if content:
            print(content, end="", flush=True)
```

### Using Convenience Function

```python
from bias_detection.services.nvidia_api_service import kimi_chat_completion

messages = [
    {"role": "user", "content": "Explain quantum computing in simple terms."}
]

response = await kimi_chat_completion(messages)
print(response["choices"][0]["message"]["content"])
```

## Parameters

The `chat_completion` method supports the following parameters:

- `messages`: List of message dictionaries with "role" and "content"
- `max_tokens`: Maximum number of tokens to generate (default: 16384)
- `temperature`: Sampling temperature between 0.0 and 1.0 (default: 1.0)
- `top_p`: Top-p sampling parameter between 0.0 and 1.0 (default: 1.0)
- `stream`: Whether to stream the response (default: False)
- `thinking`: Whether to enable thinking mode (default: True)

## Error Handling

The service includes comprehensive error handling:

- HTTP status errors
- Request timeouts
- Network errors
- JSON parsing errors
- Configuration errors

All errors are logged using structlog for debugging purposes.

## Testing

Run tests with:

```bash
cd /home/vivi/pixelated/src/lib/ai/bias-detection/python-service
python -m pytest tests/test_nvidia_api_service.py -v
```

## Examples

See the example script at:
`/home/vivi/pixelated/src/lib/ai/bias-detection/python-service/examples/nvidia_api_example.py`

Run it with:

```bash
cd /home/vivi/pixelated/src/lib/ai/bias-detection/python-service
python examples/nvidia_api_example.py
```

## Dependencies

Install required dependencies with:

```bash
pip install -r requirements-nvidia.txt
```

## Integration with Bias Detection

The NVIDIA API service can be integrated with the existing model ensemble service to provide additional bias detection
capabilities using the advanced Kimi-k2.5 model.