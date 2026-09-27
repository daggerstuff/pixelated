import { Suspense, lazy } from 'react'

import type { SecurityLevel } from '../../hooks/useSecurity'
import type { Message } from '../../types/chat'

// Lazy load the heavy analytics dashboard
const AnalyticsDashboardReact = lazy(
  async () => import('./AnalyticsDashboardReact'),
)

interface LazyAnalyticsDashboardProps {
  messages: Message[]
  securityLevel: SecurityLevel
  encryptionEnabled: boolean
  scenario: string
}

function AnalyticsLoadingFallback() {
  return (
    <div className="overflow-hidden rounded-none border border-border bg-card text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary p-3">
        <h2 className="text-lg font-medium">Therapy Analytics</h2>
        <div className="flex items-center space-x-2">
          <span className="rounded-none bg-background px-2 py-1 text-xs text-muted-foreground">
            Loading...
          </span>
        </div>
      </div>

      {/* Loading Content */}
      <div className="p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-12 w-12 animate-spin rounded-none border-b-2 border-ring"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                Loading Analytics Dashboard
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Initializing secure analytics engine...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LazyAnalyticsDashboard(
  props: LazyAnalyticsDashboardProps,
) {
  return (
    <Suspense fallback={<AnalyticsLoadingFallback />}>
      <AnalyticsDashboardReact {...props} />
    </Suspense>
  )
}
