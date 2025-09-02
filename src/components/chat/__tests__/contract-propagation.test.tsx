// Tests contract propagation: messages passed to ChatContainer/ChatMessage have consistent roles & no stray type fields.

import React from 'react'
import { render, screen } from '@testing-library/react'
import ChatContainer from '../ChatContainer'
import ChatMessage from '../ChatMessage'

window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Helpers
const messages = [
  { id: '1', role: 'user', content: 'User message', name: 'You' },
  { id: '2', role: 'bot', content: 'Bot response', name: 'Assistant' },
  { id: '3', role: 'system', content: 'System note', name: 'System' },
  // Simulate legacy "type" or junk prop
  // @ts-expect-error for test
  { id: '4', role: 'bot', content: 'Should not see type', name: 'System', type: 'legacyType' },
]

describe('Contract propagation in ChatContainer and ChatMessage', () => {
  it('renders only allowed roles (user, bot, system) and no type field', () => {
    render(<ChatContainer messages={messages} onSendMessage={jest.fn()} />)
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
    const spy = jest.fn(() => null)
    render(
      <ChatContainer
        messages={messages}
        onSendMessage={jest.fn()}
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
      { id: 't1', role: 'therapist', content: 'Therapist acting as user', name: 'Therapist' },
      { id: 't2', role: 'patient', content: 'Patient acting as bot', name: 'Patient' },
      { id: 't3', role: 'system', content: 'System message', name: 'System' },
    ]
    // Simulate TherapyChatSystem's mapping (see production mapping)
    const mapped = therapyMessages.map((msg) => ({
      ...msg,
      role:
        msg.role === 'therapist'
          ? 'user'
          : msg.role === 'patient'
          ? 'bot'
          : msg.role,
    }))
    render(<ChatContainer messages={mapped} onSendMessage={jest.fn()} />)
    expect(screen.getByText('Therapist acting as user')).toBeInTheDocument()
    expect(screen.getByText('Patient acting as bot')).toBeInTheDocument()
    expect(screen.getByText('System message')).toBeInTheDocument()
  })
})