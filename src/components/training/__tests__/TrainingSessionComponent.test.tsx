// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'

import { TrainingSessionComponent } from '../TrainingSessionComponent'

import '@testing-library/jest-dom/vitest'

// Mock WebSocket
class MockWebSocket {
  send = vi.fn()
  close = vi.fn()
  readyState = 1 // OPEN
  onopen = null
  onmessage = null
  onerror = null
  onclose = null
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
}
global.WebSocket = MockWebSocket as any

// Mock authClient
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'test-user' } } }),
  },
}))

// Mock hooks
vi.mock('../../hooks/useMemory', () => ({
  useConversationMemory: () => ({
    getConversationHistory: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn().mockResolvedValue({}),
  }),
}))

describe('TrainingSessionComponent', () => {
  afterEach(() => cleanup())

  it('renders with correct aria-label for trainee role', () => {
    render(<TrainingSessionComponent />)

    const textarea = screen.getByPlaceholderText(
      /Type your therapeutic response/i,
    )
    expect(textarea).toHaveAttribute('aria-label', 'Therapeutic response input')
  })

  it('switches aria-label when role changes to observer', async () => {
    render(<TrainingSessionComponent />)

    const observerButton = screen.getByText('Observer')
    fireEvent.click(observerButton)

    const textarea = screen.getByPlaceholderText(/Add a coaching note/i)
    expect(textarea).toHaveAttribute('aria-label', 'Coaching note input')
  })
})
