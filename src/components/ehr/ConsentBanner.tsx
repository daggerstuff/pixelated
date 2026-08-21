import { useCallback, useEffect, useState } from 'react'

import type { ConsentRecord } from '@/lib/ehr-native/consent/types'

interface ConsentBannerProps {
  patientId: string
}

interface BannerState {
  status: 'active' | 'expiring' | 'expired' | 'withdrawn' | 'none' | 'loading' | 'error'
  expiresAt: string | null
  daysRemaining: number | null
  message: string
}

const WARNING_DAYS = 30

function getStorageKey(patientId: string): string {
  return `consent-banner-dismissed-${patientId}`
}

function calculateDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const now = Date.now()
  const expiry = new Date(expiresAt).getTime()
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
}

function deriveBannerState(
  consents: ConsentRecord[],
): BannerState {
  if (consents.length === 0) {
    return {
      status: 'none',
      expiresAt: null,
      daysRemaining: null,
      message: 'No consent on file',
    }
  }

  const latest = consents[0]

  if (latest.status === 'withdrawn') {
    return {
      status: 'withdrawn',
      expiresAt: latest.expiresAt,
      daysRemaining: null,
      message: 'Consent Withdrawn',
    }
  }

  if (latest.status === 'expired') {
    return {
      status: 'expired',
      expiresAt: latest.expiresAt,
      daysRemaining: null,
      message: 'Consent Expired',
    }
  }

  const days = calculateDaysRemaining(latest.expiresAt)

  if (days !== null && days <= WARNING_DAYS && days > 0) {
    return {
      status: 'expiring',
      expiresAt: latest.expiresAt,
      daysRemaining: days,
      message: `Consent Expiring Soon — ${days} day${days === 1 ? '' : 's'} remaining`,
    }
  }

  return {
    status: 'active',
    expiresAt: latest.expiresAt,
    daysRemaining: days,
    message: 'Consent Active',
  }
}

const bannerClassMap: Record<BannerState['status'], string> = {
  active: 'bg-green-50 border-green-200 text-green-800',
  expiring: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  expired: 'bg-red-50 border-red-200 text-red-800',
  withdrawn: 'bg-red-50 border-red-200 text-red-800',
  none: 'bg-gray-50 border-gray-200 text-gray-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  loading: 'bg-gray-50 border-gray-200 text-gray-600',
}

function getBannerClasses(status: BannerState['status']): string {
  return bannerClassMap[status]
}

const iconClassMap: Record<BannerState['status'], string> = {
  active: 'text-green-600',
  expiring: 'text-yellow-600',
  expired: 'text-red-600',
  withdrawn: 'text-red-600',
  error: 'text-red-600',
  none: 'text-gray-600',
  loading: 'text-gray-600',
}

function getIconClasses(status: BannerState['status']): string {
  return iconClassMap[status]
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return null
  }
}

export function ConsentBanner({ patientId }: ConsentBannerProps) {
  const [state, setState] = useState<BannerState>({
    status: 'loading',
    expiresAt: null,
    daysRemaining: null,
    message: 'Loading consent status...',
  })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(patientId))
    if (stored) {
      setDismissed(true)
    }
  }, [patientId])

  const fetchConsent = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    try {
      const response = await fetch(
        `/api/ehr/v1/consents?patient=${encodeURIComponent(patientId)}`,
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch consent: ${response.status}`)
      }
      const data = await response.json() as ConsentRecord[]
      setState(deriveBannerState(data))
    } catch {
      setState({
        status: 'error',
        expiresAt: null,
        daysRemaining: null,
        message: 'Failed to load consent status',
      })
    }
  }, [patientId])

  useEffect(() => {
    void fetchConsent()
  }, [fetchConsent])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(getStorageKey(patientId), new Date().toISOString())
    setDismissed(true)
  }, [patientId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleDismiss()
      }
    },
    [handleDismiss],
  )

  if (dismissed || state.status === 'loading') {
    if (state.status === 'loading') {
      return (
        <div
          className="border rounded-lg p-4 bg-gray-50 border-gray-200 text-gray-600"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm">Loading consent status...</span>
        </div>
      )
    }
    return null
  }

  const expiryDate = formatDate(state.expiresAt)

  return (
    <div
      className={`border rounded-lg p-4 ${getBannerClasses(state.status)}`}
      role="banner"
      aria-live="polite"
      data-testid="consent-banner"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg
            className={`h-5 w-5 ${getIconClasses(state.status)}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium" data-testid="consent-banner-message">
              {state.message}
            </p>
            {expiryDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Expires: {expiryDate}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          onKeyDown={handleKeyDown}
          className="text-muted-foreground hover:text-foreground rounded p-1 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label="Dismiss consent banner"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
