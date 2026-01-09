# Quick Reference: Pixel Conversation Integration

## 30-Second Integration

```typescript
import { usePixelConversationIntegration } from '@/hooks/usePixelConversationIntegration'

function MyChat() {
  const { analyzeMessage, eqMetrics, crisisStatus, biasFlags } = 
    usePixelConversationIntegration({ sessionId: 'x', userId: 'y' })

  const handleMessage = async (msg: string) => {
    const result = await analyzeMessage(msg, 'support')
    if (result?.eq_scores) console.log('EQ:', result.eq_scores.overall_eq)
    if (crisisStatus?.isCrisis) alert('Crisis detected!')
  }

  return <div>{/* your chat UI */}</div>
}
```

---

## Common Patterns

### 1. EQ Metrics Tracking
```typescript
const { eqMetrics } = usePixelEQMetrics(sessionId, userId)

// Display trend
useEffect(() => {
  if (eqMetrics?.overallEQTrend) {
    chart.setData(eqMetrics.overallEQTrend)
  }
}, [eqMetrics])
```

### 2. Crisis Alert
```typescript
const { crisisStatus } = usePixelCrisisDetection(
  sessionId, userId,
  (status) => {
    if (status.isCrisis) showEmergencyUI()
  }
)
```

### 3. Bias Warning
```typescript
const { biasFlags, severeBiasCount } = usePixelBiasDetection(sessionId, userId)

{severeBiasCount > 0 && <BiasWarning flags={biasFlags} />}
```

### 4. Conversation Memory Integration
```typescript
const memory = useConversationMemory()
const pixel = usePixelConversationIntegration({ sessionId, userId })

const handleMessage = async (msg: string) => {
  // Store in memory
  memory.addMessage('therapist', msg)
  
  // Analyze with Pixel
  const metrics = await pixel.analyzeMessage(msg)
  
  // Use both
  logMetrics(metrics, memory.memory)
}
```

---

## State Accessors

```typescript
const {
  // Methods
  analyzeMessage,          // (msg, context?) => Promise<PixelInferenceResponse>
  clearBiasFlags,          // () => void
  resetSession,            // () => void
  getConversationHistory,  // () => ConversationTurn[]
  
  // State
  eqMetrics,              // EQMetricsAggregate | null
  crisisStatus,           // CrisisDetectionStatus | null
  biasFlags,              // BiasFlag[]
  lastAnalysis,           // PixelInferenceResponse | null
  
  // Loading states
  isAnalyzing,            // boolean
  error,                  // string | null
  
  // Service reference
  integration,            // PixelConversationIntegration | null
} = usePixelConversationIntegration({...})
```

---

## Configuration Cheatsheet

```typescript
usePixelConversationIntegration({
  // Required
  sessionId: 'session-123',
  userId: 'user-456',

  // API (optional, defaults shown)
  pixelApiUrl: 'http://localhost:8001',
  pixelApiKey: '',

  // Features (optional, defaults shown)
  enableMetricsTracking: true,    // Track EQ
  enableBiasDetection: true,      // Flag bias
  enableCrisisDetection: true,    // Detect crisis
  autoAnalyzeResponses: true,     // Auto-call API

  // Thresholds (optional, defaults shown)
  crisisThreshold: 0.7,           // Risk level threshold
  biasThreshold: 0.3,             // Bias flag threshold
  contextWindowSize: 10,          // Messages to keep in context
})
```

---

## EQ Scores Interpretation

```typescript
eqMetrics.emotionalAwareness       // 0-1: Self-awareness
eqMetrics.empathyRecognition       // 0-1: Understanding others
eqMetrics.emotionalRegulation      // 0-1: Emotion management
eqMetrics.socialCognition          // 0-1: Social understanding
eqMetrics.interpersonalSkills      // 0-1: Relationship management
eqMetrics.overallEQTrend           // [0-1]: Composite scores over time
eqMetrics.turnsAnalyzed            // Number: Total turns processed
```

---

## Crisis Levels

```typescript
crisisStatus.riskLevel
  'low'       // No immediate danger
  'medium'    // Elevated risk, monitor closely
  'high'      // Significant risk, intervention needed
  'critical'  // Immediate danger, emergency response

crisisStatus.signals              // Array of detected signals
crisisStatus.interventionType
  'safety_protocol'               // Immediate harm detected
  'risk_assessment'               // Self-harm risk
  'crisis_response'               // General crisis
```

