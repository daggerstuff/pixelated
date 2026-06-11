import { useCallback, useState } from 'react'

import { evaluateChatGate } from '@/lib/chat/evaluate-chat-gate'
import type { GateResult } from '@pixelated/memory-schema'
import { cn } from '@/lib/utils'

interface TherapyGateMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface TherapyGateProps {
  className?: string
}

export function TherapyGate({ className }: TherapyGateProps) {
  const [messages, setMessages] = useState<TherapyGateMessage[]>([])
  const [input, setInput] = useState('')
  const [blockedGate, setBlockedGate] = useState<GateResult | null>(null)

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()

      const trimmed = input.trim()
      if (!trimmed) {
        return
      }

      const gateResult = evaluateChatGate(trimmed)
      if (gateResult.decision === 'block') {
        setBlockedGate(gateResult)
        return
      }

      setBlockedGate(null)
      setMessages((previous) => [
        ...previous,
        {
          id: `user-${previous.length + 1}`,
          role: 'user',
          content: trimmed,
        },
        {
          id: `assistant-${previous.length + 2}`,
          role: 'assistant',
          content:
            'Thank you for sharing. I am here to support you in this session.',
        },
      ])
      setInput('')
    },
    [input],
  )

  return (
    <div
      className={cn('flex h-full min-h-[28rem] flex-col gap-4', className)}
      data-testid="therapy-gate-chat"
    >
      <div
        className="border-slate-200 bg-white flex-1 space-y-3 overflow-y-auto rounded-lg border p-4 shadow-sm"
        data-testid="chat-history"
      >
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Send a message to begin the gated therapy chat session.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-testid={
                message.role === 'user' ? 'message-user' : 'message-assistant'
              }
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                message.role === 'user'
                  ? 'bg-blue-600 text-white ml-auto'
                  : 'bg-slate-100 text-slate-900 mr-auto',
              )}
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      {blockedGate ? (
        <div
          role="alert"
          data-testid="safety-block"
          className="border-red-300 bg-red-50 text-red-900 rounded-lg border px-4 py-3 shadow-sm"
        >
          <p className="font-semibold">Message blocked for safety</p>
          <p data-testid="gate-result-reason" className="mt-1 text-sm">
            {blockedGate.reason}
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your message..."
          rows={2}
          data-testid="message-input"
          className="border-slate-300 focus:border-blue-500 focus:ring-blue-200 min-h-[3rem] flex-1 resize-none rounded-lg border px-3 py-2 text-sm shadow-inner outline-none focus:ring-2"
        />
        <button
          type="submit"
          data-testid="send-button"
          className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
