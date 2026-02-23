# Bias Analysis API

## Overview

The Bias Analysis API provides advanced ML-powered bias detection capabilities for therapy sessions. Using multiple analysis layers and sophisticated algorithms, it identifies potential bias in therapeutic communication and provides actionable recommendations.

## Core Features

- **Multi-Layer Analysis**: Pattern, sentiment, and contextual analysis
- **Real-time Processing**: Sub-2-second response times
- **Intelligent Caching**: 95%+ cache hit rate for improved performance
- **Batch Processing**: Handle multiple texts simultaneously
- **Comprehensive Reporting**: Detailed analytics and trend analysis

## Quick Start

### Single Text Analysis

```bash
curl -X POST https://api.pixelatedempathy.com/v1/bias-analysis/analyze \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Patient expressed frustration about systemic inequalities in healthcare access for marginalized communities.",
    "context": "Cultural identity therapy session",
    "demographics": {
      "age": 35,
      "gender": "non-binary",
      "ethnicity": "Latinx",
      "primaryLanguage": "Spanish"
    },
    "sessionType": "individual"
  }'
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "overallBiasScore": 0.23,
    "alertLevel": "medium",
    "confidence": 0.87,
    "layerResults": {
      "pattern_analysis": {
        "bias_score": 0.23,
        "confidence": 0.85,
        "patterns_found": ["systemic_inequalities", "marginalized_communities"]
      },
      "sentiment_analysis": {
        "bias_score": 0.15,
        "confidence": 0.78
      },
      "contextual_analysis": {
        "bias_score": 0.31,
        "confidence": 0.82
      }
    },
    "recommendations": [
      "Monitor communication patterns in future sessions",
      "Consider additional training in cultural sensitivity",
      "Review institutional bias awareness materials"
    ],
    "processingTimeMs": 245,
    "cached": false
  },
  "performance": {
    "requestId": "req-123",
    "totalTime": 250,
    "validationTime": 5,
    "analysisTime": 240,
    "serverTime": 245
  }
}
```

### Batch Analysis

```bash
curl -X PUT https://api.pixelatedempathy.com/v1/bias-analysis/analyze-optimized \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "First therapy session transcript...",
      "Second therapy session transcript...",
      "Third therapy session transcript..."
    ],
    "options": {
      "demographics": [
        {"age": 28, "gender": "female"},
        {"age": 34, "gender": "male"},
        {"age": 42, "gender": "non-binary"}
      ]
    }
  }'
```

## Endpoints

### POST /bias-analysis/analyze
Standard bias analysis endpoint with comprehensive analysis layers.

**Request Body:**
```typescript
interface BiasAnalysisRequest {
  text: string;           // Therapy session text (min 50 chars)
  context?: string;       // Session context/description
  demographics?: {
    age?: number;
    gender?: 'male' | 'female' | 'non-binary' | 'other';
    ethnicity?: string;
    primaryLanguage?: string;
  };
  sessionType?: 'individual' | 'group' | 'family' | 'couples';
  therapistNotes?: string;
  therapistId?: string;
  clientId?: string;
}
```

