import { useState, useCallback, useEffect } from 'react'

import { emotionalWeight } from '@/lib/memory/importance-scorer'
import {
  ReverieEngine,
  DEFAULT_REVERIE_CONFIG,
  type ReverieConfig,
} from '@/lib/memory/reverie'
import type { Message } from '@/types/chat'
import type { MemoryBlock } from '@/types/memory'

import type { MemoryEntry } from '../lib/memory/memory-client'
import { useChat, type UseChatReturn } from './useChat'
import { useMemory, type UseMemoryReturn } from './useMemory'

export interface ChatWithMemoryOptions {
  initialMessages?: Message[]
  memoryKey?: string
  sessionId?: string
  enableMemory?: boolean
  enableAnalysis?: boolean
  maxMemoryContext?: number
  api?: string // Allow API endpoint override
  reverieConfig?: ReverieConfig
}

export type UseChatWithMemoryReturn = UseChatReturn & {
  memory: UseMemoryReturn
  sendMessage: (message: string) => Promise<string | undefined>
}

/**
 * Convert a MemoryEntry (storage format) to a MemoryBlock (reverie engine format).
 * Fills in sensible defaults for fields not present in the storage format.
 */
function toMemoryBlock(entry: MemoryEntry): MemoryBlock {
  const meta = entry.metadata ?? {}
  const ts = entry.createdAt ? new Date(entry.createdAt).getTime() : Date.now()
  const hasCrisis = !!meta.crisisSeverity && meta.crisisSeverity !== 'none'

  const extracted = extractEmotions(entry.content)
  const weight = emotionalWeight(extracted.categories)
  const tags = Array.isArray(meta.tags) ? meta.tags : []
  const categories = Array.from(new Set([...extracted.categories, ...tags]))

  return {
    id: entry.id,
    tenantId: meta.userId ?? 'unauthenticated-user',
    sessionId: meta.sessionId ?? 'unknown',
    content: entry.content,
    timestamp: ts,
    importance: {
      raw: 0.5,
      recency: 0.5,
      relevance: 0.5,
      emotionalWeight: hasCrisis ? 5.0 : weight,
      actionability: 0.5,
      reveriePotential: 0.5,
    },
    emotions: {
      valence: extracted.valence,
      arousal: extracted.arousal,
      categories,
    },
    gating: {
      piiStatus: meta.piiRemoved ? 'redacted' : 'absent',
      crisisFlag: hasCrisis,
      traumaIndicators: [],
      consentGate: 'open',
    },
    consolidation: {
      phase: 'raw',
      lastProcessed: ts,
      remCycles: 0,
      schemaReferences: [],
      reverieEligible: false,
      reveriePhase: 'dormant',
    },
  }
}

/**
 * Multi-category emotion extraction with intensity scoring.
 * Detects multiple emotions per message, blends valence/arousal,
 * handles basic negation ("not happy" → reduces positive valence).
 */
