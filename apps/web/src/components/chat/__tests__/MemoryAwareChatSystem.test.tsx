import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme/ThemeProvider'
import type { Message } from '@/types/chat'

import { MemoryAwareChatSystem } from '../MemoryAwareChatSystem'

window.HTMLElement.prototype.scrollIntoView = vi.fn()

type MockMemoryEntry = {
  id: string
  content: string
  metadata: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
  messages: [] as Message[],
  memories: [] as MockMemoryEntry[],
  sendMessage: vi.fn(async () => undefined),
  setMessages: vi.fn(),
  clearMemories: vi.fn(),
}))

vi.mock('@/hooks/useChatWithMemory', () => ({
  useChatWithMemory: () => ({
    messages: mocks.messages,
    input: '',
    handleInputChange: () => undefined,
    handleSubmit: async () => undefined,
    isLoading: false,
    setMessages: mocks.setMessages,
    sendMessage: mocks.sendMessage,
    memory: {
      memories: mocks.memories,
      isLoading: false,
      error: null,
      stats: null,
      addMemory: async () => 'memory-id',
      searchMemories: async () => [],
      updateMemory: async () => undefined,
      deleteMemory: async () => undefined,
      refreshMemories: async () => undefined,
      addUserPreference: async () => undefined,
      addConversationContext: async () => undefined,
      addProjectInfo: async () => undefined,
      searchByCategory: async () => [],
      searchByTags: async () => [],
      clearMemories: mocks.clearMemories,
      getMemoryHistory: async () => [],
    },
  }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null }),
  },
}))

function renderSystem() {
  return render(
    <ThemeProvider>
      <MemoryAwareChatSystem
        sessionId="test-session"
        title="Test Session"
        subtitle="Memory-aware chat under test"
      />
    </ThemeProvider>,
  )
}

describe('MemoryAwareChatSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.messages = []
    mocks.memories = []
  })

  describe('conversation summary', () => {
    it('derives the insights summary from real conversation and memory data', async () => {
      mocks.messages = [
        {
          role: 'user',
          content: 'I have been feeling anxious and worried about work',
          name: 'You',
        },
        {
          role: 'assistant',
          content: 'It sounds like work has been stressful lately.',
          name: 'Assistant',
        },
        {
          role: 'user',
          content: 'I feel fear of failing and my anxiety is high',
          name: 'You',
        },
        {
          role: 'assistant',
          content: 'Let us slow down and look at that fear together.',
          name: 'Assistant',
        },
        {
          role: 'user',
          content: 'I am so worried I cannot sleep',
          name: 'You',
        },
        {
          role: 'assistant',
          content: 'Sleep difficulty is common when worry is high.',
          name: 'Assistant',
        },
      ]
      mocks.memories = [
        { id: 'm1', content: 'user: anxious about work', metadata: {} },
        { id: 'm2', content: 'assistant: response', metadata: {} },
        { id: 'm3', content: 'user: cannot sleep', metadata: {} },
      ]

      renderSystem()

      const summary = await screen.findByText(/messages exchanged/)
      const text = summary.textContent ?? ''
      expect(text).toContain('6 messages exchanged (3 from you)')
      expect(text).toContain('emotional themes:')
      expect(text).toContain('affective trend:')
      expect(text).toContain('3 memories retained')
      expect(text).not.toContain('productive conversation about')
    })

    it('reports an empty conversation without a summary panel', () => {
      mocks.messages = []

      renderSystem()

      expect(screen.queryByText(/Conversation Insights/i)).toBeNull()
    })
  })

  describe('regenerate', () => {
    it('drops the last assistant reply and resends the last user message', async () => {
      const user1: Message = {
        role: 'user',
        content: 'Tell me about hope',
        name: 'You',
      }
      const assistant1: Message = {
        role: 'assistant',
        content: 'Old reply',
        name: 'Assistant',
      }
      const user2: Message = {
        role: 'user',
        content: 'And about grief?',
        name: 'You',
      }
      const assistant2: Message = {
        role: 'assistant',
        content: 'Stale answer',
        name: 'Assistant',
      }
      mocks.messages = [user1, assistant1, user2, assistant2]
      const user = userEvent.setup()

      renderSystem()

      await user.click(screen.getByRole('button', { name: /regenerate/i }))

      expect(mocks.setMessages).toHaveBeenCalledWith([user1, assistant1])
      expect(mocks.sendMessage).toHaveBeenCalledWith('And about grief?')
    })

    it('does nothing when there is no user message to resend', async () => {
      mocks.messages = [
        { role: 'system', content: 'System note', name: 'System' },
        { role: 'assistant', content: 'Assistant only', name: 'Assistant' },
      ]
      const user = userEvent.setup()

      renderSystem()

      await user.click(screen.getByRole('button', { name: /regenerate/i }))

      expect(mocks.setMessages).not.toHaveBeenCalled()
      expect(mocks.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('clears messages and memories after confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      mocks.messages = [
        { role: 'user', content: 'Hi', name: 'You' },
        { role: 'assistant', content: 'Hello', name: 'Assistant' },
      ]
      mocks.memories = [{ id: 'm1', content: 'user: Hi', metadata: {} }]
      const user = userEvent.setup()

      renderSystem()

      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(window.confirm).toHaveBeenCalledWith(
        'Clear all messages and stored memories for this session?',
      )
      expect(mocks.setMessages).toHaveBeenCalledWith([])
      expect(mocks.clearMemories).toHaveBeenCalled()
    })

    it('keeps everything when the user declines', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      mocks.messages = [
        { role: 'user', content: 'Hi', name: 'You' },
        { role: 'assistant', content: 'Hello', name: 'Assistant' },
      ]
      const user = userEvent.setup()

      renderSystem()

      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(mocks.setMessages).not.toHaveBeenCalled()
      expect(mocks.clearMemories).not.toHaveBeenCalled()
    })
  })
})
