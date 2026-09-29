import type { GateResult } from '@pixelated/memory-schema'
import { useCallback, useRef, useState } from 'react'

import { evaluateChatGate } from '@/lib/chat/evaluate-chat-gate'
import { cn } from '@/lib/utils'

type GatingStatus = 'idle' | 'evaluating' | 'routing' | 'verified' | 'blocked'

interface TherapyGateMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface TherapyGateProps {
  className?: string
  gateApiUrl?: string
}

export function TherapyGate({ className, gateApiUrl }: TherapyGateProps) {
  const [messages, setMessages] = useState<TherapyGateMessage[]>([])
  const [blockedGate, setBlockedGate] = useState<GateResult | null>(null)
  const [gatingStatus, setGatingStatus] = useState<GatingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)
  const inputHelperRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleSubmit = useCallback(async () => {
    const form = document.querySelector('form')
    if (form) {
      form.setAttribute('data-submit-started', 'true')
    }

    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="message-input"]',
    )
    const helper = inputHelperRef.current
    if (!textarea) {
      if (form) form.setAttribute('data-submit-error', 'missing-element')
      return
    }
    const rawValue = textarea.value
    const trimmed = rawValue.trim()
    if (!trimmed) {
      if (form) form.setAttribute('data-submit-error', 'empty-or-submitting')
      return
    }
    if (isSubmittingRef.current) {
      if (form) form.setAttribute('data-submit-error', 'empty-or-submitting')
      return
    }

    isSubmittingRef.current = true
    setError(null)
    setGatingStatus('evaluating')

    let gateResult: GateResult | null = null

    try {
      const gateUrl = gateApiUrl ?? '/api/ingestion/gate'
      const response = await fetch(gateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          source_id: `chat-${Date.now()}`,
          user_id: undefined,
        }),
      })

      setGatingStatus('routing')

      if (response.ok) {
        const data = (await response.json()) as {
          accepted: boolean
          report: {
            blocked: boolean
            passed: boolean
            gates: Record<string, { decision: string; reason: string } | null>
          }
        }

        if (data.report.blocked || !data.accepted) {
          const gate1Crisis = data.report.gates?.['gate1']
          setGatingStatus('blocked')
          gateResult = {
            decision: 'block',
            reason:
              gate1Crisis && typeof gate1Crisis !== 'boolean'
                ? gate1Crisis.reason
                : 'Safety gate blocked this message.',
            suggestedTags: [],
            anomalyDetected: true,
          }
        } else {
          setGatingStatus('verified')
          gateResult = {
            decision: 'auto',
            reason: 'Gate verified.',
            suggestedTags: [],
            anomalyDetected: false,
          }
        }
      } else {
        throw new Error(`Gate API returned ${response.status}`)
      }
    } catch {
      setGatingStatus('idle')
      const syncResult = evaluateChatGate(trimmed)
      if (syncResult.decision === 'block') {
        gateResult = syncResult
      }
    }

    if (gateResult?.decision === 'block') {
      if (form) form.setAttribute('data-submit-blocked', gateResult.reason)
      setBlockedGate(gateResult)
      isSubmittingRef.current = false
      return
    }

    if (form) form.setAttribute('data-submit-passed', 'true')
    setBlockedGate(null)
    setGatingStatus('idle')
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
    textarea.value = ''
    if (helper) helper.value = ''
    isSubmittingRef.current = false
  }, [gateApiUrl])

  const handleSubmitRef = useRef<() => Promise<void>>(handleSubmit)
  useEffect(() => {
    handleSubmitRef.current = handleSubmit
    if (typeof window === 'undefined') return
    const gateWindow = window as typeof window & {
      handleTherapyGateSubmit?: () => void
      pixelatedSubmit?: () => void
    }
    gateWindow.handleTherapyGateSubmit = () => handleSubmitRef.current()
    gateWindow.pixelatedSubmit = () => handleSubmitRef.current()
  }, [])

  return (
    <div
      className={cn('flex h-full min-h-[28rem] flex-col gap-4', className)}
      data-testid="therapy-gate-chat"
    >
      <div
        className="flex-1 space-y-3 overflow-y-auto rounded-none border border-border bg-card p-4"
        data-testid="chat-history"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
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
                'max-w-[85%] rounded-none px-4 py-3 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto'
                  : 'bg-secondary text-foreground mr-auto',
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
          className="rounded-none border border-ring bg-secondary px-4 py-3 text-foreground"
        >
          <p className="font-semibold">Message blocked for safety</p>
          <p data-testid="gate-result-reason" className="mt-1 text-sm">
            {blockedGate.reason}
          </p>
        </div>
      ) : null}

      {gatingStatus !== 'idle' && gatingStatus !== 'blocked' ? (
        <div
          data-testid="gating-status"
          className={cn(
            'flex items-center gap-2 rounded-none border px-4 py-2 text-sm',
            gatingStatus === 'evaluating'
              ? 'border-ring bg-secondary text-foreground'
              : gatingStatus === 'routing'
                ? 'border-ring bg-secondary text-foreground'
                : 'border-input bg-card text-foreground',
          )}
        >
          {gatingStatus === 'evaluating' ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-none bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-none bg-primary" />
            </span>
          ) : gatingStatus === 'routing' ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-none bg-muted-foreground opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-none bg-muted-foreground" />
            </span>
          ) : (
            <span className="relative inline-flex h-3 w-3 rounded-none bg-primary" />
          )}
          <span className="font-medium">
            {gatingStatus === 'evaluating'
              ? 'Running safety evaluation...'
              : gatingStatus === 'routing'
                ? 'Routing through gate pipeline...'
                : 'Safety gate verified'}
          </span>
        </div>
      ) : null}

      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <input
          ref={inputHelperRef}
          type="text"
          data-testid="gate-input-helper"
          aria-hidden="true"
          className="hidden"
        />
        <textarea
          defaultValue=""
          placeholder="Type your message..."
          rows={2}
          data-testid="message-input"
          disabled={gatingStatus !== 'idle'}
          className={cn(
            'border-input min-h-[3rem] flex-1 resize-none rounded-none border px-3 py-2 text-sm outline-none focus:ring-2',
            gatingStatus !== 'idle'
              ? 'opacity-35 cursor-not-allowed bg-secondary'
              : 'focus:border-ring focus:ring-ring/50',
          )}
        />
        <button
          type="submit"
          ref={buttonRef}
          data-testid="send-button"
          disabled={gatingStatus !== 'idle'}
          className={cn(
            'rounded-none px-4 py-2 text-sm font-medium transition-colors',
            gatingStatus !== 'idle'
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-accent',
          )}
        >
          {gatingStatus !== 'idle' ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Verifying
            </span>
          ) : (
            'Send'
          )}
        </button>
      </form>

      {error ? (
        <p
          data-testid="gate-error"
          className="mt-1 text-xs font-semibold text-foreground"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
