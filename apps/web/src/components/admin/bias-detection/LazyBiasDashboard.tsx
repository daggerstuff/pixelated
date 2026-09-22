import { Suspense, lazy } from 'react'

// Lazy load the heavy bias dashboard
const BiasDashboard = lazy(async () =>
  import('./BiasDashboard').then((module) => ({
    default: module.BiasDashboard,
  })),
)

interface LazyBiasDashboardProps {
  [key: string]: unknown
}

function BiasLoadingFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2 h-8 w-64 animate-pulse rounded-none bg-popover"></div>
              <div className="h-4 w-96 animate-pulse rounded-none bg-secondary"></div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 w-24 animate-pulse rounded-none bg-popover"></div>
              <div className="h-10 w-24 animate-pulse rounded-none bg-popover"></div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-none border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="mb-2 h-4 w-20 animate-pulse rounded-none bg-secondary"></div>
                  <div className="h-8 w-16 animate-pulse rounded-none bg-popover"></div>
                </div>
                <div className="h-8 w-8 animate-pulse rounded-none bg-popover"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-none border border-border bg-card p-6"
            >
              <div className="mb-4 h-6 w-48 animate-pulse rounded-none bg-popover"></div>
              <div className="h-64 animate-pulse rounded-none bg-secondary"></div>
            </div>
          ))}
        </div>

        {/* Loading Message */}
        <div className="fixed bottom-4 right-4 rounded-none bg-primary px-4 py-2 text-primary-foreground">
          <div className="flex items-center space-x-2">
            <div className="border-white h-4 w-4 animate-spin rounded-none border-b-2"></div>
            <span>Loading Bias Detection Dashboard...</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LazyBiasDashboard(props: LazyBiasDashboardProps) {
  return (
    <Suspense fallback={<BiasLoadingFallback />}>
      <BiasDashboard {...props} />
    </Suspense>
  )
}
