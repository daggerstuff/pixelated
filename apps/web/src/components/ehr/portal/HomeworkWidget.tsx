import { CheckCircle, ClipboardList, Clock } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

interface HomeworkAssignment {
  id: string
  patientId: string
  practitionerId: string
  title: string
  description: string
  instructions: string
  dueDate?: string
  assignedAt: string
  completedAt?: string
  status: 'assigned' | 'in-progress' | 'completed' | 'overdue'
  patientNotes?: string
}

interface HomeworkSummary {
  totalAssigned: number
  completed: number
  pending: number
  overdue: number
  upcoming: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { limit: number; offset: number; total?: number }
}

interface ErrorResponse {
  error: { code: string; message: string }
}

const STATUS_COLORS: Record<string, string> = {
  'assigned': 'var(--np-muted)',
  'in-progress': 'var(--np-text)',
  'completed': 'var(--np-success, #22c55e)',
  'overdue': 'var(--np-danger, #ef4444)',
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function HomeworkWidget() {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([])
  const [summary, setSummary] = useState<HomeworkSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [patientNotes, setPatientNotes] = useState('')

  const fetchAssignments = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/portal/v1/homework?${params.toString()}`)
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to load homework')
      }
      const result = (await res.json()) as PaginatedResponse<HomeworkAssignment>
      setAssignments(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load homework')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/v1/homework')
      if (res.ok) {
        const result =
          (await res.json()) as PaginatedResponse<HomeworkAssignment>
        const all = result.data
        setSummary({
          totalAssigned: all.length,
          completed: all.filter((a) => a.status === 'completed').length,
          pending: all.filter(
            (a) => a.status === 'assigned' || a.status === 'in-progress',
          ).length,
          overdue: all.filter((a) => a.status === 'overdue').length,
          upcoming: all.filter(
            (a) => a.dueDate && new Date(a.dueDate) > new Date(),
          ).length,
        })
      }
    } catch {
      // Summary is best-effort
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        const res = await fetch(`/api/portal/v1/homework?${params.toString()}`)
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load homework')
        }
        if (!cancelled) {
          const result =
            (await res.json()) as PaginatedResponse<HomeworkAssignment>
          if (!cancelled) setAssignments(result.data)
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load homework',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    void (async () => {
      try {
        const res = await fetch('/api/portal/v1/homework')
        if (!cancelled && res.ok) {
          const result =
            (await res.json()) as PaginatedResponse<HomeworkAssignment>
          if (!cancelled) {
            const all = result.data
            setSummary({
              totalAssigned: all.length,
              completed: all.filter((a) => a.status === 'completed').length,
              pending: all.filter(
                (a) => a.status === 'assigned' || a.status === 'in-progress',
              ).length,
              overdue: all.filter((a) => a.status === 'overdue').length,
              upcoming: all.filter(
                (a) => a.dueDate && new Date(a.dueDate) > new Date(),
              ).length,
            })
          }
        }
      } catch {
        // Summary is best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  const handleComplete = async (assignmentId: string) => {
    setActionLoading(assignmentId)
    try {
      const res = await fetch(`/api/portal/v1/homework/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientNotes: patientNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to complete assignment')
      }
      setExpandedId(null)
      setPatientNotes('')
      await fetchAssignments()
      await fetchSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateStatus = async (assignmentId: string, status: string) => {
    setActionLoading(assignmentId)
    try {
      const res = await fetch(`/api/portal/v1/homework/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to update')
      }
      await fetchAssignments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setActionLoading(null)
    }
  }

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
          Homework Assignments
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--np-muted)' }}>
          Complete assignments from your care team
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            className="rounded p-3 text-center"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <p
              className="text-2xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {summary.totalAssigned}
            </p>
            <p className="text-xs" style={{ color: 'var(--np-muted)' }}>
              Total
            </p>
          </div>
          <div
            className="rounded p-3 text-center"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <p
              className="text-2xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {summary.completed}
            </p>
            <p className="text-xs" style={{ color: 'var(--np-muted)' }}>
              Completed
            </p>
          </div>
          <div
            className="rounded p-3 text-center"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <p
              className="text-2xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {summary.pending}
            </p>
            <p className="text-xs" style={{ color: 'var(--np-muted)' }}>
              Pending
            </p>
          </div>
          <div
            className="rounded p-3 text-center"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <p
              className="text-2xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {summary.overdue}
            </p>
            <p className="text-xs" style={{ color: 'var(--np-muted)' }}>
              Overdue
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['', 'assigned', 'in-progress', 'completed', 'overdue'].map(
          (status) => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className="rounded px-3 py-1.5 text-xs capitalize transition-colors"
              style={{
                background:
                  statusFilter === status
                    ? 'var(--np-elevated)'
                    : 'var(--np-surface)',
                color:
                  statusFilter === status
                    ? 'var(--np-text)'
                    : 'var(--np-muted)',
                border: '1px solid var(--np-line)',
                fontWeight: statusFilter === status ? 600 : 400,
              }}
            >
              {status || 'All'}
            </button>
          ),
        )}
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

      {assignments.length === 0 ? (
        <div
          className="rounded py-12 text-center"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <ClipboardList
            className="mx-auto mb-3 h-8 w-8"
            style={{ color: 'var(--np-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
            No homework assignments.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((hw) => (
            <div
              key={hw.id}
              className="rounded"
              style={{
                background: 'var(--np-surface)',
                border: '1px solid var(--np-line)',
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-medium"
                      style={{ color: 'var(--np-text)' }}
                    >
                      {hw.title}
                    </h3>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      {hw.description}
                    </p>
                    <div
                      className="mt-2 flex items-center gap-3 text-xs"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      <span
                        className="rounded px-2 py-0.5"
                        style={{
                          background: 'var(--np-elevated)',
                          color: STATUS_COLORS[hw.status] ?? 'var(--np-muted)',
                        }}
                      >
                        {hw.status}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Assigned: {formatDate(hw.assignedAt)}
                      </span>
                      {hw.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {formatDate(hw.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {hw.status !== 'completed' && (
                    <button
                      onClick={() => {
                        if (expandedId === hw.id) {
                          setExpandedId(null)
                        } else {
                          setExpandedId(hw.id)
                          setPatientNotes(hw.patientNotes ?? '')
                        }
                      }}
                      className="flex-shrink-0 rounded px-3 py-1.5 text-xs transition-colors"
                      style={{
                        background: 'var(--np-elevated)',
                        color: 'var(--np-text)',
                      }}
                    >
                      {expandedId === hw.id ? 'Cancel' : 'Complete'}
                    </button>
                  )}
                </div>

                {hw.instructions && (
                  <p
                    className="mt-3 border-t pt-3 text-sm"
                    style={{
                      color: 'var(--np-muted)',
                      borderColor: 'var(--np-line)',
                    }}
                  >
                    <strong style={{ color: 'var(--np-text)' }}>
                      Instructions:
                    </strong>{' '}
                    {hw.instructions}
                  </p>
                )}

                {hw.patientNotes && hw.status === 'completed' && (
                  <p
                    className="mt-2 text-sm"
                    style={{ color: 'var(--np-muted)' }}
                  >
                    <strong style={{ color: 'var(--np-text)' }}>
                      Your notes:
                    </strong>{' '}
                    {hw.patientNotes}
                  </p>
                )}

                {hw.completedAt && (
                  <p
                    className="mt-2 flex items-center gap-1 text-xs"
                    style={{ color: 'var(--np-muted)' }}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Completed: {formatDate(hw.completedAt)}
                  </p>
                )}

                {expandedId === hw.id && hw.status !== 'completed' && (
                  <div
                    className="mt-3 border-t pt-3"
                    style={{ borderColor: 'var(--np-line)' }}
                  >
                    <label
                      className="mb-1.5 block text-sm"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      Notes (optional)
                    </label>
                    <textarea
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded border-0 px-3 py-2 text-sm"
                      style={{
                        background: 'var(--np-elevated)',
                        color: 'var(--np-text)',
                      }}
                      placeholder="Add any notes about this assignment..."
                    />
                    <div className="mt-2 flex gap-2">
                      {hw.status === 'assigned' && (
                        <button
                          onClick={() =>
                            void handleUpdateStatus(hw.id, 'in-progress')
                          }
                          disabled={actionLoading === hw.id}
                          className="rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                          style={{
                            background: 'var(--np-surface)',
                            color: 'var(--np-muted)',
                          }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      <button
                        onClick={() => void handleComplete(hw.id)}
                        disabled={actionLoading === hw.id}
                        className="rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                        style={{
                          background: 'var(--np-text)',
                          color: 'var(--np-bg)',
                        }}
                      >
                        {actionLoading === hw.id
                          ? 'Completing...'
                          : 'Mark Complete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
