import React, { useState } from 'react'

import { useConversationMemory } from '../hooks/useConversationMemory'
import { tokens } from '../lib/design-tokens'
import { cn } from '../lib/utils'
import { ProgressBar } from './dashboard/ProgressBar'

interface TrainingSessionProps {
  className?: string
}

function AIErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError] = useState(false)
  const [error] = useState<Error | null>(null)

  if (hasError) {
    return (
      <div
        role='alert'
        className='bg-destructive text-destructive-foreground rounded-md p-4'
      >
        <strong>AI Service Error:</strong>{' '}
        {error?.message || 'The AI service is temporarily unavailable.'}
      </div>
    )
  }

  return children
}

function TrainingSession({ className }: TrainingSessionProps) {
  const {
    memory,
    setSessionState,
    setProgress,
    addProgressSnapshot,
    addMessage,
  } = useConversationMemory()

  const [clientInput, setClientInput] = useState('')
  const [clientResponse, setClientResponse] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Session control types
  const SESSION_CONTROLS = [
    { key: 'start', label: 'Start Session' },
    { key: 'pause', label: 'Pause' },
    { key: 'resume', label: 'Resume' },
    { key: 'end', label: 'End Session' },
  ]

  // Control handlers
  const handleControl = (control: string) => {
    switch (control) {
      case 'start':
        setSessionState('active')
        setProgress(0)
        addProgressSnapshot(0)
        break
      case 'pause':
        setSessionState('paused')
        break
      case 'resume':
        setSessionState('active')
        break
      case 'end':
        setSessionState('ended')
        setProgress(100)
        addProgressSnapshot(100)
        break
      default:
        break
    }
  }

  // Send therapist message to mock client API
  const sendToMockClient = async (message: string) => {
    setIsLoading(true)
    try {
      // Add therapist message to conversation memory
      addMessage('therapist', message)

      const res = await fetch('/api/mock-client-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()

      // Add client response to conversation memory
      if (data.response) {
        addMessage('client', data.response)
      }

      setClientResponse(data.response || '')

      // Update progress based on conversation flow
      const newProgress = Math.min(100, memory.progress + 10)
      setProgress(newProgress)
      if (newProgress % 25 === 0) {
        addProgressSnapshot(newProgress)
      }
    } catch {
      setClientResponse('Error getting response')
    } finally {
      setIsLoading(false)
    }
  }

  // Feedback submission handler
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch('/api/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'demo-session', feedback }),
      })
    } catch (err) {
      console.error('Error submitting feedback:', err)
    }
  }

  return (
    <AIErrorBoundary>
      <section
        aria-label='Therapist Training Session'
        className={cn(
          'max-w-xl mx-auto p-8 bg-background rounded-lg shadow',
          className,
        )}
        style={{ background: tokens.colors.background }}
      >
        <header>
          <h2 className='text-primary mb-6 text-2xl font-bold'>
            Therapist Training Session
          </h2>
        </header>

        {/* Progress Bar */}
        <div className='mb-6'>
          <ProgressBar value={memory.progress} label='Session Progress' />
        </div>

        <nav
          aria-label='Session Controls'
          className='mb-6 flex flex-wrap gap-2'
        >
          {SESSION_CONTROLS.map(({ key, label }) => (
            <button
              key={key}
              type='button'
              onClick={() => handleControl(key)}
              disabled={
                (key === 'start' && memory.sessionState !== 'idle') ||
                (key === 'pause' && memory.sessionState !== 'active') ||
                (key === 'resume' && memory.sessionState !== 'paused') ||
                (key === 'end' && memory.sessionState === 'ended')
              }
              aria-pressed={
                (key === 'start' && memory.sessionState === 'active') ||
                (key === 'pause' && memory.sessionState === 'paused') ||
                (key === 'resume' && memory.sessionState === 'active') ||
                (key === 'end' && memory.sessionState === 'ended')
              }
              className={cn(
                'py-2 px-4 rounded-md font-medium transition-colors',
                'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <main>
          <p className='mb-4'>
            Session State: <strong>{memory.sessionState}</strong>
          </p>

          {memory.sessionState === 'active' && (
            <section
              aria-label='Mock Client Interaction'
              className='mock-client-section mb-6'
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendToMockClient(clientInput)
                }}
                className='client-input-form flex flex-col gap-2'
              >
                <label
                  htmlFor='therapist-message'
                  className='mb-2 block text-sm font-medium'
                >
                  Therapist Message
                </label>
                <input
                  id='therapist-message'
                  type='text'
                  value={clientInput}
                  onChange={(e) => setClientInput(e.target.value)}
                  disabled={isLoading}
                  aria-required='true'
                  className='focus-visible:ring-primary mb-3 w-full rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2'
                />
                <button
                  type='submit'
                  disabled={isLoading || !clientInput}
                  className={cn(
                    'py-2 px-4 rounded-md font-medium transition-colors',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    isLoading || !clientInput
                      ? 'opacity-50 cursor-not-allowed'
                      : '',
                  )}
                  aria-disabled={isLoading || !clientInput}
                >
                  {isLoading ? 'Sending...' : 'Send to Client'}
                </button>
              </form>

              <div className='mt-4'>
                <strong>Client Response:</strong>
                <div className='bg-muted mt-2 min-h-[60px] rounded-md p-3 text-sm'>
                  {clientResponse || 'Waiting for client response...'}
                </div>
              </div>
            </section>
          )}

          {/* Evaluation Feedback Section */}
          <section aria-label='Evaluation Feedback' className='mb-6'>
            <form
              onSubmit={handleFeedbackSubmit}
              className='flex flex-col gap-2'
            >
              <label
                htmlFor='feedback'
                className='mb-2 block text-sm font-medium'
              >
                Evaluation Feedback
              </label>
              <textarea
                id='feedback'
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder='Enter your feedback about the session...'
                className='focus-visible:ring-primary mb-3 w-full rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2'
                rows={3}
              />
              <button
                type='submit'
                className={cn(
                  'py-2 px-4 rounded-md font-medium transition-colors',
                  'bg-accent text-accent-foreground hover:bg-accent/90',
                )}
              >
                Submit Feedback
              </button>
            </form>
          </section>

          {/* Conversation History */}
          {memory.history.length > 0 && (
            <section aria-label='Conversation History' className='mb-6'>
              <h3 className='mb-3 text-lg font-semibold'>
                Conversation History
              </h3>
              <div className='bg-muted max-h-40 overflow-y-auto rounded-md p-3'>
                {memory.history.map((entry, index) => (
                  <div
                    key={index}
                    className={cn(
                      'mb-2 p-2 rounded',
                      entry.role === 'therapist'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800',
                    )}
                  >
                    <strong>
                      {entry.role === 'therapist' ? 'Therapist:' : 'Client:'}
                    </strong>{' '}
                    {entry.message}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </section>
    </AIErrorBoundary>
  )
}

export default TrainingSession
