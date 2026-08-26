import type { GateResult } from '@pixelated/memory-schema'

import { crisisDetector } from '@/lib/memory/gates/crisis-detector'

const CRITICAL_BLOCK_REASON =
  'Critical crisis detected. Blocking ingestion.' as const

const CRISIS_ACTIVE_REASON =
  'Crisis signal detected. Requires immediate professional review.' as const

/**
 * Synchronous pre-submit gate for chat input. Mirrors SocraticGate crisis
 * decisions so the UI can render safety blocks without waiting on network I/O.
 */
export function evaluateChatGate(content: string): GateResult {
  const crisis = crisisDetector.detect(content)

  if (crisis.tier === 'critical') {
    return {
      decision: 'block',
      reason: CRITICAL_BLOCK_REASON,
      suggestedTags: ['CRISIS_SIGNAL'],
      anomalyDetected: true,
    }
  }

  if (crisis.crisisFlag) {
    return {
      decision: 'active',
      reason: CRISIS_ACTIVE_REASON,
      suggestedTags: ['CRISIS_SIGNAL'],
      anomalyDetected: true,
    }
  }

  return {
    decision: 'auto',
    reason: 'Normal information flow.',
    suggestedTags: [],
    anomalyDetected: false,
  }
}

export { CRITICAL_BLOCK_REASON }