function extractEmotions(text: string): {
  valence: number
  arousal: number
  categories: string[]
} {
  const lower = text.toLowerCase()
  const categories: string[] = []
  let valenceSum = 0
  let arousalSum = 0
  let weightSum = 0

  const emotionMap: Record<
    string,
    { keywords: string[]; valence: number; arousal: number }
  > = {
    anxiety: {
      keywords: [
        'anxious',
        'anxiety',
        'worry',
        'worried',
        'panic',
        'nervous',
        'fear',
        'afraid',
      ],
      valence: -0.5,
      arousal: 0.7,
    },
    sadness: {
      keywords: [
        'sad',
        'grief',
        'loss',
        'depressed',
        'depression',
        'hopeless',
        'lonely',
        'empty',
      ],
      valence: -0.7,
      arousal: -0.3,
    },
    joy: {
      keywords: [
        'happy',
        'joy',
        'excited',
        'hopeful',
        'grateful',
        'good',
        'great',
        'wonderful',
      ],
      valence: 0.7,
      arousal: 0.5,
    },
    anger: {
      keywords: ['angry', 'frustrated', 'rage', 'mad', 'furious', 'irritated'],
      valence: -0.6,
      arousal: 0.8,
    },
    fear: {
      keywords: [
        'scared',
        'terrified',
        'frightened',
        'threat',
        'danger',
        'unsafe',
      ],
      valence: -0.7,
      arousal: 0.6,
    },
    guilt: {
      keywords: ['guilty', 'regret', 'sorry', 'my fault', 'blame myself'],
      valence: -0.5,
      arousal: 0.2,
    },
    shame: {
      keywords: [
        'ashamed',
        'embarrassed',
        'humiliated',
        'worthless',
        'pathetic',
      ],
      valence: -0.8,
      arousal: 0.4,
    },
    despair: {
      keywords: ['despair', 'give up', 'no point', 'end it all', "can't go on"],
      valence: -0.9,
      arousal: -0.2,
    },
    hope: {
      keywords: [
        'hope',
        'maybe',
        'someday',
        'things will get better',
        'looking forward',
      ],
      valence: 0.6,
      arousal: 0.3,
    },
    confusion: {
      keywords: ['confused', 'lost', "don't understand", 'unclear', 'unsure'],
      valence: -0.1,
      arousal: 0.3,
    },
    loneliness: {
      keywords: ['alone', 'nobody', 'no one', 'isolated', 'disconnected'],
      valence: -0.6,
      arousal: -0.1,
    },
    acceptance: {
      keywords: ['accept', 'okay with', 'made peace', 'come to terms'],
      valence: 0.3,
      arousal: -0.2,
    },
    love: {
      keywords: ['love', 'care about', 'dear to me', 'cherish'],
      valence: 0.8,
      arousal: 0.4,
    },
    trust: {
      keywords: ['trust', 'believe in', 'rely on', 'depend on'],
      valence: 0.5,
      arousal: -0.1,
    },
    curiosity: {
      keywords: ['curious', 'wonder', 'interested', 'want to know', 'explore'],
      valence: 0.3,
      arousal: 0.4,
    },
    relief: {
      keywords: ['relief', 'relieved', 'finally', "glad that's over"],
      valence: 0.4,
      arousal: -0.3,
    },
    pride: {
      keywords: ['proud', 'accomplished', 'did it', 'succeeded'],
      valence: 0.6,
      arousal: 0.3,
    },
    trauma: {
      keywords: ['trauma', 'ptsd', 'flashback', 'triggered', 'nightmare'],
      valence: -0.8,
      arousal: 0.7,
    },
    surprise: {
      keywords: ['surprised', 'shocked', 'unexpected', "didn't expect"],
      valence: 0.0,
      arousal: 0.6,
    },
    disgust: {
      keywords: ['disgusting', 'revolting', 'sick', 'gross'],
      valence: -0.7,
      arousal: 0.5,
    },
  }

  const negationPattern =
    /\b(not|no|never|don't|doesn't|didn't|isn't|aren't|wasn't|weren't)\b/

  for (const [category, info] of Object.entries(emotionMap)) {
    const matchCount = info.keywords.filter((kw) => lower.includes(kw)).length
    if (matchCount === 0) continue

    const nearbyNegation = info.keywords.some((kw) => {
      const idx = lower.indexOf(kw)
      if (idx === -1) return false
      const window = lower.slice(Math.max(0, idx - 15), idx + kw.length + 5)
      return negationPattern.test(window)
    })

    const weight = nearbyNegation ? matchCount * 0.3 : matchCount
    categories.push(category)
    valenceSum += info.valence * weight
    arousalSum += info.arousal * weight
    weightSum += weight
  }

  if (weightSum === 0) return { valence: 0, arousal: 0, categories: [] }
  return {
    valence: Math.max(-1, Math.min(1, valenceSum / weightSum)),
    arousal: Math.max(0, Math.min(1, (arousalSum / weightSum + 1) / 2)),
    categories,
  }
}

export function useChatWithMemory(
  options: ChatWithMemoryOptions = {},
): UseChatWithMemoryReturn {
  const { initialMessages = [], sessionId } = options
  const [isLoading, setIsLoading] = useState(false)

  const chat = useChat({
    initialMessages,
    api: options.api ?? '/api/ai/completion',
  })
  const memory = useMemory({
    userId: sessionId,
    category: 'conversation',
    autoLoad: true,
  })

  const [reverie] = useState(
    () => new ReverieEngine(options.reverieConfig ?? DEFAULT_REVERIE_CONFIG),
  )

  useEffect(() => {
    reverie.clear()
  }, [sessionId, reverie])

  const sendMessage = useCallback(
    async (message: string) => {
      setIsLoading(true)
      try {
        // Build reverie prompt from existing memories before sending
        let reveriePrompt = ''
        if (options.enableMemory && memory.memories.length > 0) {
          // Convert stored memories to MemoryBlock format
          const blocks = memory.memories.map(toMemoryBlock)

          // Seed reverie candidates (mark some as latent)
          const seedResult = reverie.seedReverieCandidates(blocks)
          const seededBlocks = reverie.applySeeds(blocks, seedResult.seeds)

          // Extract emotions from the incoming message
          const emotions = extractEmotions(message)

          // Run reverie processing
          const result = reverie.process(message, emotions, seededBlocks)
          reveriePrompt = result.reveriePrompt
        }

        // Store user message as memory
        if (options.enableMemory) {
          await memory.addMemory(`user: ${message}`, {
            role: 'user',
            sessionId,
          })
        }

        // Send message with reverie prompt injected as extra body
        const responseContent = await chat.sendMessage(message, {
          ...(reveriePrompt ? { reveriePrompt } : {}),
        })

        // Store assistant response as memory
        if (options.enableMemory && responseContent) {
          await memory.addMemory(`assistant: ${responseContent}`, {
            role: 'assistant',
            sessionId,
          })
        }

        return responseContent
      } finally {
        setIsLoading(false)
      }
    },
    [chat, memory, options.enableMemory, sessionId, reverie],
  )

  return {
    ...chat,
    sendMessage,
    isLoading: isLoading || chat.isLoading,
    memory,
  }
}
