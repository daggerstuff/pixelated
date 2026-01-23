// Replaced entire file with a single authoritative implementation to remove merge residues.
import React, { useState, useEffect, useRef } from 'react'
import type { TherapistSession } from '@/types/dashboard'
import { cn } from '@/lib/utils'

interface SessionControlsProps {
  sessions: TherapistSession[]
  onSessionControl: (
    sessionId: string,
    action: 'start' | 'pause' | 'resume' | 'end',
  ) => void
}

export function SessionControls({
  sessions,
  onSessionControl,
}: SessionControlsProps) {
  const activeSession = sessions.find((s) => s.status === 'active')
  const pausedSession = sessions.find((s) => s.status === 'paused')

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Focus management for keyboard navigation
  const [, setFocusedButton] = useState<string | null>(null)

  const handleControlClick = (
    action: 'start' | 'pause' | 'resume' | 'end',
    sessionId?: string,
  ) => {
    if (!sessionId) {
      return
    }
    onSessionControl(sessionId, action)
    const btn = buttonRefs.current[action]
    if (btn) {
      btn.blur()
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        Object.values(buttonRefs.current).forEach((b) => b?.blur())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Keyboard event handling for session controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Blur all buttons when Escape is pressed
        Object.values(buttonRefs.current).forEach((button) => {
          button?.blur()
        })
        setFocusedButton(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <section className="space-y-4" aria-label="Session Controls">
      <h3 className="text-lg font-semibold">Session Controls</h3>

      <div className="flex gap-2" role="group">
        <button
          type="button"
          ref={(el) => {
            buttonRefs.current['pause'] = el
          }}
          onClick={() =>
            activeSession && handleControlClick('pause', activeSession.id)
          }
          disabled={!activeSession}
          className={cn(
            activeSession
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500',
            'px-3 py-2 rounded',
          )}
        >
          Pause Session
        </button>

        <button
          type="button"
          ref={(el) => {
            buttonRefs.current['resume'] = el
          }}
          onClick={() =>
            pausedSession && handleControlClick('resume', pausedSession.id)
          }
          disabled={!pausedSession}
          className={cn(
            pausedSession
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-500',
            'px-3 py-2 rounded',
          )}
        >
          Resume Session
        </button>

        <button
          type="button"
          ref={(el) => {
            buttonRefs.current['end'] = el
          }}
          onClick={() =>
            activeSession && handleControlClick('end', activeSession.id)
          }
          disabled={!activeSession}
          className={cn(
            activeSession
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-500',
            'px-3 py-2 rounded',
          )}
        >
          End Session
        </button>
      </div>

      <div>
        <h4 className="text-md font-medium">Recent Sessions</h4>
        {sessions.length === 0 ? (
          <div className="text-sm italic">No recent sessions available</div>
        ) : (
          <ul className="space-y-2" role="list">
            {sessions.slice(0, 3).map((session) => (
              <li
                key={session.id}
                className={cn(
                  'flex items-center justify-between p-3 bg-background rounded border transition-colors',
                  'hover:bg-muted/50',
                )}
                role="listitem"
                aria-label={`Session ${session.id}, status: ${session.status}`}
              >
                <div>
                  <div className="text-sm font-medium">
                    Session {session.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(session.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {session.endTime && (
                    <div className="text-xs text-muted-foreground">
                      Ended:{' '}
                      {new Date(session.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'px-2 py-1 text-xs rounded-full whitespace-nowrap',
                    session.status === 'active' &&
                    'bg-green-100 text-green-800',
                    session.status === 'paused' &&
                    'bg-yellow-100 text-yellow-800',
                    session.status === 'completed' &&
                    'bg-blue-100 text-blue-800',
                    session.status === 'cancelled' && 'bg-red-100 text-red-800',
                  )}
                >
                  {session.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SessionControls
