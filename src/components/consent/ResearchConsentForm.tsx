import { useState, useEffect } from 'react'

import { authClient } from '@/lib/auth-client'
import { consentService } from '@/lib/security/consent/ConsentService'
import type { UserConsentStatus } from '@/lib/security/consent/types'

interface ResearchConsentFormProps {
  onConsentChanged?: (hasConsent: boolean) => void
  showSummaryOnly?: boolean
  className?: string
}

/**
 * Research Consent Form Component
 *
 * Allows users to grant or withdraw consent for research purposes
 * Displays the current consent document and options
 * Provides audit-compliant consent tracking
 */
export function ResearchConsentForm({
  onConsentChanged,
  showSummaryOnly = false,
  className = '',
}: ResearchConsentFormProps) {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [consentStatus, setConsentStatus] = useState<UserConsentStatus | null>(
    null,
  )
  const [expandedView, setExpandedView] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, boolean>
  >({})
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)

  // Fetch consent status when component mounts or user changes
  useEffect(() => {
    const fetchConsentStatus = async () => {
      if (!user) {
        return
      }

      try {
        setLoading(true)
        setError(null)
        const statuses = await consentService.getUserConsentStatus({
          userId: user.id,
          consentTypeName: 'Research Participation',
        })

        if (statuses.length > 0) {
          setConsentStatus(statuses[0] || null)

          // Initialize selected options from user's existing consent if available
          if (
            statuses[0] &&
            statuses[0].userConsent &&
            statuses[0].userConsent.granularOptions
          ) {
            setSelectedOptions(statuses[0].userConsent.granularOptions)
          } else if (statuses[0]) {
            // Otherwise initialize with default values
            const initialOptions: Record<string, boolean> = {}
            statuses[0].consentOptions?.forEach((option) => {
              initialOptions[option.optionName] = option.defaultValue
            })
            setSelectedOptions(initialOptions)
          }
        }
      } catch (err: unknown) {
        console.error('Error fetching consent status:', err)
        setError('Failed to load consent information. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    void fetchConsentStatus()
  }, [user])

  // Handle granting consent
  const handleGrantConsent = async () => {
    if (!user || !consentStatus) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get user agent for audit trail
      const { userAgent } = window.navigator

      await consentService.grantConsent({
        userId: user.id,
        consentVersionId: consentStatus.currentVersion.id,
        userAgent,
        granularOptions: selectedOptions,
      })

      // Refresh consent status
      const statuses = await consentService.getUserConsentStatus({
        userId: user.id,
        consentTypeName: 'Research Participation',
      })

      if (statuses.length > 0) {
        setConsentStatus(statuses[0] || null)
      }

      // Notify parent if callback is provided
      if (onConsentChanged) {
        onConsentChanged(true)
      }
    } catch (err: unknown) {
      console.error('Error granting consent:', err)
      setError('Failed to record your consent. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Handle withdrawing consent
  const handleWithdrawConsent = async () => {
    if (!user || !consentStatus?.userConsent) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get user agent for audit trail
      const { userAgent } = window.navigator

      await consentService.withdrawConsent({
        userId: user.id,
        consentId: consentStatus.userConsent.id,
        reason: withdrawReason,
        userAgent,
      })

      // Refresh consent status
      const statuses = await consentService.getUserConsentStatus({
        userId: user.id,
        consentTypeName: 'Research Participation',
      })

      if (statuses.length > 0) {
        setConsentStatus(statuses[0] || null)
      }

      // Reset withdrawal dialog
      setWithdrawReason('')
      setWithdrawDialogOpen(false)

      // Notify parent if callback is provided
      if (onConsentChanged) {
        onConsentChanged(false)
      }
    } catch (err: unknown) {
      console.error('Error withdrawing consent:', err)
      setError('Failed to withdraw your consent. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Handle option change
  const handleOptionChange = (optionName: string, checked: boolean) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: checked,
    }))
  }

  // Check if all required options are selected
  const allRequiredOptionsSelected = () => {
    if (!consentStatus?.consentOptions) {
      return true
    }

    return consentStatus.consentOptions
      .filter((option) => option.isRequired)
      .every((option) => selectedOptions[option.optionName])
  }

  // Render loading state
  if (loading) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <div className='flex h-40 items-center justify-center'>
          <div className='border-green-700 h-10 w-10 animate-spin rounded-full border-b-2'></div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <div className='bg-red-50 border-red-200 text-red-800 mb-4 rounded-lg border p-4'>
          <p>{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className='bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 font-medium'
        >
          Retry
        </button>
      </div>
    )
  }

  // Render when no consent status is found
  if (!consentStatus) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <p className='text-gray-500'>
          No research consent information available.
        </p>
      </div>
    )
  }

  // Render consent form
  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className='border-gray-200 border-b p-6'>
        <h2 className='text-gray-800 text-xl font-semibold'>
          Research Participation Consent
        </h2>
        <p className='text-gray-500 mt-1 text-sm'>
          {consentStatus.hasActiveConsent
            ? `Consent granted on ${new Date(consentStatus.userConsent?.grantedAt || '').toLocaleDateString()}`
            : 'Your consent is requested for research participation'}
        </p>
      </div>

      {/* Consent summary */}
      <div className='p-6'>
        <div className='mb-6'>
          <h3 className='text-gray-800 mb-2 font-medium'>Summary</h3>
          <p className='text-gray-600'>
            {consentStatus.currentVersion.summary}
          </p>
        </div>

        {/* Full consent text (expandable) */}
        {!showSummaryOnly && (
          <div className='mb-6'>
            <button
              onClick={() => setExpandedView(!expandedView)}
              className='text-green-700 hover:text-green-800 flex items-center text-sm font-medium'
            >
              {expandedView
                ? 'Hide full details'
                : 'View full consent document'}
              <svg
                className={`ml-1 h-4 w-4 transform ${expandedView ? 'rotate-180' : ''}`}
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>

            {expandedView && (
              <div className='bg-gray-50 border-gray-200 text-gray-700 mt-4 max-h-96 overflow-auto rounded-lg border p-4 text-sm'>
                <div
                  dangerouslySetInnerHTML={{
                    __html: consentStatus.currentVersion.documentText,
                  }}
                ></div>
              </div>
            )}
          </div>
        )}

        {/* Consent options */}
        {consentStatus.consentOptions &&
          consentStatus.consentOptions.length > 0 &&
          !showSummaryOnly &&
          !consentStatus.hasActiveConsent && (
            <div className='mb-6'>
              <h3 className='text-gray-800 mb-2 font-medium'>
                Consent Options
              </h3>
              <div className='space-y-3'>
                {consentStatus.consentOptions.map((option) => (
                  <div key={option.id} className='flex items-start'>
                    <input
                      type='checkbox'
                      id={option.id}
                      checked={selectedOptions[option.optionName] || false}
                      onChange={(e) =>
                        handleOptionChange(option.optionName, e.target.checked)
                      }
                      className='text-green-600 focus:ring-green-500 border-gray-300 mt-1 h-4 w-4 rounded'
                    />

                    <label
                      htmlFor={option.id}
                      className='text-gray-700 ml-2 block text-sm'
                    >
                      {option.description}
                      {option.isRequired && (
                        <span className='text-red-500 ml-1'>*</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
              <p className='text-gray-500 mt-2 text-xs'>
                <span className='text-red-500'>*</span> Required options
              </p>
            </div>
          )}

        {/* Action buttons */}
        {!showSummaryOnly && (
          <div className='mt-6 flex flex-wrap gap-4'>
            {!consentStatus.hasActiveConsent ? (
              <button
                onClick={handleGrantConsent}
                disabled={loading || !allRequiredOptionsSelected()}
                className={`rounded-lg px-4 py-2 font-medium ${
                  allRequiredOptionsSelected()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                I Consent
              </button>
            ) : (
              <button
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={loading}
                className='bg-red-50 text-red-700 hover:bg-red-100 rounded-lg px-4 py-2 font-medium'
              >
                Withdraw Consent
              </button>
            )}
          </div>
        )}
      </div>

      {/* Withdrawal dialog */}
      {withdrawDialogOpen && (
        <div className='bg-black fixed inset-0 z-50 flex items-center justify-center bg-opacity-50 p-4'>
          <div className='bg-white w-full max-w-md rounded-lg shadow-xl'>
            <div className='border-b p-4'>
              <h3 className='text-gray-800 text-lg font-semibold'>
                Withdraw Research Consent
              </h3>
            </div>

            <div className='p-4'>
              <p className='text-gray-600 mb-4'>
                Youre about to withdraw your consent for research participation.
                This means your data will no longer be used for research
                purposes.
              </p>

              <label
                htmlFor='withdraw-reason'
                className='text-gray-700 mb-1 block text-sm font-medium'
              >
                Reason for withdrawal (optional)
              </label>
              <textarea
                id='withdraw-reason'
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                className='border-gray-300 focus:ring-green-500 focus:border-transparent h-24 w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2'
                placeholder="Please let us know why you're withdrawing consent (optional)"
              ></textarea>
            </div>

            <div className='bg-gray-50 flex justify-end space-x-3 border-t p-4'>
              <button
                onClick={() => setWithdrawDialogOpen(false)}
                className='bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg border px-4 py-2 font-medium'
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawConsent}
                disabled={loading}
                className='bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-medium'
              >
                Withdraw Consent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
