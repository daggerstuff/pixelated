# Bias Detection API Documentation

## Overview

The Pixelated Empathy Bias Detection API provides comprehensive bias analysis capabilities for therapeutic AI training scenarios. This RESTful API integrates multiple machine learning toolkits including IBM AIF360, Microsoft Fairlearn, Hugging Face Evaluate, and advanced NLP libraries to detect and analyze various forms of bias in AI-human interactions.

## Base URL

```
Production: https://api.pixelatedempathy.com
Development: http://localhost:3000
```

## Authentication

All API endpoints (except health check) require JWT-based authentication. Include the bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Requirements
- Valid JWT token with appropriate claims
- Token must include `user_id` and `role` fields
- Tokens expire after 24 hours (configurable)
- Role-based access control applied per endpoint

## API Endpoints

### 1. Health Check

Check the service health and availability.

**Endpoint:** `GET /api/bias-detection/health`

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "2.0.0",
  "services": {
    "bias_detection": "operational",
    "ml_toolkit": "operational",
    "database": "operational"
  },
  "uptime": "72:45:30"
}
```

**cURL Example:**
```bash
curl -X GET https://api.pixelatedempathy.com/api/bias-detection/health
```

**JavaScript Example:**
```javascript
const response = await fetch('/api/bias-detection/health');
const healthData = await response.json();
console.log('Service status:', healthData.status);
```

**Python Example:**
```python
import requests

response = requests.get('https://api.pixelatedempathy.com/api/bias-detection/health')
health_data = response.json()
print(f"Service status: {health_data['status']}")
```

---

### 2. Session Analysis

Analyze a training session for bias indicators across multiple layers.

**Endpoint:** `POST /api/bias-detection/analyze`

**Authentication:** Required

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "session_id": "session_12345",
  "participant_demographics": {
    "age": 28,
    "gender": "female",
    "ethnicity": "hispanic",
    "education": "masters",
    "location": "urban"
  },
  "training_scenario": {
    "type": "cognitive_therapy",
    "difficulty": "intermediate",
    "duration_minutes": 45,
    "therapeutic_approach": "CBT"
  },
  "content": {
    "scenario_text": "Patient presents with anxiety symptoms during a therapy session...",
    "prompts": [
      "How are you feeling today?",
      "Can you describe your thoughts about this situation?"
    ]
  },
  "ai_responses": [
    {
      "response": "I understand you're feeling anxious. Let's explore this together.",
      "confidence": 0.85,
      "timestamp": "2024-01-15T10:15:00Z"
    }
  ],
  "expected_outcomes": [
    {
      "metric": "therapeutic_alliance",
      "value": 0.8,
      "target": 0.85
    },
    {
      "metric": "emotional_regulation",
      "value": 0.75,
      "target": 0.8
    }
  ],
  "transcripts": [
    {
      "speaker": "user",
      "text": "I've been feeling very anxious lately",
      "timestamp": "2024-01-15T10:10:00Z"
    },
    {
      "speaker": "ai",
      "text": "I understand. Can you tell me more about when these feelings started?",
      "timestamp": "2024-01-15T10:10:15Z"
    }
  ],
  "metadata": {
    "platform": "web",
    "version": "2.0.0",
    "session_type": "individual",
    "therapist_supervised": true
  }
}
```

