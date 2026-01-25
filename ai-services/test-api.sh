#!/bin/bash
# Test all Therapeutic AI API endpoints

API_URL="http://localhost:5000"

echo "🧪 Testing Pixelated Empathy Therapeutic AI API"
echo "================================================"
echo ""

# 1. Health check
echo "1️⃣ Health Check"
curl -s "$API_URL/health" | python -m json.tool
echo ""
echo ""

# 2. PII Scrubbing
echo "2️⃣ PII Scrubbing"
curl -s -X POST "$API_URL/api/security/scrub-pii" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Contact Dr. John Smith at john@example.com or (555) 010-9988"
  }' | python -m json.tool
echo ""
echo ""

# 3. Crisis Detection
echo "3️⃣ Crisis Detection"
curl -s -X POST "$API_URL/api/security/detect-crisis" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I am feeling hopeless and want to end it all"
  }' | python -m json.tool
echo ""
echo ""

# 4. Emotion Validation
echo "4️⃣ Emotion Validation"
curl -s -X POST "$API_URL/api/emotion/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test123",
    "detected_emotion": "happy",
    "confidence": 0.8,
    "context": "positive success",
    "response_text": "I feel really proud of myself today.",
    "participant_demographics": {
      "age": "26-35",
      "gender": "female",
      "ethnicity": "other",
      "primary_language": "en"
    }
  }' | python -m json.tool
echo ""
echo ""

# 5. Bias Analysis
echo "5️⃣ Bias Analysis"
curl -s -X POST "$API_URL/api/bias/analyze-session" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test123",
    "session_date": "2026-01-24",
    "participant_demographics": {
      "age": "26-35",
      "gender": "female",
      "ethnicity": "asian",
      "primary_language": "en"
    },
    "scenario": {
      "scenario_id": "wellness-001",
      "type": "general-wellness"
    },
    "content": {
      "transcript": "The patient seems very emotional about this situation.",
      "ai_responses": ["I understand you are feeling sensitive about this."],
      "user_inputs": ["I am feeling overwhelmed."]
    }
  }' | python -m json.tool
echo ""
echo ""

echo "✅ All tests complete!"