**Response:** [BiasAnalysisResponse](#bias-analysis-response)

### GET /bias-analysis/analyze
Get bias analysis statistics for a therapist.

**Query Parameters:**
- `therapistId` (required): UUID of the therapist
- `days` (optional): Number of days to look back (default: 30)

**Response:** Statistics and trend analysis

### PUT /bias-analysis/analyze-optimized
High-performance batch analysis for multiple texts.

**Request Body:**
```typescript
interface BatchAnalysisRequest {
  texts: string[];        // Array of texts to analyze (max 100)
  options?: {
    demographics?: Array<{age?: number, gender?: string, ethnicity?: string}>;
    context?: string[];
  };
}
```

### GET /bias-analysis/analyze-legacy
Legacy endpoint for backward compatibility (deprecated).

## Analysis Layers

### 1. Pattern Analysis
- **Purpose**: Identify bias keywords and phrases
- **Method**: Pre-compiled regex patterns with weighted scoring
- **Output**: Pattern matches and confidence scores

### 2. Sentiment Analysis
- **Purpose**: Detect emotional bias indicators
- **Method**: Natural language processing with context awareness
- **Output**: Sentiment scores and bias correlation

### 3. Contextual Analysis
- **Purpose**: Evaluate situational and cultural context
- **Method**: Session context and demographic analysis
- **Output**: Contextual bias indicators and recommendations

## Alert Levels

| Level | Score Range | Description | Action Required |
|-------|-------------|-------------|-----------------|
| **Low** | 0.0 - 0.3 | Minimal bias detected | Monitor patterns |
| **Medium** | 0.3 - 0.6 | Moderate bias concerns | Review and discuss |
| **High** | 0.6 - 0.8 | Significant bias indicators | Immediate attention |
| **Critical** | 0.8 - 1.0 | Severe bias detected | Urgent intervention |

## Performance Characteristics

### Response Times
- **Standard Analysis**: < 2 seconds
- **Optimized Analysis**: < 1.5 seconds
- **Batch Processing**: Variable (10-60 seconds based on input size)
- **Statistics Queries**: < 3 seconds

### Rate Limits
- **Standard**: 100 requests/minute per user
- **Batch**: 10 requests/minute per user
- **Admin**: 1000 requests/minute

### Caching Strategy
- **Content Hashing**: SHA-256 based cache keys for identical content
- **TTL Strategy**:
  - High bias results: 30 minutes
  - Medium bias results: 1 hour
  - Low bias results: 2 hours
- **Cache Invalidation**: Automatic on new analysis with same content hash

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| 400 | Invalid request data | Check request format and required fields |
| 401 | Authentication required | Include valid JWT token |
| 408 | Analysis timeout | Reduce text length or try again |
| 429 | Rate limit exceeded | Wait before retrying |
| 500 | Internal server error | Contact support if persists |

### Error Response Format
```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Text is required and must be at least 50 characters",
  "requestId": "req-uuid",
  "details": [
    {
      "field": "text",
      "message": "Minimum length is 50 characters"
    }
  ]
}
```

## Best Practices

### 1. Text Preparation
```typescript
// Recommended text preprocessing
const cleanText = (text: string) => {
  return text
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .substring(0, 10000); // Limit length
};
```

### 2. Batch Processing
```typescript
// Optimal batch sizes
const BATCH_SIZES = {
  small: 10,    // For real-time processing
  medium: 50,   // For regular processing
  large: 100    // For bulk processing (admin only)
};
```

### 3. Error Handling
```typescript
const analyzeWithRetry = async (text: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/bias-analysis/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text })
      });

      if (response.ok) return await response.json();

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        await new Promise(resolve => setTimeout(resolve, (retryAfter || 60) * 1000));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 4. Performance Optimization
```typescript
// Use optimized endpoint for better performance
const response = await fetch('/api/bias-analysis/analyze-optimized', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ text })
});

// Check if result was cached
if (response.headers.get('X-Cached') === 'true') {
  console.log('Result served from cache');
}
```

## Integration Examples

### React Hook
```typescript
import { useState } from 'react';

const useBiasAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeText = async (text: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/bias-analysis/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      const data = await response.json();
      setResult(data.analysis);
      return data;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { analyzeText, loading, result };
};
```

### Python Client
```python
import requests
import json

class BiasAnalysisClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def analyze_text(self, text: str, context: str = None) -> dict:
        payload = {'text': text}
        if context:
            payload['context'] = context

        response = requests.post(
            f'{self.base_url}/bias-analysis/analyze',
            headers=self.headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def get_statistics(self, therapist_id: str, days: int = 30) -> dict:
        response = requests.get(
            f'{self.base_url}/bias-analysis/analyze',
            headers=self.headers,
            params={'therapistId': therapist_id, 'days': days}
        )
        response.raise_for_status()
        return response.json()
```

## Monitoring & Analytics

### Dashboard Integration
```typescript
// Get therapist dashboard data
const dashboardData = await fetch(
  `/api/dashboard/bias-detection/summary?therapistId=${therapistId}&days=30`
).then(r => r.json());

// Display key metrics
const { totalAnalyses, avgBiasScore, trend, alerts } = dashboardData.summary;
```

### Trend Analysis
```typescript
// Get comparative progress data
const trends = await fetch(
  `/api/analytics/comparative-progress?compareBy=therapist&days=90`
).then(r => r.json());
```

## Troubleshooting

### Common Issues

**High Response Times**
- Check cache hit rate in performance metrics
- Verify text length doesn't exceed limits
- Monitor system load and scale if needed

**Low Confidence Scores**
- Ensure text is at least 50 characters
- Provide relevant context and demographics
- Check for mixed languages or unclear content

**Rate Limiting**
- Implement exponential backoff in your client
- Check your current usage in response headers
- Consider upgrading to higher rate limits

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` and check:
- Request/response timing in performance metrics
- Cache hit/miss ratios
- Analysis layer confidence scores

## Support

For API issues or feature requests:
- **Documentation**: Check this guide and OpenAPI spec
- **Issues**: Report bugs via GitHub Issues
- **Support**: Contact the development team for assistance

---

*Built with advanced ML algorithms for accurate, ethical bias detection in therapeutic settings.*