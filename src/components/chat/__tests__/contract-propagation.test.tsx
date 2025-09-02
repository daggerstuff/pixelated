// Tests contract propagation: messages passed to ChatContainer/ChatMessage have consistent roles & no stray type fields.

import { render, screen } from '@testing-library/react'
import { ChatContainer } from '../ChatContainer'

window.HTMLElement.prototype.scrollIntoView = vi.fn()
    // Messages show up
    expect(screen.getByText('User message')).toBeInTheDocument()
    render(<ChatContainer messages={messages} onSendMessage={vi.fn()} />)
  })

  it('does not propagate unintended properties to ChatMessage', () => {
    // Spy on ChatMessage to see props
    render(<ChatContainer messages={messages} onSendMessage={vi.fn()} />)
        // @ts-ignore override for test
        __ChatMessage={spy}
      />
    )
    render(<ChatContainer messages={messages} onSendMessage={vi.fn()} />)
    const mapped = therapyMessages.map((msg) => ({
      ...msg,
      role:
        msg.role === 'therapist'
    const spy = vi.fn(() => null)
    render(
      <ChatContainer
        messages={messages}
        onSendMessage={vi.fn()}
    render(<ChatContainer messages={mapped as Message[]} onSendMessage={vi.fn()} />)
    const spy = vi.fn(() => null)
    render(
      <ChatContainer
        messages={messages}
        onSendMessage={vi.fn()}
    render(<ChatContainer messages={mapped as Message[]} onSendMessage={vi.fn()} />)
