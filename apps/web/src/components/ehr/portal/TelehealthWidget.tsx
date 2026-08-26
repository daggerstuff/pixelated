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
          className="h-6 w-6 animate-spin rounded-full border-2"
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
        <p className="mt-1 text-sm" style={{ color: 'var(--np-muted)' }}>
          Join your virtual appointments
        </p>
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

      {appointments.length === 0 ? (
        <div
          className="rounded py-12 text-center"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <Video
            className="mx-auto mb-3 h-8 w-8"
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
                className="rounded p-4"
                style={{
                  background: 'var(--np-surface)',
                  border: '1px solid var(--np-line)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Video
                        className="h-4 w-4 flex-shrink-0"
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
                          className="animate-pulse rounded px-2 py-0.5 text-xs"
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
                        <Clock className="h-3.5 w-3.5" />
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
                        className="mt-2 text-sm"
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
                        className="flex min-h-[44px] items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors"
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
                        <Video className="h-4 w-4" />
                        {joinedId === apt.id ? 'Joined' : 'Join'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span
                        className="rounded px-3 py-2 text-xs"
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