**Response:**
```json
{
  "session_id": "session_12345",
  "overall_bias_score": 0.34,
  "confidence": 0.87,
  "alert_level": "medium",
  "analysis_timestamp": "2024-01-15T10:30:00Z",
  "processing_time_ms": 2340,
  "layer_results": [
    {
      "layer": "preprocessing",
      "bias_score": 0.28,
      "confidence": 0.92,
      "weight": 0.25,
      "details": {
        "demographic_representation": {
          "gender_balance": 0.65,
          "ethnic_diversity": 0.72,
          "age_distribution": 0.58
        },
        "data_quality": {
          "completeness": 0.95,
          "consistency": 0.88
        }
      },
      "issues_detected": ["minor_demographic_underrepresentation"],
      "recommendations": ["Increase diversity in training scenarios"]
    },
    {
      "layer": "model_level",
      "bias_score": 0.41,
      "confidence": 0.84,
      "weight": 0.30,
      "details": {
        "fairness_metrics": {
          "demographic_parity": 0.12,
          "equalized_odds": 0.08,
          "treatment_equality": 0.15
        },
        "algorithmic_bias": {
          "gender_bias": 0.23,
          "cultural_bias": 0.18
        }
      },
      "issues_detected": ["gender_bias_detected", "cultural_sensitivity"],
      "recommendations": ["Implement bias mitigation techniques", "Cultural competency training data"]
    },
    {
      "layer": "interactive",
      "bias_score": 0.31,
      "confidence": 0.79,
      "weight": 0.20,
      "details": {
        "response_patterns": {
          "empathy_consistency": 0.82,
          "tone_appropriateness": 0.76,
          "cultural_sensitivity": 0.68
        },
        "linguistic_analysis": {
          "biased_terms_count": 2,
          "sentiment_variance": 0.15,
          "inclusivity_score": 0.74
        }
      },
      "issues_detected": ["inconsistent_cultural_responses"],
      "recommendations": ["Improve cultural context awareness", "Standardize empathy expressions"]
    },
    {
      "layer": "evaluation",
      "bias_score": 0.36,
      "confidence": 0.91,
      "weight": 0.25,
      "details": {
        "outcome_fairness": {
          "success_rate_parity": 0.13,
          "satisfaction_disparity": 0.09
        },
        "interpretability": {
          "feature_importance_bias": 0.22,
          "decision_transparency": 0.85
        }
      },
      "issues_detected": ["outcome_disparity"],
      "recommendations": ["Monitor success rates across demographics", "Implement fairness constraints"]
    }
  ],
  "recommendations": [
    "Implement demographic parity constraints in model training",
    "Increase cultural competency in training datasets",
    "Monitor therapeutic outcomes across different demographic groups",
    "Implement bias mitigation techniques in the preprocessing pipeline",
    "Conduct regular fairness audits of model decisions"
  ],
  "compliance": {
    "hipaa_compliant": true,
    "audit_logged": true,
    "data_encrypted": true,
    "anonymization_applied": true
  }
}
```

**cURL Example:**
```bash
curl -X POST https://api.pixelatedempathy.com/api/bias-detection/analyze \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session_12345",
    "participant_demographics": {
      "age": 28,
      "gender": "female",
      "ethnicity": "hispanic",
      "education": "masters"
    },
    "training_scenario": {
      "type": "cognitive_therapy",
      "difficulty": "intermediate",
      "duration_minutes": 45
    },
    "content": {
      "scenario_text": "Patient presents with anxiety symptoms...",
      "prompts": ["How are you feeling today?"]
    },
    "ai_responses": [{
      "response": "I understand your feelings",
      "confidence": 0.85
    }],
    "expected_outcomes": [],
    "transcripts": [],
    "metadata": {
      "platform": "web",
      "version": "2.0.0"
    }
  }'
```

**JavaScript Example:**
```javascript
const analyzeSession = async (sessionData) => {
  try {
    const response = await fetch('/api/bias-detection/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`Bias Score: ${result.overall_bias_score}`);
    console.log(`Alert Level: ${result.alert_level}`);
    
    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
};

// Usage
const sessionData = {
  session_id: "session_12345",
  participant_demographics: {
    age: 28,
    gender: "female",
    ethnicity: "hispanic"
  },
  // ... rest of session data
};

const analysisResult = await analyzeSession(sessionData);
```

**Python Example:**
```python
import requests
import json

def analyze_session(session_data, token):
    url = "https://api.pixelatedempathy.com/api/bias-detection/analyze"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, headers=headers, json=session_data)
        response.raise_for_status()
        
        result = response.json()
        
        print(f"Bias Score: {result['overall_bias_score']}")
        print(f"Alert Level: {result['alert_level']}")
        
        # Process layer results
        for layer in result['layer_results']:
            print(f"{layer['layer']}: {layer['bias_score']}")
        
        return result
        
    except requests.exceptions.RequestException as e:
        print(f"Analysis error: {e}")
        raise

# Usage
session_data = {
    "session_id": "session_12345",
    "participant_demographics": {
        "age": 28,
        "gender": "female",
        "ethnicity": "hispanic"
    },
    # ... rest of session data
}

result = analyze_session(session_data, "your-jwt-token")
```

---

### 3. Dashboard Data

Retrieve aggregated bias detection data for dashboard visualization.

**Endpoint:** `GET /api/bias-detection/dashboard`

**Authentication:** Required

**Query Parameters:**
- `start_date` (optional): Start date for data range (YYYY-MM-DD)
- `end_date` (optional): End date for data range (YYYY-MM-DD)
- `group_by` (optional): Grouping period [hour, day, week, month] (default: day)
- `demographics` (optional): Filter by demographics (comma-separated)

