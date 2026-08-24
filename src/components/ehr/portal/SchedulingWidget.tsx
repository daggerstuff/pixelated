import { Calendar, Clock, Plus, X } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

interface Appointment {
  id: string
  start: string
  end: string
  status: string
  practitionerName?: string
  reason?: string
  appointmentType?: string
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { limit: number; offset: number; total?: number }
}

interface ErrorResponse {
  error: { code: string; message: string }
}

const TIME_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
]

const PRACTITIONERS = [
  { id: 'practitioner-1', name: 'Dr. Sarah Chen' },
  { id: 'practitioner-2', name: 'Dr. Michael Rodriguez' },
  { id: 'practitioner-3', name: 'Dr. Emily Park' },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SchedulingWidget() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form state
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedPractitioner, setSelectedPractitioner] = useState('')
  const [reason, setReason] = useState('')

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/v1/scheduling')
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to load appointments')
      }
      const result = (await res.json()) as PaginatedResponse<Appointment>
      setAppointments(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/portal/v1/scheduling')
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load appointments')
        }
        if (!cancelled) {
          const result = (await res.json()) as PaginatedResponse<Appointment>
          if (!cancelled) setAppointments(result.data)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load appointments')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime || !selectedPractitioner || !reason) return

    setSubmitting(true)
    try {
      const start = new Date(`${selectedDate}T${selectedTime}:00`)
      const end = new Date(start.getTime() + 60 * 60 * 1000) // 1 hour

      const fhirResource = {
        resourceType: 'Appointment',
        status: 'booked',
        start: start.toISOString(),
        end: end.toISOString(),
        participant: [
          { actor: { reference: `Practitioner/${selectedPractitioner}` } },
        ],
        description: reason,
      }

      const res = await fetch('/api/portal/v1/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fhirResource }),
      })

      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to schedule appointment')
      }

      setShowModal(false)
      setSelectedDate('')
      setSelectedTime('')
      setSelectedPractitioner('')
      setReason('')
      await fetchAppointments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (appointmentId: string) => {
    setActionLoading(appointmentId)
    try {
      const res = await fetch(`/api/portal/v1/scheduling/${appointmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to cancel')
      }
      await fetchAppointments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--np-muted)', borderTopColor: 'var(--np-text)' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--np-text)' }}>
            Appointments
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--np-muted)' }}>
            View and manage your upcoming sessions
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors"
          style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
        >
          <Plus className="w-4 h-4" />
          Schedule New
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

      {appointments.length === 0 ? (
        <div
          className="text-center py-12 rounded"
          style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
        >
          <Calendar className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--np-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
            No appointments scheduled. Click "Schedule New" to book a session.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="p-4 rounded"
              style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--np-muted)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--np-text)' }}>
                      {formatDate(apt.start)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'var(--np-elevated)', color: 'var(--np-muted)' }}
                    >
                      {apt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--np-muted)' }}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(apt.start)} – {formatTime(apt.end)}
                    </span>
                    {apt.practitionerName && <span>{apt.practitionerName}</span>}
                  </div>
                  {apt.reason && (
                    <p className="text-sm mt-2" style={{ color: 'var(--np-muted)' }}>
                      {apt.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void handleCancel(apt.id)}
                  disabled={actionLoading === apt.id}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  style={{
                    background: 'var(--np-elevated)',
                    color: 'var(--np-muted)',
                  }}
                >
                  {actionLoading === apt.id ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule New Appointment Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--np-overlay)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--np-elevated)', border: '1px solid var(--np-line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--np-text)' }}>
                Schedule Appointment
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ color: 'var(--np-muted)' }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--np-muted)' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded border-0"
                  style={{ background: 'var(--np-surface)', color: 'var(--np-text)' }}
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--np-muted)' }}>
                  Time Slot
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className="px-2 py-1.5 text-xs rounded transition-colors"
                      style={{
                        background:
                          selectedTime === slot ? 'var(--np-text)' : 'var(--np-surface)',
                        color: selectedTime === slot ? 'var(--np-bg)' : 'var(--np-muted)',
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--np-muted)' }}>
                  Practitioner
                </label>
                <select
                  value={selectedPractitioner}
                  onChange={(e) => setSelectedPractitioner(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded border-0"
                  style={{ background: 'var(--np-surface)', color: 'var(--np-text)' }}
                >
                  <option value="">Select practitioner</option>
                  {PRACTITIONERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--np-muted)' }}>
                  Reason for Visit
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded border-0 resize-none"
                  style={{ background: 'var(--np-surface)', color: 'var(--np-text)' }}
                  placeholder="Briefly describe what you'd like to discuss..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded transition-colors"
                  style={{ background: 'var(--np-surface)', color: 'var(--np-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50"
                  style={{ background: 'var(--np-text)', color: 'var(--np-bg)' }}
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
