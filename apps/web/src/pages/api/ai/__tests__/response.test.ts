import { createContext } from 'astro/middleware'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateCompletion, storeResponseGeneration } = vi.hoisted(() => ({
  generateCompletion: vi.fn(),
  storeResponseGeneration: vi.fn(),
}))

vi.mock('@/lib/ai/services/llm-provider', () => ({
  createLLMService: () => ({ generateCompletion, dispose: vi.fn() }),
}))
vi.mock('@/lib/db/ai', () => ({
  aiRepository: { storeResponseGeneration },
}))
vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ({ user: { id: 'fictional-user' } }),
}))
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
  AuditEventType: { AI_OPERATION: 'ai_operation' },
  AuditEventStatus: { FAILURE: 'failure' },
}))
vi.mock('@/lib/sentry/api-metrics', () => ({
  trackApiRequest: vi.fn(),
  trackApiError: vi.fn(),
}))
vi.mock('@/lib/sentry/utils', () => ({
  apiMetrics: { responseTime: vi.fn() },
  countMetric: vi.fn(),
}))

import { POST } from '../response'

describe('POST /api/ai/response register scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      currentMessage: 'I keep avoiding meetings and want to understand why.',
      reply: "Let's look at what happens before you avoid the meeting. Which part feels hardest?",
    },
    {
      currentMessage: 'My friend died last week.',
      reply: "I'm sorry that happened. What would you like to tell me about your friend?",
    },
    {
      currentMessage: 'I am worried I might take these pills.',
      reply: 'What would happen if you put some distance between you and the pills? Stay with someone you trust.',
    },
  ])('preserves the generated response to $currentMessage', async ({ currentMessage, reply }) => {
    generateCompletion.mockResolvedValue({ content: reply })
    const request = new Request('https://example.test/api/ai/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentMessage }),
    })

    const response = await POST(createContext({ request, defaultLocale: 'en' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ content: reply })
    expect(storeResponseGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ response: reply }),
    )
  })
})
