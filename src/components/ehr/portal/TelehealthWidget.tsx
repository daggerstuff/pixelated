import { Clock, ExternalLink, Video } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface Appointment {
  id: string
  start: string
  end: string
  status: string
  practitionerName?: string
  appointmentType?: string
  reason?: string
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isWithinRange(start: string, end: string): boolean {
  const now = new Date()
  const s = new Date(start)
  const e = new Date(end)
  // Allow joining 10 minutes before start
  const joinWindow = new Date(s.getTime() - 10 * 60 * 1000)
  return now >= joinWindow && now <= e
}

export function TelehealthWidget() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinedId, setJoinedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const res = await fetch('/api/portal/v1/scheduling?status=booked')
        if (!res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load appointments')
        }
        const result = (await res.json()) as PaginatedResponse<Appointment>
        // Filter to upcoming/active telehealth-eligible appointments
        const now = new Date()
        const upcoming = result.data.filter((a) => new Date(a.end) >= now)
        setAppointments(upcoming)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    void fetchAppointments()
  }, [])

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

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--np-text)' }}
        >
          Telehealth
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--np-muted)' }}>
          Join your virtual appointments
        </p>
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

      {appointments.length === 0 ? (
        <div
          className="text-center py-12 rounded"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <Video
            className="w-8 h-8 mx-auto mb-3"
            style={{ color: 'var(--np-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
            No upcoming telehealth appointments. Schedule one from the
            Scheduling page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const canJoin = isWithinRange(apt.start, apt.end)
            const isLive = canJoin && new Date() >= new Date(apt.start)
            return (
              <div
                key={apt.id}
                className="p-4 rounded"
                style={{
                  background: 'var(--np-surface)',
                  border: '1px solid var(--np-line)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Video
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: 'var(--np-muted)' }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--np-text)' }}
                      >
                        {formatTime(apt.start)}
                      </span>
                      {isLive && (
                        <span
                          className="text-xs px-2 py-0.5 rounded animate-pulse"
                          style={{
                            background: 'var(--np-danger, #ef4444)',
                            color: '#fff',
                          }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-3 text-sm"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(apt.start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' – '}
                        {new Date(apt.end).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {apt.practitionerName && (
                        <span>{apt.practitionerName}</span>
                      )}
                    </div>
                    {apt.reason && (
                      <p
                        className="text-sm mt-2"
                        style={{ color: 'var(--np-muted)' }}
                      >
                        {apt.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {canJoin ? (
                      <a
                        href={`/portal/telehealth/join?id=${apt.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setJoinedId(apt.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors min-h-[44px]"
                        style={{
                          background:
                            joinedId === apt.id
                              ? 'var(--np-elevated)'
                              : 'var(--np-text)',
                          color:
                            joinedId === apt.id
                              ? 'var(--np-text)'
                              : 'var(--np-bg)',
                        }}
                      >
                        <Video className="w-4 h-4" />
                        {joinedId === apt.id ? 'Joined' : 'Join'}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span
                        className="text-xs px-3 py-2 rounded"
                        style={{
                          background: 'var(--np-elevated)',
                          color: 'var(--np-muted)',
                        }}
                      >
                        Joining available 10 min before start
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
