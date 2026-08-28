import { CloudOff, MessageSquare, Plus, Send, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  offlineSyncService,
  type QueuedMessage,
} from '@/lib/ehr-native/services/offline-sync.service'

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
  const [isOnline, setIsOnline] = useState(true)
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])

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
      // If offline, preserve any cached/optimistic threads
      if (navigator.onLine) {
        setError(err instanceof Error ? err.message : 'Failed to load threads')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const status = offlineSyncService.getStatus()
    setIsOnline(status.isOnline)
    setQueuedMessages(offlineSyncService.getQueuedMessages())

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
        if (!cancelled && navigator.onLine)
          setError(
            err instanceof Error ? err.message : 'Failed to load threads',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const unsubOnline = offlineSyncService.on('online', () => {
      setIsOnline(true)
      void fetchThreads()
    })
    const unsubOffline = offlineSyncService.on('offline', () => setIsOnline(false))
    const unsubQueue = offlineSyncService.on('itemQueued', () => {
      setQueuedMessages(offlineSyncService.getQueuedMessages())
    })

    return () => {
      cancelled = true
      unsubOnline()
      unsubOffline()
      unsubQueue()
    }
  }, [fetchThreads])

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
    const text = messageBody.trim()

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline')
      }
      const res = await fetch(`/api/portal/v1/messaging/${activeThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to send message')
      }
      const result = (await res.json()) as { data: MessageThread }
      setActiveThread(result.data)
      setMessageBody('')
    } catch {
      // Offline fallback: queue message and update optimistic state
      await offlineSyncService.queueMessage({
        threadId: activeThread.id,
        recipientReference:
          activeThread.participantReferences[0]?.reference ??
          'Practitioner/assigned',
        senderReference: 'Patient/current',
        body: text,
      })
      const optimisticMsg: ThreadMessage = {
        id: `offline_msg_${Date.now()}`,
        senderReference: 'Patient/current',
        recipientReference:
          activeThread.participantReferences[0]?.reference ??
          'Practitioner/assigned',
        body: text,
        sentAt: new Date().toISOString(),
        status: 'pending',
      }
      setActiveThread({
        ...activeThread,
        messages: [...activeThread.messages, optimisticMsg],
      })
      setMessageBody('')
      setQueuedMessages(offlineSyncService.getQueuedMessages())
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
    const subj = subject.trim()
    const pracRef = practitionerRef.trim()
    const msg = initialMessage.trim()

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline')
      }
      const res = await fetch('/api/portal/v1/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subj,
          practitionerReference: `Practitioner/${pracRef}`,
          initialMessage: msg,
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
    } catch {
      // Offline fallback: queue thread creation
      await offlineSyncService.queueMessage({
        subject: subj,
        recipientReference: `Practitioner/${pracRef}`,
        senderReference: 'Patient/current',
        body: msg,
      })
      setShowNewModal(false)
      setSubject('')
      setPractitionerRef('')
      setInitialMessage('')

      const optimisticThread: ThreadSummary = {
        threadId: `offline_th_${Date.now()}`,
        subject: subj,
        messageCount: 1,
        lastMessageAt: new Date().toISOString(),
        participants: [{ reference: `Practitioner/${pracRef}` }],
      }
      setThreads((prev) => [optimisticThread, ...prev])
      setQueuedMessages(offlineSyncService.getQueuedMessages())
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
          className="h-6 w-6 animate-spin rounded-full border-2"
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
            className="flex min-h-[44px] items-center text-sm"
            style={{ color: 'var(--np-muted)' }}
          >
            ← Back to threads
          </button>
          <button
            onClick={() => void handleDeleteThread(activeThread.id)}
            className="flex min-h-[44px] items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors"
            style={{
              background: 'var(--np-elevated)',
              color: 'var(--np-muted)',
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
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
            className="border-b px-4 py-3"
            style={{ borderColor: 'var(--np-line)' }}
          >
            <h3
              className="text-base font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {activeThread.subject}
            </h3>
          </div>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
            {threadLoading ? (
              <p
                className="text-center text-sm"
                style={{ color: 'var(--np-muted)' }}
              >
                Loading messages...
              </p>
            ) : activeThread.messages.length === 0 ? (
              <p
                className="text-center text-sm"
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
                    className="max-w-[75%] rounded-lg px-3 py-2 text-sm"
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
                      {msg.status === 'pending' && ' (Queued offline)'}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex gap-2 border-t px-4 py-3"
            style={{ borderColor: 'var(--np-line)' }}
          >
            <input
              type="text"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[44px] min-w-0 flex-1 rounded border-0 px-3 py-2 text-sm"
              style={{
                background: 'var(--np-elevated)',
                color: 'var(--np-text)',
              }}
            />
            <button
              type="submit"
              disabled={sendingMessage || !messageBody.trim()}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--np-text)', color: 'var(--np-bg)' }}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {error && (
          <div
            className="rounded p-3 text-sm"
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
          <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--np-muted)' }}>
            <span>Communicate with your care team</span>
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                <CloudOff className="h-3.5 w-3.5" /> Offline Mode
              </span>
            )}
            {queuedMessages.length > 0 && (
              <span className="text-xs text-amber-400 font-medium">
                ({queuedMessages.length} queued)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
          aria-label="New Message Thread"
        >
          <Plus className="h-4 w-4" />
          <span>New Thread</span>
        </button>
      </div>

      {error && (
        <div
          className="rounded p-4 text-sm"
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
          className="rounded py-12 text-center"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <MessageSquare
            className="mx-auto mb-3 h-8 w-8"
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
              className="min-h-[44px] w-full rounded p-4 text-left transition-colors"
              style={{
                background: 'var(--np-surface)',
                border: '1px solid var(--np-line)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--np-text)' }}
                  >
                    {thread.subject}
                  </h3>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--np-muted)' }}
                  >
                    {thread.messageCount} messages · Last:{' '}
                    {formatTime(thread.lastMessageAt)}
                  </p>
                </div>
                <MessageSquare
                  className="h-4 w-4 flex-shrink-0"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg p-6"
            style={{
              background: 'var(--np-elevated)',
              border: '1px solid var(--np-line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                className="text-lg font-semibold"
                style={{ color: 'var(--np-text)' }}
              >
                New Message Thread
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ color: 'var(--np-muted)' }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm"
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
                  className="min-h-[44px] w-full rounded border-0 px-3 py-2 text-sm"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-text)',
                  }}
                  placeholder="Message subject"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm"
                  style={{ color: 'var(--np-muted)' }}
                >
                  Practitioner ID
                </label>
                <input
                  type="text"
                  value={practitionerRef}
                  onChange={(e) => setPractitionerRef(e.target.value)}
                  required
                  className="min-h-[44px] w-full rounded border-0 px-3 py-2 text-sm"
                  style={{
                    background: 'var(--np-surface)',
                    color: 'var(--np-text)',
                  }}
                  placeholder="e.g. practitioner-uuid"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm"
                  style={{ color: 'var(--np-muted)' }}
                >
                  Message
                </label>
                <textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full resize-none rounded border-0 px-3 py-2 text-sm"
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
                  className="min-h-[44px] rounded px-4 py-2 text-sm transition-colors"
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
                  className="min-h-[44px] rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
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
