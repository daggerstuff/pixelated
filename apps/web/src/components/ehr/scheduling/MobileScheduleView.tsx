import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  CloudOff,
  Filter,
  Plus,
  RefreshCw,
  User,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import {
  offlineSyncService,
  type QueuedAppointmentAction,
} from '@/lib/ehr-native/services/offline-sync.service'

export interface ScheduleAppointmentItem {
  id: string
  start: string
  end: string
  status: 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'pending'
  patientName?: string
  patientId: string
  practitionerName?: string
  practitionerId: string
  serviceType?: string
  reason?: string
}

export interface MobileScheduleViewProps {
  initialAppointments?: ScheduleAppointmentItem[]
  currentPractitionerId?: string
  currentPatientId?: string
  onAppointmentClick?: (appointment: ScheduleAppointmentItem) => void
}

const DEFAULT_PRACTITIONERS = [
  { id: 'practitioner-1', name: 'Dr. Sarah Chen' },
  { id: 'practitioner-2', name: 'Dr. Michael Rodriguez' },
  { id: 'practitioner-3', name: 'Dr. Emily Park' },
]

export function MobileScheduleView({
  initialAppointments = [],
  currentPractitionerId = 'practitioner-1',
  currentPatientId = 'patient-1',
  onAppointmentClick,
}: MobileScheduleViewProps) {
  const [appointments, setAppointments] = useState<ScheduleAppointmentItem[]>(initialAppointments)
  const [queuedActions, setQueuedActions] = useState<QueuedAppointmentAction[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [filterView, setFilterView] = useState<'day' | 'upcoming' | 'all'>('day')
  const [isOnline, setIsOnline] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingTime, setBookingTime] = useState('10:00')
  const [bookingReason, setBookingReason] = useState('')
  const [bookingPractitioner, setBookingPractitioner] = useState(currentPractitionerId)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/v1/scheduling?date=${selectedDate}`)
      if (res.ok) {
        const json = (await res.json()) as { data: ScheduleAppointmentItem[] }
        setAppointments(json.data ?? [])
      }
    } catch {
      // Offline fallback: maintain current state
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    const status = offlineSyncService.getStatus()
    setIsOnline(status.isOnline)
    setQueuedActions(offlineSyncService.getQueuedAppointmentActions())

    if (status.isOnline) {
      void fetchAppointments()
    }

    const unsubOnline = offlineSyncService.on('online', () => {
      setIsOnline(true)
      void fetchAppointments()
    })
    const unsubOffline = offlineSyncService.on('offline', () => setIsOnline(false))
    const unsubQueue = offlineSyncService.on('itemQueued', () => {
      setQueuedActions(offlineSyncService.getQueuedAppointmentActions())
    })

    return () => {
      unsubOnline()
      unsubOffline()
      unsubQueue()
    }
  }, [fetchAppointments])

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !bookingTime) return

    const start = `${selectedDate}T${bookingTime}:00Z`
    const end = `${selectedDate}T${bookingTime}:50:00Z`

    // Queue action via offline sync service
    const action = await offlineSyncService.queueAppointmentAction({
      actionType: 'create',
      patientId: currentPatientId,
      practitionerId: bookingPractitioner,
      start,
      end,
      reason: bookingReason || 'Routine Consultation',
    })

    // Optimistically add to appointments list
    const optimisticItem: ScheduleAppointmentItem = {
      id: action.id,
      patientId: currentPatientId,
      practitionerId: bookingPractitioner,
      practitionerName: DEFAULT_PRACTITIONERS.find((p) => p.id === bookingPractitioner)?.name,
      start,
      end,
      status: 'pending',
      reason: bookingReason || 'Routine Consultation',
    }

    setAppointments((prev) => [...prev, optimisticItem])
    setQueuedActions(offlineSyncService.getQueuedAppointmentActions())
    setShowBookingModal(false)
    setBookingReason('')
  }

  const handleCancel = async (appointmentId: string) => {
    await offlineSyncService.queueAppointmentAction({
      actionType: 'cancel',
      appointmentId,
      patientId: currentPatientId,
      practitionerId: currentPractitionerId,
      cancelReason: 'Cancelled via mobile client',
    })

    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: 'cancelled' } : a)),
    )
    setQueuedActions(offlineSyncService.getQueuedAppointmentActions())
  }

  const filteredAppointments = appointments.filter((appt) => {
    if (filterView === 'day') {
      return appt.start.startsWith(selectedDate)
    }
    if (filterView === 'upcoming') {
      return new Date(appt.start) >= new Date()
    }
    return true
  })

  return (
    <div className="w-full max-w-full space-y-4 font-sans" style={{ color: 'var(--np-text)' }}>
      {/* Header & Date Controls */}
      <div
        className="flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
      >
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Mobile Scheduling</h2>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--np-muted)' }}>
            {isOnline ? (
              <span className="text-emerald-400">● Online Sync Active</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <CloudOff className="h-3.5 w-3.5" /> Offline Mode (Cached Schedule)
              </span>
            )}
            {queuedActions.length > 0 && (
              <span>• {queuedActions.length} actions queued for sync</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBookingModal(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
            aria-label="Book new appointment"
          >
            <Plus className="h-4 w-4" />
            <span>Book Slot</span>
          </button>
        </div>
      </div>

      {/* Date Picker & Filter Chips (min 44px touch target) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="schedule-date-input" className="sr-only">
            Select Schedule Date
          </label>
          <input
            id="schedule-date-input"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
            style={{
              background: 'var(--np-surface)',
              color: 'var(--np-text)',
              border: '1px solid var(--np-line)',
            }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--np-surface)' }}>
          {(['day', 'upcoming', 'all'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setFilterView(view)}
              className="min-h-[44px] rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={{
                background: filterView === view ? 'var(--np-elevated)' : 'transparent',
                color: filterView === view ? 'var(--np-text)' : 'var(--np-muted)',
              }}
              aria-pressed={filterView === view}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-lime-500" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: 'var(--np-surface)', border: '1px solid var(--np-line)' }}
          >
            <CalendarIcon className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--np-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
              No appointments for the selected timeframe.
            </p>
          </div>
        ) : (
          filteredAppointments.map((appt) => {
            const startDate = new Date(appt.start)
            const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={appt.id}
                onClick={() => onAppointmentClick?.(appt)}
                className="flex flex-col justify-between gap-3 rounded-lg p-4 sm:flex-row sm:items-center"
                style={{
                  background: 'var(--np-surface)',
                  border: '1px solid var(--np-line)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--np-elevated)', color: 'var(--np-text)' }}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{timeStr}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                        style={{
                          background:
                            appt.status === 'booked'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : appt.status === 'cancelled'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                          color:
                            appt.status === 'booked'
                              ? '#34d399'
                              : appt.status === 'cancelled'
                                ? '#f87171'
                                : '#fbbf24',
                        }}
                      >
                        {appt.status}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--np-muted)' }}>
                      {appt.practitionerName ?? 'Assigned Clinician'} · {appt.reason ?? 'Consultation'}
                    </p>
                  </div>
                </div>

                {appt.status !== 'cancelled' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleCancel(appt.id)
                      }}
                      className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 transition-colors"
                      aria-label={`Cancel appointment at ${timeStr}`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Booking Modal (Accessible & Touch-friendly) */}
      {showBookingModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--np-overlay)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 shadow-2xl"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
              color: 'var(--np-text)',
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--np-line)' }}>
              <h3 id="booking-modal-title" className="text-base font-semibold">
                Book Appointment Slot
              </h3>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                aria-label="Close booking modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--np-muted)' }}>
                  Practitioner
                </label>
                <select
                  value={bookingPractitioner}
                  onChange={(e) => setBookingPractitioner(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--np-bg)',
                    color: 'var(--np-text)',
                    border: '1px solid var(--np-line)',
                  }}
                >
                  {DEFAULT_PRACTITIONERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--np-muted)' }}>
                  Time Slot
                </label>
                <input
                  type="time"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  required
                  className="min-h-[44px] w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--np-bg)',
                    color: 'var(--np-text)',
                    border: '1px solid var(--np-line)',
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--np-muted)' }}>
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="e.g. CBT follow-up session"
                  className="min-h-[44px] w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--np-bg)',
                    color: 'var(--np-text)',
                    border: '1px solid var(--np-line)',
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="min-h-[44px] rounded-lg px-4 py-2 text-sm"
                  style={{ background: 'var(--np-elevated)', color: 'var(--np-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--np-text)', color: 'var(--np-bg)' }}
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileScheduleView
