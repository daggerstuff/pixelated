---
inclusion: fileMatch
fileMatchPattern: '**/ai/**/*.{ts,js,py}'
---

# AI Safety Guidelines

## Critical for Mental Health AI

This platform handles sensitive mental health data and trains professionals for crisis intervention. Every AI feature must prioritize psychological safety.

## Safety Checklist

- [ ] No harmful content generation
- [ ] No bias or discrimination
- [ ] Privacy protection implemented
- [ ] No misinformation
- [ ] No dangerous behavior encouragement

## Prompt Safety

### Input Validation
```typescript
function sanitizePrompt(input: string): string {
  // Remove script tags and dangerous content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
}
```

### Prevent Prompt Injection
```typescript
// ❌ Vulnerable
const prompt = `Translate: ${userInput}`

// ✅ Secure
const sanitized = sanitizeInput(userInput)
const prompt = `Translate: ${sanitized}`
```

## Bias Mitigation

### Inclusive Language
```typescript
// ❌ Biased
"Write about a doctor. He should be experienced."

// ✅ Inclusive
"Write about a healthcare professional with diverse background."
```

### Testing for Bias
- Test with diverse scenarios
- Include multiple perspectives
- Monitor for stereotypes
- Regular bias audits

## AI Persona Guidelines

### Psychological Realism
- Base on established psychological frameworks
- Avoid harmful stereotypes
- Include diverse backgrounds
- Provide content warnings

### Crisis Handling
```typescript
function detectCrisisSignals(text: string): boolean {
  const crisisKeywords = ['suicide', 'self-harm', 'end it all']
  // Implement sophisticated detection
  return hasUrgentCrisisIndicators(text)
}
```

## Emotional Intelligence

### Emotion Score Validation
```typescript
function normalizeEmotionScore(score: number): number {
  // Must be 0-1 range
  return Math.max(0, Math.min(1, score))
}

function validateEmotionModel(model: EmotionModel): boolean {
  // Check against Plutchik's wheel or Big Five
  return isValidPsychologicalFramework(model)
}
```

## Data Privacy

- Never echo sensitive data
- Redact personal information
- Use placeholder text
- Implement data filtering

```typescript
// ❌ Data leakage
AI: "I understand your password is secret123..."

// ✅ Secure
AI: "I understand you've shared sensitive info. Here are security tips..."
```

## Monitoring

- Track safety incidents
- Log bias detection events
- Monitor crisis signals
- Regular safety audits
