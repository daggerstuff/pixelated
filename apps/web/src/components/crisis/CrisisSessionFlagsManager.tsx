import { useState, useEffect, useCallback } from 'react'
import type { FC } from 'react'

import type {
  CrisisSessionFlag,
  UserSessionStatus,
} from '../../lib/ai/crisis/types'

// Performance optimization: Moved pure helper functions outside component to prevent recreation on every render
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'text-foreground font-semibold bg-card border border-ring'
    case 'high':
      return 'text-foreground font-medium bg-secondary border border-ring'
    case 'medium':
      return 'text-foreground font-medium bg-secondary border border-ring'
    case 'low':
      return 'text-foreground bg-secondary border border-input'
    default:
      return 'text-muted-foreground bg-secondary border border-border'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'text-foreground font-semibold bg-card border border-ring'
    case 'under_review':
      return 'text-foreground bg-secondary border border-input'
    case 'reviewed':
      return 'text-foreground bg-secondary border border-input'
    case 'resolved':
      return 'text-foreground bg-secondary border border-input'
    case 'escalated':
      return 'text-foreground font-medium bg-secondary border border-ring'
    case 'dismissed':
      return 'text-muted-foreground bg-secondary border border-border'
    default:
      return 'text-muted-foreground bg-secondary border border-border'
  }
}

interface CrisisSessionFlagsManagerProps {
  userId?: string
  showPendingOnly?: boolean
  allowManagement?: boolean
}

export const CrisisSessionFlagsManager: FC<CrisisSessionFlagsManagerProps> = ({
  userId,
  showPendingOnly = false,
  allowManagement = false,
}) => {
  const [flags, setFlags] = useState<CrisisSessionFlag[]>([])
  const [userStatus, setUserStatus] = useState<UserSessionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFlag, setSelectedFlag] = useState<CrisisSessionFlag | null>(
    null,
  )
  const [updating, setUpdating] = useState<string | null>(null)

  // Close modal on Escape key press
  useEffect(() => {
    if (!selectedFlag) {
      return undefined
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFlag(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedFlag])

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (userId) {
        params.append('userId', userId)
      }
      if (showPendingOnly) {
        params.append('pending', 'true')
      }

      const response = await fetch(`/api/crisis/session-flags?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load flags: ${response.statusText}`)
      }

      const data = await response.json()
      setFlags(data.flags ?? [])
      setUserStatus(data.status ?? null)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err?.message || String(err)
          : 'Failed to load crisis flags',
      )
    } finally {
      setLoading(false)
    }
  }, [userId, showPendingOnly])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadFlags()
    }, 0)

    return () => window.clearTimeout(initialLoad)
  }, [loadFlags])

  const updateFlagStatus = async (
    flagId: string,
    status: string,
    notes?: string,
    assignedTo?: string,
  ) => {
    try {
      setUpdating(flagId)
      setError(null)

      const response = await fetch('/api/crisis/session-flags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagId,
          status,
          reviewerNotes: notes,
          assignedTo,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update flag: ${response.statusText}`)
      }

      const data = await response.json()

      // Update the flag in the list
      setFlags((prev) =>
        prev.map((flag) => (flag.id === flagId ? data.flag : flag)),
      )

      setSelectedFlag(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err?.message || String(err)
          : 'Failed to update flag',
      )
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-8 animate-spin rounded-none border-b-2 border-ring"
          aria-hidden="true"
        ></div>
        <span className="ml-2">Loading crisis flags...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-none border border-ring bg-card p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-foreground"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-foreground">Error</h3>
            <div className="mt-2 text-sm text-foreground">{error}</div>
            <div className="mt-4">
              <button
                onClick={loadFlags}
                className="rounded-none bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Status Summary */}
      {userStatus && (
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-medium text-foreground">
            User Status Summary
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {userStatus.totalCrisisFlags}
              </div>
              <div className="text-sm text-muted-foreground">Total Flags</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {userStatus.activeCrisisFlags}
              </div>
              <div className="text-sm text-muted-foreground">Active Flags</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {userStatus.resolvedCrisisFlags}
              </div>
              <div className="text-sm text-muted-foreground">Resolved</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${getSeverityColor(userStatus.currentRiskLevel).split(' ')[0]}`}
              >
                {userStatus.currentRiskLevel.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">Risk Level</div>
            </div>
          </div>
        </div>
      )}

      {/* Crisis Flags List */}
      <div className="rounded-none border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-medium text-foreground">
            Crisis Session Flags {showPendingOnly && '(Pending Review)'}
          </h3>
        </div>

        {flags.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No crisis flags found.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {flags.map((flag) => (
              <div key={flag.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-medium ${getSeverityColor(flag.severity)}`}
                      >
                        {flag.severity.toUpperCase()}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(flag.status)}`}
                      >
                        {flag.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {(flag.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <h4 className="mb-1 text-sm font-medium text-foreground">
                      {flag.reason}
                    </h4>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Session: {flag.sessionId}</div>
                      <div>
                        Flagged: {new Date(flag.flaggedAt).toLocaleString()}
                      </div>
                      {flag.detectedRisks.length > 0 && (
                        <div>Risks: {flag.detectedRisks.join(', ')}</div>
                      )}
                      {flag.textSample && (
                        <div className="mt-2 rounded-none bg-secondary p-2 text-xs">
                          <strong>Text Sample:</strong> {flag.textSample}
                        </div>
                      )}
                    </div>

                    {flag.reviewerNotes && (
                      <div className="mt-2 rounded-none border border-input bg-secondary p-2 text-sm">
                        <strong>Reviewer Notes:</strong> {flag.reviewerNotes}
                      </div>
                    )}

                    {flag.resolutionNotes && (
                      <div className="mt-2 rounded-none border border-input bg-secondary p-2 text-sm">
                        <strong>Resolution Notes:</strong>{' '}
                        {flag.resolutionNotes}
                      </div>
                    )}
                  </div>

                  {allowManagement &&
                    flag.status !== 'resolved' &&
                    flag.status !== 'dismissed' && (
                      <div className="ml-4 flex-shrink-0">
                        <button
                          onClick={() => setSelectedFlag(flag)}
                          disabled={updating === flag.id}
                          className="rounded-none bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-accent disabled:opacity-35"
                          aria-label={`Manage flag: ${flag.reason}`}
                        >
                          {updating === flag.id ? 'Updating...' : 'Manage'}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flag Management Modal */}
      {selectedFlag && allowManagement && (
        <div
          className="bg-foreground/60 fixed inset-0 z-50 h-full w-full overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="relative top-20 mx-auto w-96 rounded-none border border-border bg-card p-5"
            role="document"
          >
            <div className="mt-3">
              <h3
                id="modal-title"
                className="mb-4 text-lg font-medium text-foreground"
              >
                Manage Crisis Flag
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 block text-sm font-medium text-foreground">
                    Update Status
                  </div>
                  <div
                    className="space-y-2"
                    role="group"
                    aria-label="Update Status"
                  >
                    {[
                      'under_review',
                      'reviewed',
                      'resolved',
                      'escalated',
                      'dismissed',
                    ].map((status) => (
                      <button
                        key={status}
                        onClick={async () =>
                          updateFlagStatus(selectedFlag.id, status)
                        }
                        disabled={updating === selectedFlag.id}
                        className="w-full rounded-none border border-input px-3 py-2 text-left hover:bg-secondary disabled:opacity-35"
                      >
                        {status.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="rounded-none bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
