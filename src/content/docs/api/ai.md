---
title: 'AI API Reference'
description: 'AI API Reference documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

# AI API Reference

This document provides a comprehensive reference for the AI API endpoints and services available in the application.

## Overview

The AI API provides access to various AI capabilities, including:

- Chat completions with multiple AI providers
- Sentiment analysis
- Crisis detection
- Response generation
- Intervention effectiveness analysis

All API endpoints require authentication and include comprehensive error handling and performance optimization.

## Endpoints

### Chat Completion

```http
POST /api/ai/completion
```

Creates a chat completion using the specified AI provider and model.

#### Request Body

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 1000,
  "provider": "openai"
}
```

| Parameter     | Type     | Description                                                                  |
| ------------- | -------- | ---------------------------------------------------------------------------- |
| `messages`    | `array`  | **Required**. Array of messages in the conversation.                         |
| `model`       | `string` | **Required**. The model to use for completion.                               |
| `temperature` | `number` | Controls randomness. Higher values produce more random outputs. Default: 0.7 |
| `max_tokens`  | `number` | Maximum number of tokens to generate. Default: 1000                          |
| `provider`    | `string` | AI provider to use. Options: "openai", "anthropic". Default: "openai"        |

#### Response

```json
{
  "completion": {
    "content": "I'm doing well, thank you for asking! How can I assist you today?",
    "model": "gpt-4o",
    "usage": {
      "prompt_tokens": 23,
      "completion_tokens": 15,
      "total_tokens": 38
    }
  },
  "processingTime": 1250
}
```

### Streaming Chat Completion

```http
POST /api/ai/completion/stream
```

Creates a streaming chat completion using the specified AI provider and model.

#### Request Body

Same as the Chat Completion endpoint.

#### Response

Server-sent events stream with the following format:

```
event: completion
data: {"content": "I'm ", "model": "gpt-4o"}

event: completion
data: {"content": "doing ", "model": "gpt-4o"}

event: completion
data: {"content": "well", "model": "gpt-4o"}

