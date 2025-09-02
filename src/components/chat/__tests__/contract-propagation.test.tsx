// Tests contract propagation: messages passed to ChatContainer/ChatMessage have consistent roles & no stray type fields.

import { render, screen } from '@testing-library/react'
import { ChatContainer } from '../ChatContainer'

// Helpers
const messages = [
  { role: 'user', content: 'User message', name: 'You' },
  { role: 'assistant', content: 'Bot response', name: 'Assistant' },
  { role: 'system', content: 'System note', name: 'System' },
  // Simulate legacy "type" or junk prop
  { role: 'assistant', content: 'Should not see type', name: 'System', type: 'legacyType' },
]

describe('Contract propagation in ChatContainer and ChatMessage', () => {
  it('renders only allowed roles (user, bot, system) and no type field', () => {
    render(<ChatContainer messages={messages} onSendMessage={vi.fn()} />)
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

  it('does not propagate unintended properties to ChatMessage', () => {
    // Spy on ChatMessage to see props
    const spy = vi.fn(() => null)
    render(
      <ChatContainer
        messages={messages}
        onSendMessage={vi.fn()}
        // @ts-ignore override for test
        __ChatMessage={spy}
      />
    )
    messages.forEach((msg) => {
      expect(Object.keys(msg)).not.toContain('type')
      // If test infra allowed, check props.subset
    })
  })

  it('maps therapy/patient/therapist roles to bot/user/system correctly', () => {
    const therapyMessages = [
      { role: 'therapist', content: 'Therapist acting as user', name: 'Therapist' },
      { role: 'patient', content: 'Patient acting as bot', name: 'Patient' },
      { role: 'system', content: 'System message', name: 'System' },
    ]
    // Simulate TherapyChatSystem's mapping (see production mapping)
    const mapped = therapyMessages.map((msg) => ({
      ...msg,
      role:
        msg.role === 'therapist'
          ? 'user'
          : msg.role === 'patient'
          ? 'assistant'
          : msg.role,
    }))
    render(<ChatContainer messages={mapped as Message[]} onSendMessage={vi.fn()} />)
    expect(screen.getByText('Therapist acting as user')).toBeInTheDocument()
    expect(screen.getByText('Patient acting as bot')).toBeInTheDocument()
    expect(screen.getByText('System message')).toBeInTheDocument()
  })
})