---

## Bias Severity

```typescript
biasFlags[0].severity
  'low'       // Minor bias, monitor
  'medium'    // Noticeable bias, address
  'high'      // Significant bias, correct immediately
```

---

## Error Handling

```typescript
const { analyzeMessage, error, isAnalyzing } = usePixelConversationIntegration({...})

if (error) {
  // API unreachable, model not loaded, invalid request, etc.
  showError(`Analysis failed: ${error}`)
}

if (isAnalyzing) {
  // Show loading UI
  <Spinner />
}
```

---

## Service API (Direct Access)

```typescript
const { integration } = usePixelConversationIntegration({...})

// Manual operations
integration?.addMessage('user', 'text')
integration?.analyzeConversationTurn('query', 'context')
integration?.clearBiasFlags()
integration?.resetSession()

// Direct state access
const state = integration?.getState()
const metrics = integration?.getEQMetricsTrend()
const crisis = integration?.getCrisisStatus()
const bias = integration?.getBiasFlags()
const history = integration?.getConversationHistory()
```

---

## TypeScript Types

```typescript
// Request
import type { PixelInferenceRequest } from '@/types/pixel'

// Response
import type { PixelInferenceResponse, EQScores } from '@/types/pixel'

// Metadata
import type { ConversationMetadata } from '@/types/pixel'

// Integration
import type { 
  UsePixelConversationIntegrationReturn,
  PixelIntegrationConfig,
} from '@/hooks/usePixelConversationIntegration'
```

---

## Common Imports

```typescript
// Hook
import { usePixelConversationIntegration } from '@/hooks/usePixelConversationIntegration'
import { usePixelEQMetrics, usePixelCrisisDetection, usePixelBiasDetection } from '@/hooks/usePixelConversationIntegration'

// Types
import type { PixelInferenceResponse, EQScores } from '@/types/pixel'

// Service (if accessing directly)
import { getPixelIntegration, createPixelIntegration } from '@/lib/pixel-conversation-integration'

// Example Component
import { PixelEnhancedChat } from '@/components/chat/PixelEnhancedChat'
```

---

## Latency Expectations

| Operation | Latency |
|-----------|---------|
| Pixel API call | <200ms P95 |
| Hook state sync | <5ms |
| React re-render | <16ms (60fps) |
| **Total end-to-end** | **<210ms** |

---

## Feature Toggles

```typescript
// Track only EQ metrics
usePixelEQMetrics(sessionId, userId)

// Detect only crisis
usePixelCrisisDetection(sessionId, userId, onDetected)

// Detect only bias
usePixelBiasDetection(sessionId, userId, onDetected)

// Everything
usePixelConversationIntegration({
  sessionId, userId,
  enableMetricsTracking: true,
  enableBiasDetection: true,
  enableCrisisDetection: true,
})
```

---

## Testing Example

```typescript
import { renderHook, act } from '@testing-library/react'
import { usePixelConversationIntegration } from '@/hooks/usePixelConversationIntegration'

describe('Pixel Integration', () => {
  it('analyzes messages', async () => {
    const { result } = renderHook(() =>
      usePixelConversationIntegration({ sessionId: 'test', userId: 'test' })
    )

    const response = await act(async () =>
      result.current.analyzeMessage('Test', 'support')
    )

    expect(response?.eq_scores).toBeDefined()
  })
})
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API unreachable | Check `pixelApiUrl` config, ensure Pixel service running on 8001 |
| Service not initialized | Pass `autoInitialize: true` or verify `sessionId`/`userId` provided |
| Stale metrics | Call `analyzeMessage()` to trigger fresh analysis |
| Performance slow | Check `contextWindowSize`, reduce to <5 if latency high |
| Crisis not detecting | Verify `enableCrisisDetection: true`, check signal keywords in message |
| Bias not flagging | Verify `enableBiasDetection: true`, adjust `biasThreshold` if needed |

---

## Links

- 📖 [Full Documentation](./PIXEL_REALTIME_INTEGRATION.md)
- 🏗️ [Implementation Summary](../PHASE_3_3_SUMMARY.md)
- 📋 [Checklist Status](./ngc-therapeutic-enhancement-checklist.md)
- 🧪 [Example Component](../src/components/chat/PixelEnhancedChat.tsx)

---

Last updated: January 8, 2026
