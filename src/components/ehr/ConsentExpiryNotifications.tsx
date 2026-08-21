import { useCallback, useEffect, useState } from 'react'

interface ExpiryNotification {
  patientId: string
  patientName: string
  consentId: string
  expiresAt: string
  daysRemaining: number
  status: 'expiring-soon' | 'expiring-critical' | 'expired'
}

interface ConsentExpiryNotificationsProps {
  patientId?: string
}

const PAGE_SIZE = 10

function getStatusClasses(status: ExpiryNotification['status']): string {
  switch (status) {
    case 'expiring-soon':
      return 'bg-yellow-50 border-yellow-200'
    case 'expiring-critical':
      return 'bg-orange-50 border-orange-200'
    case 'expired':
      return 'bg-red-50 border-red-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

function getStatusBadgeClasses(status: ExpiryNotification['status']): string {
  switch (status) {
    case 'expiring-soon':
      return 'bg-yellow-100 text-yellow-700'
    case 'expiring-critical':
      return 'bg-orange-100 text-orange-700'
    case 'expired':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getStatusLabel(status: ExpiryNotification['status']): string {
  switch (status) {
    case 'expiring-soon':
      return 'Expiring Soon'
    case 'expiring-critical':
      return 'Expiring Critical'
    case 'expired':
      return 'Expired — Re-consent Required'
    default:
      return 'Unknown'
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

export function ConsentExpiryNotifications({
  patientId,
}: ConsentExpiryNotificationsProps) {
  const [notifications, setNotifications] = useState<ExpiryNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = patientId
        ? `/api/ehr/v1/consents/expiring?patient=${encodeURIComponent(patientId)}`
        : '/api/ehr/v1/consents/expiring'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }
      const data = await response.json() as ExpiryNotification[]
      setNotifications(data)
    } catch {
      setError('Failed to load expiry notifications')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE)
  const startIndex = currentPage * PAGE_SIZE
  const visibleNotifications = notifications.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  )

  if (loading) {
    return (
      <div
        className="border rounded-lg p-4"
        role="status"
        aria-live="polite"
        data-testid="expiry-notifications-loading"
      >
        <p className="text-sm text-muted-foreground">Loading expiry notifications...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="border rounded-lg p-4 bg-red-50 border-red-200"
        role="alert"
        data-testid="expiry-notifications-error"
      >
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void fetchNotifications()}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div
        className="border rounded-lg p-4 bg-green-50 border-green-200"
        data-testid="expiry-notifications-all-current"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-green-600"
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
          <p className="text-sm font-medium text-green-800">
            All consents current
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="border rounded-lg p-4"
      data-testid="expiry-notifications"
      role="region"
      aria-label="Consent expiry notifications"
    >
      <h2 className="text-lg font-semibold mb-3">Consent Expiry Notifications</h2>
      <ul className="space-y-2" role="list">
        {visibleNotifications.map((notification) => (
          <li
            key={notification.consentId}
            className={`border rounded-lg p-3 ${getStatusClasses(notification.status)}`}
            role="listitem"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClasses(notification.status)}`}
                  >
                    {getStatusLabel(notification.status)}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {notification.patientName}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {formatDate(notification.expiresAt)}
                  {notification.status !== 'expired' &&
                    ` — ${notification.daysRemaining} day${notification.daysRemaining === 1 ? '' : 's'} remaining`}
                </p>
              </div>
              <a
                href={`/admin/consent-management?patient=${encodeURIComponent(notification.patientId)}`}
                className="flex-shrink-0 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={`Renew consent for ${notification.patientName}`}
              >
                Renew Consent
              </a>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4" role="navigation" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
