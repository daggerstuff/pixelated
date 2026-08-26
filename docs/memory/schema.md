# Memory Schema — PIX-510 Sprint 1

Canonical memory block schema for the Pixelated Empathy therapeutic AI system.

## Files

| File                    | Language    | Purpose                      |
| ----------------------- | ----------- | ---------------------------- |
| `src/types/memory.ts`   | TypeScript  | Primary interface definition |
| `ai/memory/schema.py`   | Python      | Pydantic dataclass mirror    |
| `ai/memory/schema.json` | JSON Schema | Validation schema            |

## Core Types

### `MemoryBlock`

Primary entity with all fields required for tenant isolation and safety:

```typescript
interface MemoryBlock {
  id: string
  tenantId: string
  sessionId: string
  content: string
  timestamp: number // Unix ms

  importance: MemoryImportance
  emotions: MemoryEmotions
  gating: MemoryGating
  consolidation: MemoryConsolidation
}
```

## Importance Scoring

```
importance = α·recency + β·relevance + γ·emotional_weight + δ·actionability
```

Default weights (configurable via env):

| Param     | Default | Description                     |
| --------- | ------- | ------------------------------- |
| α (alpha) | 0.25    | Recency weight                  |
| β (beta)  | 0.25    | Relevance weight                |
| γ (gamma) | 0.30    | Emotional weight                |
| δ (delta) | 0.20    | Actionability weight            |
| τ (tau)   | 7 days  | Exponential decay time constant |

## Emotional Categories

Plutchik wheel: `joy`, `sadness`, `anger`, `fear`, `surprise`, `disgust`,
`trust`, `anticipation`

VAD dimensions: `valence` (-1.0 to 1.0), `arousal` (0.0 to 1.0)

## Gating Policy

- **crisisFlag**: Set when emotional weight exceeds threshold (≥ 3.0x)
- **consentGate**: `open` | `restricted` | `blocked` — controls downstream
  access
- **piiStatus**: `absent` | `redacted` | `present` — PII scan result

## Validation

```bash
# Validate a memory block
node -e "const s = require('./ai/memory/schema.json'); console.log('JSON Schema valid')"

# Python Pydantic validation
uv run python -c "from ai.memory.schema import MemoryBlock; print('Python schema valid')"
```

## Parity Check

TypeScript and Python schemas must remain 1:1 compatible. CI must run parity
tests on every schema change.
