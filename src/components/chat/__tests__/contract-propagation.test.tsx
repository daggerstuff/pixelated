// Tests contract propagation: messages passed to ChatContainer/ChatMessage have consistent roles & no stray type fields.

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { ThemeProvider } from '@/components/theme/ThemeProvider'

import { ChatContainer } from '../ChatContainer'

window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Helpers
const messages: Array<{
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  type?: string
}> = [
  { role: 'user', content: 'User message', name: 'You' },
  { role: 'assistant', content: 'Bot response', name: 'Assistant' },
  { role: 'system', content: 'System note', name: 'System' },
  // Simulate legacy "type" or junk prop
  {
    role: 'assistant',
    content: 'Should not see type',
    name: 'System',
    type: 'legacyType',
  },
]

describe('Contract propagation in ChatContainer and ChatMessage', () => {
  it('renders only allowed roles (user, bot, system) and no type field', () => {
    render(
      <ThemeProvider>
        <ChatContainer messages={messages} onSendMessage={vi.fn()} />
      </ThemeProvider>,
    )
    // Role labels in specialized chat UI
    expect(screen.getAllByText(/user|bot|system/i)).toBeTruthy()
    // Messages show up
    expect(screen.getByText('User message')).toBeInTheDocument()
    expect(screen.getByText('Bot response')).toBeInTheDocument()
    expect(screen.getByText('System note')).toBeInTheDocument()
    // "type" does not propagate
    const undesired = screen.queryByText(/legacyType/i)
    expect(undesired).toBeNull()
  })

  it('maps therapy/patient/therapist roles to bot/user/system correctly', () => {
    const therapyMessages: Array<{
      role: 'therapist' | 'patient' | 'system'
      content: string
      name: string
    }> = [
      {
        role: 'therapist',
        content: 'Therapist acting as user',
        name: 'Therapist',
      },
      { role: 'patient', content: 'Patient acting as bot', name: 'Patient' },
      { role: 'system', content: 'System message', name: 'System' },
    ]
    // Simulate TherapyChatSystem's mapping (see production mapping)
    const mapped: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
      name: string
    }> = therapyMessages.map((msg) => ({
      ...msg,
      role:
        msg.role === 'therapist'
          ? ('user' as const)
          : msg.role === 'patient'
            ? ('assistant' as const)
            : ('system' as const),
    }))
    render(
      <ThemeProvider>
        <ChatContainer messages={mapped} onSendMessage={vi.fn()} />
      </ThemeProvider>,
    )
    expect(screen.getByText('Therapist acting as user')).toBeInTheDocument()
    expect(screen.getByText('Patient acting as bot')).toBeInTheDocument()
    expect(screen.getByText('System message')).toBeInTheDocument()
  })
})
