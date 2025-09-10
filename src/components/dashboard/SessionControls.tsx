// Replaced entire file with a single authoritative implementation to remove merge residues.
import React from 'react'
import { useEffect, useRef } from 'react'
import type { TherapistSession } from '@/types/dashboard'
import { cn } from '@/lib/utils'

interface SessionControlsProps {
  sessions: TherapistSession[]
  onSessionControl: (sessionId: string, action: 'start' | 'pause' | 'resume' | 'end') => void
}

export default function SessionControls({ sessions, onSessionControl }: SessionControlsProps) {
  const activeSession = sessions.find((s) => s.status === 'active')
  const pausedSession = sessions.find((s) => s.status === 'paused')

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const handleControlClick = (action: 'start' | 'pause' | 'resume' | 'end', sessionId?: string) => {
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

  const fmt = (iso?: string) => {
    if (!iso) {
      return ''
    }
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <section className="space-y-4" aria-label="Session Controls">
      <h3 className="text-lg font-semibold">Session Controls</h3>

      <div className="flex gap-2">
        <button
          type="button"
          ref={(el) => { buttonRefs.current['pause'] = el }}
          onClick={() => activeSession && handleControlClick('pause', activeSession.id)}
          disabled={!activeSession}
          className={cn(activeSession ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500', 'px-3 py-2 rounded')}
        >
          Pause
        </button>

        <button
          type="button"
          ref={(el) => { buttonRefs.current['resume'] = el }}
          onClick={() => pausedSession && handleControlClick('resume', pausedSession.id)}
          disabled={!pausedSession}
          className={cn(pausedSession ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500', 'px-3 py-2 rounded')}
        >
          Resume
        </button>

        <button
          type="button"
          ref={(el) => { buttonRefs.current['end'] = el }}
          onClick={() => activeSession && handleControlClick('end', activeSession.id)}
          disabled={!activeSession}
          className={cn(activeSession ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500', 'px-3 py-2 rounded')}
        >
          End
        </button>
      </div>

      <div>
        <h4 className="text-md font-medium">Recent Sessions</h4>
        {sessions.length === 0 ? (
          <div className="text-sm italic">No recent sessions</div>
        ) : (
          <ul>
            {sessions.slice(0, 3).map((s) => (
              <li key={s.id} className="flex justify-between items-center p-2 rounded border">
                <div>
                  <div className="text-sm font-medium">Session {s.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{fmt(s.startTime)}</div>
                </div>
                <span className={cn('px-2 py-1 text-xs rounded', s.status === 'active' ? 'bg-green-100' : 'bg-gray-100')}>
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
