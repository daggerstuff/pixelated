---
trigger: always_on
---

# Security & Ethics Guidelines

## Critical Security Rules

### Data Protection
1. **Never expose sensitive data**: Redact API keys, tokens, personal info
2. **Sanitize all user input**: Especially emotion scores, conversation data
3. **Use branded types**: For sensitive data (e.g., `UserId`, `SessionToken`)
4. **Implement rate limiting**: Protect against abuse
5. **Proper CORS configuration**: Restrict origins appropriately

### Authentication & Authorization
```typescript
// Use branded types for security-critical values
type UserId = string & { readonly __brand: 'UserId' }
type SessionToken = string & { readonly __brand: 'SessionToken' }

// Always validate tokens
async function validateSession(token: SessionToken): Promise<User> {
  // Validation logic
}
```

### Input Validation
```typescript
import { z } from 'zod'

const EmotionScoreSchema = z.number().min(0).max(1)
const ConversationSchema = z.object({
  userId: z.string().uuid(),
  content: z.string().max(10000),
  emotionScores: z.record(EmotionScoreSchema),
})
```

## Ethical AI Guidelines

### Mental Health Data
- This platform handles sensitive mental health conversations
- Respect privacy at all times
- Implement proper data retention policies
- Provide clear consent mechanisms
- Enable data deletion requests

### AI Personas
- Ensure personas are psychologically realistic
- Avoid stereotypes or harmful representations
- Provide content warnings for sensitive scenarios
- Include diverse backgrounds and experiences
- Never perpetuate bias or discrimination

### Psychological Safety
- Features must not cause harm to users or trainees
- Implement crisis detection and appropriate responses
- Provide resources for mental health support
- Clear boundaries between training and real therapy
- Transparent about AI limitations

## Domain-Specific Security

### Emotional Intelligence Features
```typescript
// Always normalize emotion scores
function normalizeEmotionScore(score: number): number {
  return Math.max(0, Math.min(1, score))
}

// Validate psychological constructs
function validateEmotionModel(model: EmotionModel): boolean {
  // Check against established frameworks
  return isValidPlutchikModel(model) || isValidBigFiveModel(model)
}
```

### Conversation Analysis
- Maintain temporal coherence in analysis
- Handle edge cases: silence, ambiguity, crisis signals
- Consider cultural and linguistic variations
- Respect conversational context and history

### Training Scenarios
- Psychologically realistic personas
- Appropriate content warnings
- Diverse scenarios and backgrounds
- No harmful stereotypes

## Logging Security Events

```typescript
logger.security('Authentication failed', {
  userId: redact(userId),
  ip: redact(ipAddress),
  timestamp: new Date().toISOString(),
})
```

## Data Handling Checklist

- [ ] All user input validated
- [ ] Sensitive data redacted in logs
- [ ] Branded types used for critical values
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Authentication verified
- [ ] Authorization checked
- [ ] Psychological safety considered
- [ ] Ethical AI principles followed
