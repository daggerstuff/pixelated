import { defineHook } from 'eve/hooks'

// Loop guard for GLM models: detect degenerate repetition in assistant output
// and abort the turn instead of streaming garbage downstream.
//
// Two heuristics on 'content.completed' reply parts:
//  1. 10+ consecutive identical punctuation characters (spaces and newlines
//     are excluded to avoid false positives on markdown tables and indented
//     code blocks).
//  2. 3+ consecutive identical non-empty replies within the same turn.
//
// Throwing from the hook propagates as a turn failure, which stops the turn
// before any further steps run. State is module-scoped per isolate; the turn
// map is capped and cleaned up when the turn settles to avoid unbounded growth.

const PUNCTUATION_RUN = /([.,!?;:~*\-_=#&])\1{9,}/
const REPEAT_THRESHOLD = 3
const MAX_TRACKED_TURNS = 128

const recentMessagesByTurn = new Map<string, { text: string; count: number }>()

export default defineHook({
  events: {
    'content.completed'(event) {
      const data = (event as { data?: { kind?: unknown; value?: unknown; phase?: unknown } })
        .data
      if (data?.kind !== 'text' || data?.phase !== 'reply') return
      const text = typeof data.value === 'string' ? data.value : ''
      const turnId =
        typeof (event as { scope?: { turnId?: unknown } }).scope?.turnId === 'string'
          ? ((event as { scope?: { turnId?: string } }).scope?.turnId as string)
          : ''
      if (!text) return

      if (PUNCTUATION_RUN.test(text)) {
        throw new Error(
          '[loop-guard] repetition detected: 10+ consecutive identical punctuation characters in turn ' +
            turnId,
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
          '[loop-guard] repetition detected: identical message repeated ' +
            REPEAT_THRESHOLD +
            'x in turn ' +
            turnId,
        )
      }
    },
    'turn.settled'(event) {
      const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId
      if (typeof turnId === 'string') recentMessagesByTurn.delete(turnId)
    },
  },
})
