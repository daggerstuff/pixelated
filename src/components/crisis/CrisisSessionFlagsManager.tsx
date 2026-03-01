import { useState, useEffect, useCallback } from 'react'
import type { FC } from 'react'

import type {
  CrisisSessionFlag,
  UserSessionStatus,
} from '../../lib/ai/crisis/types'

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
      setFlags(data.flags || [])
      setUserStatus(data.status || null)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? (err)?.message || String(err)
          : 'Failed to load crisis flags',
      )
    } finally {
      setLoading(false)
    }
  }, [userId, showPendingOnly])

  useEffect(() => {
    void loadFlags()
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
          ? (err)?.message || String(err)
          : 'Failed to update flag',
      )
    } finally {
      setUpdating(null)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-red-600 bg-red-50'
      case 'under_review':
        return 'text-blue-600 bg-blue-50'
      case 'reviewed':
        return 'text-green-600 bg-green-50'
      case 'resolved':
        return 'text-green-700 bg-green-100'
      case 'escalated':
        return 'text-purple-600 bg-purple-50'
      case 'dismissed':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='border-blue-600 h-8 w-8 animate-spin rounded-full border-b-2'></div>
        <span className='ml-2'>Loading crisis flags...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='bg-red-50 border-red-200 rounded-md border p-4'>
        <div className='flex'>
          <div className='flex-shrink-0'>
            <svg
              className='text-red-400 h-5 w-5'
              viewBox='0 0 20 20'
              fill='currentColor'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <div className='ml-3'>
            <h3 className='text-red-800 text-sm font-medium'>Error</h3>
            <div className='text-red-700 mt-2 text-sm'>{error}</div>
            <div className='mt-4'>
              <button
                onClick={loadFlags}
                className='bg-red-100 text-red-800 hover:bg-red-200 rounded-md px-3 py-2 text-sm font-medium'
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
    <div className='space-y-6'>
      {/* User Status Summary */}
      {userStatus && (
        <div className='bg-white rounded-lg p-6 shadow'>
          <h3 className='text-gray-900 mb-4 text-lg font-medium'>
            User Status Summary
          </h3>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
            <div className='text-center'>
              <div className='text-gray-900 text-2xl font-bold'>
                {userStatus.totalCrisisFlags}
              </div>
              <div className='text-gray-500 text-sm'>Total Flags</div>
            </div>
            <div className='text-center'>
              <div className='text-red-600 text-2xl font-bold'>
                {userStatus.activeCrisisFlags}
              </div>
              <div className='text-gray-500 text-sm'>Active Flags</div>
            </div>
            <div className='text-center'>
              <div className='text-green-600 text-2xl font-bold'>
                {userStatus.resolvedCrisisFlags}
              </div>
              <div className='text-gray-500 text-sm'>Resolved</div>
            </div>
            <div className='text-center'>
              <div
                className={`text-2xl font-bold ${getSeverityColor(userStatus.currentRiskLevel).split(' ')[0]}`}
              >
                {userStatus.currentRiskLevel.toUpperCase()}
              </div>
              <div className='text-gray-500 text-sm'>Risk Level</div>
            </div>
          </div>
        </div>
      )}

      {/* Crisis Flags List */}
      <div className='bg-white rounded-lg shadow'>
        <div className='border-gray-200 border-b px-6 py-4'>
          <h3 className='text-gray-900 text-lg font-medium'>
            Crisis Session Flags {showPendingOnly && '(Pending Review)'}
          </h3>
        </div>

        {flags.length === 0 ? (
          <div className='text-gray-500 p-6 text-center'>
            No crisis flags found.
          </div>
        ) : (
          <div className='divide-gray-200 divide-y'>
            {flags.map((flag) => (
              <div key={flag.id} className='p-6'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='mb-2 flex items-center space-x-2'>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityColor(flag.severity)}`}
                      >
                        {flag.severity.toUpperCase()}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(flag.status)}`}
                      >
                        {flag.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className='text-gray-500 text-xs'>
                        Confidence: {(flag.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <h4 className='text-gray-900 mb-1 text-sm font-medium'>
                      {flag.reason}
                    </h4>

                    <div className='text-gray-600 space-y-1 text-sm'>
                      <div>Session: {flag.sessionId}</div>
                      <div>
                        Flagged: {new Date(flag.flaggedAt).toLocaleString()}
                      </div>
                      {flag.detectedRisks.length > 0 && (
                        <div>Risks: {flag.detectedRisks.join(', ')}</div>
                      )}
                      {flag.textSample && (
                        <div className='bg-gray-50 mt-2 rounded p-2 text-xs'>
                          <strong>Text Sample:</strong> {flag.textSample}
                        </div>
                      )}
                    </div>

                    {flag.reviewerNotes && (
                      <div className='bg-blue-50 mt-2 rounded p-2 text-sm'>
                        <strong>Reviewer Notes:</strong> {flag.reviewerNotes}
                      </div>
                    )}

                    {flag.resolutionNotes && (
                      <div className='bg-green-50 mt-2 rounded p-2 text-sm'>
                        <strong>Resolution Notes:</strong>{' '}
                        {flag.resolutionNotes}
                      </div>
                    )}
                  </div>

                  {allowManagement &&
                    flag.status !== 'resolved' &&
                    flag.status !== 'dismissed' && (
                      <div className='ml-4 flex-shrink-0'>
                        <button
                          onClick={() => setSelectedFlag(flag)}
                          disabled={updating === flag.id}
                          className='bg-blue-600 text-white hover:bg-blue-700 rounded px-3 py-1 text-sm disabled:opacity-50'
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
        <div className='bg-gray-600 fixed inset-0 z-50 h-full w-full overflow-y-auto bg-opacity-50'>
          <div className='bg-white relative top-20 mx-auto w-96 rounded-md border p-5 shadow-lg'>
            <div className='mt-3'>
              <h3 className='text-gray-900 mb-4 text-lg font-medium'>
                Manage Crisis Flag
              </h3>

              <div className='space-y-4'>
                <div>
                  <div className='text-gray-700 mb-2 block text-sm font-medium'>
                    Update Status
                  </div>
                  <div
                    className='space-y-2'
                    role='group'
                    aria-label='Update Status'
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
                        onClick={() =>
                          updateFlagStatus(selectedFlag.id, status)
                        }
                        disabled={updating === selectedFlag.id}
                        className='border-gray-300 hover:bg-gray-50 w-full rounded-md border px-3 py-2 text-left disabled:opacity-50'
                      >
                        {status.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className='mt-6 flex justify-end space-x-3'>
                <button
                  onClick={() => setSelectedFlag(null)}
                  className='text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md px-4 py-2 text-sm font-medium'
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
