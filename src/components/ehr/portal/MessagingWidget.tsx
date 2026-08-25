import { MessageSquare, Plus, Send, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface ThreadMessage {
  id: string
  senderReference: string
  recipientReference: string
  body: string
  sentAt: string
  status: string
}

interface MessageThread {
  id: string
  patientId: string
  subject: string
  participantReferences: Array<{ reference: string; display?: string }>
  messages: ThreadMessage[]
  createdAt: string
  updatedAt: string
}

interface ThreadSummary {
  threadId: string
  subject: string
  messageCount: number
  lastMessageAt: string
  participants: Array<{ reference: string; display?: string }>
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { limit: number; offset: number; total?: number }
}

interface ErrorResponse {
  error: { code: string; message: string }
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function senderDisplay(ref: string): string {
  if (ref.startsWith('Patient/')) return 'You'
  if (ref.startsWith('Practitioner/'))
    return ref.replace('Practitioner/', 'Dr. ')
  return ref
}

export function MessagingWidget() {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // New thread form state
  const [subject, setSubject] = useState('')
  const [practitionerRef, setPractitionerRef] = useState('')
  const [initialMessage, setInitialMessage] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/v1/messaging')
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to load threads')
      }
      const result = (await res.json()) as PaginatedResponse<ThreadSummary>
      setThreads(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/portal/v1/messaging')
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load threads')
        }
        if (!cancelled) {
          const result = (await res.json()) as PaginatedResponse<ThreadSummary>
          if (!cancelled) setThreads(result.data)
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load threads',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openThread = async (threadId: string) => {
    setThreadLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/v1/messaging/${threadId}`)
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to load thread')
      }
      const result = (await res.json()) as { data: MessageThread }
      setActiveThread(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setThreadLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageBody.trim() || !activeThread) return
    setSendingMessage(true)
    try {
      const res = await fetch(`/api/portal/v1/messaging/${activeThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: messageBody.trim(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to send message')
      }
      const result = (await res.json()) as { data: MessageThread }
      setActiveThread(result.data)
      setMessageBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    try {
      const res = await fetch(`/api/portal/v1/messaging/${threadId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to delete thread')
      }
      setActiveThread(null)
      await fetchThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete thread')
    }
  }

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !practitionerRef.trim() || !initialMessage.trim())
      return
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/v1/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          practitionerReference: `Practitioner/${practitionerRef.trim()}`,
          initialMessage: initialMessage.trim(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to create thread')
      }
      setShowNewModal(false)
      setSubject('')
      setPractitionerRef('')
      setInitialMessage('')
      await fetchThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.messages.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{
            borderColor: 'var(--np-muted)',
            borderTopColor: 'var(--np-text)',
          }}
        />
      </div>
    )
  }

  if (activeThread) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveThread(null)}
            className="text-sm"
            style={{ color: 'var(--np-muted)' }}
          >
            ← Back to threads
          </button>
          <button
            onClick={() => void handleDeleteThread(activeThread.id)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              background: 'var(--np-elevated)',
              color: 'var(--np-muted)',
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        <div
          className="rounded"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--np-line)' }}
          >
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {activeThread.subject}
            </h3>
          </div>

          <div className="max-h-[50vh] overflow-y-auto px-4 py-4 space-y-3">
            {threadLoading ? (
              <p
                className="text-sm text-center"
                style={{ color: 'var(--np-muted)' }}
              >
                Loading messages...
              </p>
            ) : activeThread.messages.length === 0 ? (
              <p
                className="text-sm text-center"
                style={{ color: 'var(--np-muted)' }}
              >
                No messages yet.
              </p>
            ) : (
              activeThread.messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col"
                  style={{
                    alignItems: msg.senderReference.startsWith('Patient/')
                      ? 'flex-end'
                      : 'flex-start',
                  }}
                >
                  <div
                    className="max-w-[75%] px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: msg.senderReference.startsWith('Patient/')
                        ? 'var(--np-elevated)'
                        : 'var(--np-surface)',
                      color: 'var(--np-text)',
                      border: '1px solid var(--np-line)',
                    }}
                  >
                    <p className="mb-1">{msg.body}</p>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      {senderDisplay(msg.senderReference)} ·{' '}
                      {formatTime(msg.sentAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex gap-2 px-4 py-3 border-t"
            style={{ borderColor: 'var(--np-line)' }}
          >
            <input
              type="text"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded border-0"
              style={{
                background: 'var(--np-elevated)',
                color: 'var(--np-text)',
              }}
            />
            <button
              type="submit"
              disabled={sendingMessage || !messageBody.trim()}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50"
              style={{ background: 'var(--np-text)', color: 'var(--np-bg)' }}
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>

        {error && (
          <div
            className="p-3 text-sm rounded"
            style={{
              background: 'var(--np-surface)',
              color: 'var(--np-text)',
              border: '1px solid var(--np-line)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-semibold"
            style={{ color: 'var(--np-text)' }}
          >
            Secure Messages
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--np-muted)' }}>
            Communicate with your care team
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors"
          style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
        >
          <Plus className="w-4 h-4" />
          New Thread
        </button>
      </div>

      {error && (
        <div
          className="p-4 text-sm rounded"
          style={{
            background: 'var(--np-surface)',
            color: 'var(--np-text)',
            border: '1px solid var(--np-line)',
          }}
        >
          {error}
        </div>
      )}

      {threads.length === 0 ? (
        <div
          className="text-center py-12 rounded"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <MessageSquare
            className="w-8 h-8 mx-auto mb-3"
            style={{ color: 'var(--np-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
            No message threads. Click "New Thread" to start a conversation.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.threadId}
              onClick={() => void openThread(thread.threadId)}
              className="w-full text-left p-4 rounded transition-colors"
              style={{
                background: 'var(--np-surface)',
                border: '1px solid var(--np-line)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--np-text)' }}
                  >
                    {thread.subject}
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--np-muted)' }}
                  >
                    {thread.messageCount} messages · Last:{' '}
                    {formatTime(thread.lastMessageAt)}
                  </p>
                </div>
                <MessageSquare
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--np-muted)' }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--np-overlay)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--np-elevated)',
              border: '1px solid var(--np-line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-semibold"
                style={{ color: 'var(--np-text)' }}
              >
                New Message Thread
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ color: 'var(--np-muted)' }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--np-muted)' }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm rounded border-0"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-text)',
                  }}
                  placeholder="Message subject"
                />
              </div>

              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--np-muted)' }}
                >
                  Practitioner ID
                </label>
                <input
                  type="text"
                  value={practitionerRef}
                  onChange={(e) => setPractitionerRef(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded border-0"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-text)',
                  }}
                  placeholder="e.g. practitioner-uuid"
                />
              </div>

              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ color: 'var(--np-muted)' }}
                >
                  Message
                </label>
                <textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded border-0 resize-none"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-text)',
                  }}
                  placeholder="Type your message..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm rounded transition-colors"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-muted)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50"
                  style={{
                    background: 'var(--np-text)',
                    color: 'var(--np-bg)',
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
