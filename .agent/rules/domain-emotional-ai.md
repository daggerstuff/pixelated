---
trigger: model_decision
description: This platform analyzes emotional intelligence in conversations for mental health training.
---

# Emotional AI Domain Guidelines

## Core Principles

This platform analyzes emotional intelligence in conversations for mental health training. Every feature must prioritize:

1. **Psychological Safety**: Never cause harm to users or trainees
2. **Scientific Validity**: Use established psychological frameworks
3. **Privacy Protection**: Handle sensitive mental health data securely
4. **Ethical AI**: Avoid bias and harmful stereotypes

## Emotional Intelligence Features

### Emotion Score Normalization

```typescript
// Always normalize emotion scores to 0-1 range
function normalizeEmotionScore(score: number): number {
  return Math.max(0, Math.min(1, score))
}

// Validate against established frameworks
type EmotionFramework = 'plutchik' | 'bigfive' | 'panas'

interface EmotionScore {
  value: number // 0-1 range
  framework: EmotionFramework
  confidence: number // 0-1 range
  timestamp: Date
}
```

### Psychological Constructs

- Use established frameworks: Plutchik's wheel, Big Five, PANAS
- Document assumptions about emotional models
- Validate constructs against research
- Include confidence scores for AI predictions

## Conversation Analysis

### Context Handling

```typescript
interface ConversationContext {
  history: Message[]
  emotionalState: EmotionScore[]
  therapeuticGoals: string[]
  riskFactors: RiskAssessment
}

// Always maintain temporal coherence
function analyzeConversation(context: ConversationContext) {
  // Respect conversational history
  // Handle silence and ambiguity
  // Detect crisis signals
  // Consider cultural variations
}
```

### Edge Cases to Handle

- Silence or minimal responses
- Ambiguous emotional expressions
- Crisis signals (self-harm, suicide ideation)
- Cultural and linguistic variations
- Therapeutic boundaries

## AI Persona Development

### Psychological Realism

```typescript
interface AIPersona {
  background: PersonaBackground
  emotionalProfile: EmotionProfile
  communicationStyle: CommunicationStyle
  therapeuticNeeds: TherapeuticNeed[]
  contentWarnings: string[]
}

// Ensure diversity and avoid stereotypes
function createPersona(params: PersonaParams): AIPersona {
  // Include diverse backgrounds
  // Avoid harmful stereotypes
  // Provide content warnings
  // Ensure psychological realism
}
```

### Content Warnings

Always provide warnings for:
- Trauma-related content
- Self-harm or suicide themes
- Abuse or violence
- Substance use disorders
- Severe mental health crises

## Validation Requirements

- [ ] Emotion scores normalized (0-1)
- [ ] Framework specified and validated
- [ ] Confidence scores included
- [ ] Temporal coherence maintained
- [ ] Crisis detection implemented
- [ ] Cultural sensitivity considered
- [ ] Content warnings provided
- [ ] Privacy protection verified
- [ ] Bias testing completed
