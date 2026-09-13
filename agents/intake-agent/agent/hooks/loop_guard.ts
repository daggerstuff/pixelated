import { defineHook } from 'eve/hooks'

// Loop guard for GLM models: detect degenerate repetition in assistant output
// and abort the turn instead of streaming garbage downstream.
//
// Two heuristics on 'message.completed':
//  1. 10+ consecutive identical punctuation characters (spaces and newlines
//     are excluded to avoid false positives on markdown tables and indented
//     code blocks).
//  2. 3+ consecutive identical non-empty messages within the same turn.
//
// Throwing from the hook propagates as turn.failed, which stops the turn
// before any further steps run. State is module-scoped per isolate; the turn
// map is capped and cleaned up on turn end to avoid unbounded growth.

const PUNCTUATION_RUN = /([.,!?;:~*\-_=#&])\1{9,}/
const REPEAT_THRESHOLD = 3
const MAX_TRACKED_TURNS = 128

const recentMessagesByTurn = new Map<string, { text: string; count: number }>()

export default defineHook({
  events: {
    'message.completed'(event) {
      const data = (event as { data?: { message?: unknown; turnId?: unknown } })
        .data
      const text = typeof data?.message === 'string' ? data.message : ''
      const turnId = typeof data?.turnId === 'string' ? data.turnId : ''
      if (!text) return

      if (PUNCTUATION_RUN.test(text)) {
        throw new Error(
          `[loop-guard] repetition detected: 10+ consecutive identical punctuation characters in turn ${turnId}`,
        )
      }

      if (!turnId) return
      const previous = recentMessagesByTurn.get(turnId)
      if (previous && previous.text === text) {
        previous.count += 1
      } else {
        if (recentMessagesByTurn.size >= MAX_TRACKED_TURNS) {
          const oldest = recentMessagesByTurn.keys().next().value
          if (oldest !== undefined) recentMessagesByTurn.delete(oldest)
        }
        recentMessagesByTurn.set(turnId, { text, count: 1 })
      }
      if ((recentMessagesByTurn.get(turnId)?.count ?? 0) >= REPEAT_THRESHOLD) {
        throw new Error(
          `[loop-guard] repetition detected: identical message repeated ${REPEAT_THRESHOLD}x in turn ${turnId}`,
        )
      }
    },
    'turn.completed'(event) {
      const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId
      if (typeof turnId === 'string') recentMessagesByTurn.delete(turnId)
    },
    'turn.failed'(event) {
      const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId
      if (typeof turnId === 'string') recentMessagesByTurn.delete(turnId)
    },
  },
})