event: done
data: {"usage": {"prompt_tokens": 23, "completion_tokens": 15, "total_tokens": 38}, "processingTime": 1250}
```

### Sentiment Analysis

```http
POST /api/ai/sentiment
```

Analyzes the sentiment of the provided text.

#### Request Body

```json
{
  "text": "I am feeling great today!",
  "model": "gpt-4o",
  "provider": "openai"
}
```

| Parameter  | Type     | Description                                                           |
| ---------- | -------- | --------------------------------------------------------------------- |
| `text`     | `string` | **Required**. The text to analyze.                                    |
| `model`    | `string` | The model to use for analysis. Default: "gpt-4o"                      |
| `provider` | `string` | AI provider to use. Options: "openai", "anthropic". Default: "openai" |

#### Response

```json
{
  "result": {
    "sentiment": "positive",
    "score": 0.85,
    "explanation": "The text expresses a positive emotion with the phrase 'feeling great'.",
    "model": "gpt-4o",
    "processingTime": 980
  }
}
```

### Crisis Detection

```http
POST /api/ai/crisis-detection
```

Detects potential crisis situations in the provided text.

#### Request Body

```json
{
  "text": "I've been feeling really down lately and don't see the point in going on.",
  "model": "gpt-4o",
  "provider": "openai"
}
```

| Parameter  | Type     | Description                                                           |
| ---------- | -------- | --------------------------------------------------------------------- |
| `text`     | `string` | **Required**. The text to analyze.                                    |
| `model`    | `string` | The model to use for analysis. Default: "gpt-4o"                      |
| `provider` | `string` | AI provider to use. Options: "openai", "anthropic". Default: "openai" |

#### Response

```json
{
  "result": {
    "is_crisis": true,
    "risk_level": "high",
    "crisis_type": "suicidal_ideation",
    "confidence": 0.92,
    "reasoning": "The text contains expressions of hopelessness ('don't see the point in going on') which is a warning sign for suicidal ideation.",
    "model": "gpt-4o",
    "processingTime": 1050
  }
}
```

### Response Generation

```http
POST /api/ai/response
```

Generates a therapeutic response to the provided conversation.

#### Request Body

```json
{
  "messages": [
    {
      "role": "user",
      "content": "I've been feeling anxious about my upcoming presentation."
    }
  ],
  "model": "gpt-4o",
  "provider": "openai"
}
```

| Parameter  | Type     | Description                                                           |
| ---------- | -------- | --------------------------------------------------------------------- |
| `messages` | `array`  | **Required**. Array of messages in the conversation.                  |
| `model`    | `string` | The model to use for generation. Default: "gpt-4o"                    |
| `provider` | `string` | AI provider to use. Options: "openai", "anthropic". Default: "openai" |

#### Response

```json
{
  "result": {
    "response": "It's completely normal to feel anxious about presentations. Many people experience this. Have you tried any relaxation techniques that have helped you in the past?",
    "model": "gpt-4o",
    "processingTime": 1150,
    "usage": {
      "total_tokens": 45,
      "prompt_tokens": 15,
      "completion_tokens": 30
    }
  }
}
```

### Intervention Analysis

```http
POST /api/ai/intervention-analysis
```

Analyzes the effectiveness of a therapeutic intervention.

#### Request Body

```json
{
  "conversation": [
    {
      "role": "user",
      "content": "I've been feeling anxious about my upcoming presentation."
    },
    {
      "role": "assistant",
      "content": "It's completely normal to feel anxious about presentations. Many people experience this. Have you tried any relaxation techniques that have helped you in the past?"
    },
    {
      "role": "user",
      "content": "I tried deep breathing but it didn't help much."
    }
  ],
  "intervention_index": 1,
  "model": "gpt-4o",
  "provider": "openai"
}
```

| Parameter            | Type     | Description                                                           |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `conversation`       | `array`  | **Required**. Array of messages in the conversation.                  |
| `intervention_index` | `number` | **Required**. Index of the intervention message in the conversation.  |
| `model`              | `string` | The model to use for analysis. Default: "gpt-4o"                      |
| `provider`           | `string` | AI provider to use. Options: "openai", "anthropic". Default: "openai" |

#### Response

```json
{
  "result": {
    "effectiveness_score": 6,
    "user_receptiveness": "medium",
    "emotional_impact": "neutral",
    "key_insights": [
      "User tried the suggested technique but found it ineffective",
      "User is still engaged in the conversation despite the technique not working"
    ],
    "improvement_suggestions": [
      "Suggest alternative relaxation techniques",
      "Explore why deep breathing didn't work for the user"
    ],
    "model": "gpt-4o",
    "processingTime": 1350
  }
}
```

## Usage Statistics

```http
GET /api/ai/stats
```

Retrieves usage statistics for AI services.

#### Query Parameters

| Parameter  | Type     | Description                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| `period`   | `string` | Time period for statistics. Options: "day", "week", "month". Default: "day"  |
| `provider` | `string` | Filter by AI provider. Options: "openai", "anthropic", "all". Default: "all" |

#### Response

```json
{
  "stats": {
    "total_requests": 1250,
    "total_tokens": 2500000,
    "average_response_time": 1100,
    "requests_by_endpoint": {
      "completion": 750,
      "sentiment": 200,
      "crisis_detection": 150,
      "response": 100,
      "intervention_analysis": 50
    },
    "requests_by_provider": {
      "openai": 1000,
      "anthropic": 250
    },
    "requests_by_model": {
      "gpt-4o": 800,
      "gpt-3.5-turbo": 200,
      "claude-3-opus": 150,
      "claude-3-sonnet": 100
    },
    "token_usage_by_provider": {
      "openai": 2000000,
      "anthropic": 500000
    },
    "high_risk_detections": 15
  }
}
```

## Error Handling

All API endpoints use standardized error responses with the following format:

```json
{
  "error": {
    "message": "The AI service is currently unavailable",
    "code": "SERVICE_UNAVAILABLE",
    "statusCode": 503,
    "context": {
      "model": "gpt-4o",
      "provider": "openai"
    }
  }
}
```

### Common Error Codes

| Code                   | Status Code | Description                                                             |
| ---------------------- | ----------- | ----------------------------------------------------------------------- |
| `INVALID_REQUEST`      | 400         | The request was invalid or malformed.                                   |
| `AUTHENTICATION_ERROR` | 401         | Authentication credentials were missing or invalid.                     |
| `PERMISSION_DENIED`    | 403         | The authenticated user does not have permission to access the resource. |
| `RESOURCE_NOT_FOUND`   | 404         | The requested resource was not found.                                   |
| `RATE_LIMIT_EXCEEDED`  | 429         | The rate limit for the API has been exceeded.                           |
| `SERVICE_UNAVAILABLE`  | 503         | The AI service is currently unavailable.                                |
| `PROVIDER_ERROR`       | 502         | The AI provider returned an error.                                      |
| `INVALID_MODEL`        | 400         | The specified model is invalid or not supported.                        |
| `CONTENT_FILTER`       | 400         | The content was filtered by the AI provider's content filter.           |
| `TOKEN_LIMIT_EXCEEDED` | 400         | The token limit for the model has been exceeded.                        |
| `INTERNAL_ERROR`       | 500         | An internal error occurred.                                             |

## Rate Limiting

API endpoints are rate limited to prevent abuse. The rate limits are as follows:

- 60 requests per minute per user
- 1000 requests per day per user

Rate limit headers are included in all API responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1625097600
```

## Authentication

All API endpoints require authentication. See the [Authentication API](/api/auth) for details on how to authenticate requests.

## HIPAA Compliance

All API endpoints are HIPAA compliant and include comprehensive audit logging. See the [Security](/security/hipaa) documentation for details on HIPAA compliance measures.
