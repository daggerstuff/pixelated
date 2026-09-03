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

      {gatingStatus !== 'idle' && gatingStatus !== 'blocked' ? (
        <div
          data-testid="gating-status"
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm shadow-sm',
            gatingStatus === 'evaluating'
              ? 'border-blue-300 bg-blue-50 text-blue-900'
              : gatingStatus === 'routing'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-green-300 bg-green-50 text-green-900',
          )}
        >
          {gatingStatus === 'evaluating' ? (
            <span className="relative flex h-3 w-3">
              <span className="bg-blue-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-blue-500 relative inline-flex h-3 w-3 rounded-full" />
            </span>
          ) : gatingStatus === 'routing' ? (
            <span className="relative flex h-3 w-3">
              <span className="bg-amber-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-amber-500 relative inline-flex h-3 w-3 rounded-full" />
            </span>
          ) : (
            <span className="bg-green-500 relative inline-flex h-3 w-3 rounded-full" />
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
            'border-slate-300 min-h-[3rem] flex-1 resize-none rounded-lg border px-3 py-2 text-sm shadow-inner outline-none focus:ring-2',
            gatingStatus !== 'idle'
              ? 'opacity-50 cursor-not-allowed bg-slate-50'
              : 'focus:border-blue-500 focus:ring-blue-200',
          )}
        />
        <button
          type="submit"
          ref={buttonRef}
          data-testid="send-button"
          disabled={gatingStatus !== 'idle'}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            gatingStatus !== 'idle'
              ? 'bg-slate-400 text-slate-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
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
        <p data-testid="gate-error" className="text-red-600 mt-1 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
}