**Response:**
```json
{
  "summary": {
    "total_sessions": 1247,
    "average_bias_score": 0.32,
    "high_risk_sessions": 89,
    "critical_alerts": 12,
    "improvement_trend": 0.15
  },
  "trends": [
    {
      "date": "2024-01-15",
      "sessions_analyzed": 45,
      "average_bias_score": 0.31,
      "alert_distribution": {
        "low": 28,
        "medium": 14,
        "high": 3,
        "critical": 0
      }
    }
  ],
  "demographics": {
    "gender": {
      "male": { "sessions": 567, "avg_bias": 0.29 },
      "female": { "sessions": 612, "avg_bias": 0.34 },
      "non_binary": { "sessions": 68, "avg_bias": 0.31 }
    },
    "ethnicity": {
      "caucasian": { "sessions": 489, "avg_bias": 0.28 },
      "hispanic": { "sessions": 312, "avg_bias": 0.35 },
      "african_american": { "sessions": 267, "avg_bias": 0.37 },
      "asian": { "sessions": 179, "avg_bias": 0.30 }
    }
  },
  "alerts": [
    {
      "id": "alert_789",
      "session_id": "session_12340",
      "level": "high",
      "bias_score": 0.72,
      "timestamp": "2024-01-15T09:45:00Z",
      "primary_issues": ["gender_bias", "cultural_insensitivity"],
      "status": "pending"
    }
  ],
  "top_recommendations": [
    {
      "category": "training_data",
      "priority": "high",
      "description": "Increase demographic diversity in therapy scenarios",
      "frequency": 23
    }
  ]
}
```

**cURL Example:**
```bash
curl -X GET "https://api.pixelatedempathy.com/api/bias-detection/dashboard?start_date=2024-01-01&end_date=2024-01-31&group_by=day" \
  -H "Authorization: Bearer your-jwt-token"
```

**JavaScript Example:**
```javascript
const getDashboardData = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.startDate) params.append('start_date', filters.startDate);
  if (filters.endDate) params.append('end_date', filters.endDate);
  if (filters.groupBy) params.append('group_by', filters.groupBy);
  
  const url = `/api/bias-detection/dashboard?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Usage
const dashboardData = await getDashboardData({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  groupBy: 'day'
});
```

---

### 4. Data Export

Export bias detection data in various formats for analysis and reporting.

**Endpoint:** `POST /api/bias-detection/export`

**Authentication:** Required

**Request Body:**
```json
{
  "format": "json",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "data_types": ["summary", "sessions", "alerts", "trends"],
  "include_demographics": true,
  "include_recommendations": true,
  "anonymize_data": true,
  "compression": "gzip"
}
```

**Supported Formats:**
- `json`: JSON format
- `csv`: Comma-separated values
- `pdf`: PDF report with charts and analysis

**Response:**
```json
{
  "export_id": "export_456",
  "status": "processing",
  "estimated_completion": "2024-01-15T10:35:00Z",
  "download_url": null,
  "file_size_bytes": null,
  "expires_at": "2024-01-22T10:30:00Z"
}
```

**Progress Check:**
```bash
curl -X GET "https://api.pixelatedempathy.com/api/bias-detection/export/export_456/status" \
  -H "Authorization: Bearer your-jwt-token"
```

**cURL Example:**
```bash
curl -X POST https://api.pixelatedempathy.com/api/bias-detection/export \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "data_types": ["summary", "alerts"],
    "anonymize_data": true
  }'
```

## Error Handling

### Standard Error Response

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: session_id",
    "details": {
      "field": "session_id",
      "received": null,
      "expected": "string"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_12345"
  }
}
```

### HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid request data, missing required fields |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for requested operation |
| 404 | Not Found | Requested resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side processing error |
| 503 | Service Unavailable | ML toolkit temporarily unavailable |

### Error Codes

#### Authentication Errors
- `INVALID_TOKEN`: JWT token is malformed or expired
- `MISSING_TOKEN`: Authorization header not provided
- `INSUFFICIENT_PERMISSIONS`: User lacks required role/permissions

#### Validation Errors
- `INVALID_REQUEST`: Request body validation failed
- `MISSING_REQUIRED_FIELD`: Required field not provided
- `INVALID_FIELD_TYPE`: Field has incorrect data type
- `INVALID_FIELD_VALUE`: Field value outside acceptable range

#### Processing Errors
- `ANALYSIS_FAILED`: Bias analysis processing failed
- `ML_TOOLKIT_ERROR`: Machine learning toolkit encountered an error
- `TIMEOUT_ERROR`: Request processing exceeded time limit
- `RESOURCE_LIMIT_EXCEEDED`: Request size or complexity too large

