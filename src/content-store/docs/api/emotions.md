---
title: "Emotion Analysis API Documentation"
description: "Emotion Analysis API Documentation documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Emotion Analysis API Documentation

## Overview

The Emotion Analysis API provides endpoints for analyzing emotions expressed in text, speech, and other signals. It uses advanced machine learning techniques to identify emotions, sentiment, and other affective aspects of communication.

## Available Endpoints

- [Analyze Text Emotions](#analyze-text-emotions) - `POST /api/emotions/analyze`
- [Analyze Speech Emotions](#analyze-speech-emotions) - `POST /api/emotions/speech`
- [Get Multidimensional Map](#get-multidimensional-map) - `GET /api/emotions/multidimensional-map`
- [Real-Time Analysis](#real-time-analysis) - `POST /api/emotions/real-time-analysis`

---

## Analyze Text Emotions

Analyzes text to detect emotions and sentiment.

**URL:** `/api/emotions/analyze`

**Method:** `POST`

**Authentication Required:** Yes (API key or user token)

### Request Body

```json
{
  "text": "I'm excited about the progress we've made!",
  "userId": "user-123",
  "includeRiskFactors": true,
  "includeContextualFactors": true
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The text to analyze |
| `userId` | string | No | User identifier for personalization |
| `includeRiskFactors` | boolean | No | Whether to include risk factors in the analysis |
| `includeContextualFactors` | boolean | No | Whether to include contextual factors |

### Response Body

```json
{
  "success": true,
  "analysis": {
    "id": "emo_12345",
    "userId": "user-123",
    "timestamp": "2025-03-20T14:30:00.000Z",
    "source": "text",
    "emotions": [
      {
        "type": "excitement",
        "confidence": 0.85,
        "intensity": 0.7
      },
      {
        "type": "happiness",
        "confidence": 0.75,
        "intensity": 0.6
      }
    ],
    "dimensions": {
      "valence": 0.8,
      "arousal": 0.7,
      "dominance": 0.6
    }
  }
}
```

---

## Analyze Speech Emotions

Analyzes audio data to detect emotions from voice patterns.

**URL:** `/api/emotions/speech`

**Method:** `POST`

**Content-Type:** `multipart/form-data`

**Authentication Required:** Yes (API key or user token)

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audio` | File | Yes | Audio file (WAV or MP3, max 5MB) |
| `userId` | string | No | User identifier for personalization |
| `transcript` | string | No | Optional transcript for enhanced accuracy |

### Response Body

```json
{
  "success": true,
  "analysis": {
    "id": "emo_12346",
    "userId": "user-123",
    "timestamp": "2025-03-20T14:35:00.000Z",
    "source": "voice",
    "emotions": [
      {
        "type": "excitement",
        "confidence": 0.7,
        "intensity": 0.6
      },
      {
        "type": "nervousness",
        "confidence": 0.6,
        "intensity": 0.4
      }
    ],
    "dimensions": {
      "valence": 0.6,
      "arousal": 0.8,
      "dominance": 0.4
    }
  }
}
```

---

## Get Multidimensional Map

Gets emotion analyses mapped to the PAD (Pleasure-Arousal-Dominance) model dimensions.

**URL:** `/api/emotions/multidimensional-map`

**Method:** `GET`

**Authentication Required:** Yes (API key or user token)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The session ID to retrieve data for |
| `timeframe` | string | No | Timeframe for data (e.g., 'last_hour', 'last_day', 'all') |

### Response Body

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-03-20T14:30:00.000Z",
      "dimensions": {
        "valence": 0.8,
        "arousal": 0.7,
        "dominance": 0.6
      },
      "emotionCount": 3,
      "primaryEmotion": "excitement"
    },
    // ... additional data points
  ]
}
```

---

## Real-Time Analysis

Analyzes text in real-time with optimized performance for interactive applications.

**URL:** `/api/emotions/real-time-analysis`

**Method:** `POST`

**Authentication Required:** Optional (allows anonymous requests with rate limiting)

### Request Body

```json
{
  "text": "I'm feeling excited about this new feature!",
  "userId": "user-123",
  "context": {
    "situation": "product_demo",
    "previousSentiment": "neutral"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The text to analyze (max 5000 characters) |
| `userId` | string | No | User identifier for personalization (defaults to 'anonymous') |
| `context` | object | No | Additional context to improve analysis accuracy |

### Response Body

```json
{
  "success": true,
  "analysis": {
    "id": "emotion_12347",
    "userId": "user-123",
    "timestamp": "2025-03-22T15:30:00.000Z",
    "source": "text",
    "emotions": [
      {
        "type": "excitement",
        "confidence": 0.90,
        "intensity": 0.85
      },
      {
        "type": "happiness",
        "confidence": 0.82,
        "intensity": 0.75
      }
    ],
    "dimensions": {
      "valence": 0.87,
      "arousal": 0.80,
      "dominance": 0.72
    }
  },
  "processingTimeMs": 78
}
```

### Key Differences from Standard Analysis

The real-time analysis endpoint is optimized for:

1. **Speed** - Priority processing with an optimized response time
2. **Interactive Use** - Meant for UI applications needing immediate feedback
3. **Reduced Authentication Requirements** - Can be used anonymously (with rate limiting)
4. **Simplified Output** - Streamlined results focused on core emotion data
5. **Performance Metrics** - Includes processing time information

### Error Responses

```json
{
  "error": "Failed to process emotion analysis",
  "message": "Error message details"
}
```

**Common Error Codes:**

- `400 Bad Request`: Invalid request parameters
- `405 Method Not Allowed`: Wrong HTTP method 
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side processing error

---

## Models and Algorithms

The Emotion Analysis API uses a combination of models:

- **Text Analysis**: Fine-tuned emotion recognition models based on transformer architecture
- **Speech Analysis**: Acoustic feature extraction combined with deep learning models
- **PAD Model**: Maps emotions to the Pleasure-Arousal-Dominance dimensional model
- **Contextual Analysis**: Identifies situational factors affecting emotion recognition

## Rate Limits

- Standard API: 60 requests per minute
- Real-time API: 120 requests per minute for authenticated users, 20 per minute for anonymous users

## Security Considerations

- All API requests should be made over HTTPS
- API keys should be kept secure and not exposed in client-side code
- Consider using the server-to-server API for sensitive communications
- Data is temporarily cached for performance but not permanently stored without consent 