#### System Errors
- `SERVICE_UNAVAILABLE`: Backend service temporarily unavailable
- `DATABASE_ERROR`: Database connection or query failed
- `ENCRYPTION_ERROR`: Data encryption/decryption failed

### Error Handling Examples

**JavaScript:**
```javascript
try {
  const result = await fetch('/api/bias-detection/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sessionData)
  });

  if (!result.ok) {
    const error = await result.json();
    
    switch (error.error.code) {
      case 'INVALID_TOKEN':
        // Redirect to login
        window.location.href = '/login';
        break;
      case 'INVALID_REQUEST':
        // Show validation errors
        showValidationErrors(error.error.details);
        break;
      case 'ANALYSIS_FAILED':
        // Show retry option
        showRetryDialog();
        break;
      default:
        // Show generic error
        showError(error.error.message);
    }
    
    throw new Error(error.error.message);
  }

  return await result.json();
} catch (error) {
  console.error('API call failed:', error);
  throw error;
}
```

**Python:**
```python
import requests
from requests.exceptions import RequestException

def handle_api_error(response):
    """Handle API error responses"""
    if response.status_code == 401:
        raise AuthenticationError("Invalid or expired token")
    elif response.status_code == 400:
        error_data = response.json()
        raise ValidationError(error_data['error']['message'])
    elif response.status_code >= 500:
        raise ServiceError("Server error occurred")
    else:
        response.raise_for_status()

def analyze_session_with_retry(session_data, token, max_retries=3):
    """Analyze session with retry logic"""
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://api.pixelatedempathy.com/api/bias-detection/analyze",
                headers={"Authorization": f"Bearer {token}"},
                json=session_data,
                timeout=30
            )
            
            handle_api_error(response)
            return response.json()
            
        except (RequestException, ServiceError) as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

## Rate Limiting

### Limits

| Endpoint | Authenticated | Anonymous |
|----------|---------------|-----------|
| `/health` | 300/min | 60/min |
| `/analyze` | 60/min | N/A |
| `/dashboard` | 120/min | N/A |
| `/export` | 10/min | N/A |

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642244400
X-RateLimit-Retry-After: 300
```

## Data Privacy and Compliance

### HIPAA Compliance

- All session data is encrypted in transit and at rest
- Personal identifiers are hashed using secure algorithms
- Audit logs are maintained for all data access
- Data retention policies automatically applied

### Data Anonymization

When `anonymize_data: true` is specified:
- Session IDs are hashed
- Demographic data is generalized
- Sensitive text content is redacted
- Only statistical aggregates are included

### Encryption

- TLS 1.3 for data in transit
- AES-256 encryption for data at rest
- JWT tokens signed with RS256
- Secure key rotation policies

## SDK and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @pixelated-empathy/bias-detection-sdk
```

```javascript
import { BiasDetectionClient } from '@pixelated-empathy/bias-detection-sdk';

const client = new BiasDetectionClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.pixelatedempathy.com'
});

const result = await client.analyzeSession(sessionData);
```

### Python SDK

```bash
pip install pixelated-empathy-bias-detection
```

```python
from pixelated_empathy import BiasDetectionClient

client = BiasDetectionClient(
    api_key="your-api-key",
    base_url="https://api.pixelatedempathy.com"
)

result = client.analyze_session(session_data)
```

## Changelog

### Version 2.0.0 (Current)
- Added multi-layer bias analysis
- Integrated advanced ML toolkits (AIF360, Fairlearn)
- Enhanced HIPAA compliance features
- Improved cultural bias detection
- Real-time dashboard capabilities

### Version 1.2.0
- Added linguistic bias detection
- Implemented data export functionality
- Enhanced error handling and validation
- Added rate limiting

### Version 1.1.0
- Initial demographic bias detection
- Basic session analysis
- Authentication and authorization
- Health check endpoint

## Support

### Documentation
- [Tutorial Guide](./getting-started.md)
- [SDK Documentation](./sdk-docs.md)
- [Best Practices](./best-practices.md)

### Contact
- Email: api-support@pixelatedempathy.com
- Documentation: https://docs.pixelatedempathy.com
- Status Page: https://status.pixelatedempathy.com

### Community
- GitHub: https://github.com/pixelated-empathy/bias-detection
- Discord: https://discord.gg/pixelated-empathy
- Stack Overflow: Tag `pixelated-empathy` 