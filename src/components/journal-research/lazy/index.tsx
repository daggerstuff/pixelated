/**
 * Lazy-loaded components for journal research module
 * Implements code splitting and lazy loading for performance optimization
 */

import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { ErrorBoundary } from '@/lib/error'

// Loading fallback component
function LoadingFallback({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-8">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

// Error fallback component
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-8">
      <div className="text-center">
        <p className="text-sm text-red-500">Failed to load component</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    </div>
  )
}

/**
 * Higher-order component for lazy loading with Suspense and ErrorBoundary
 */
function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode,
) {
  return function LazyComponent(props: P) {
    return (
      <ErrorBoundary
        componentName={Component.displayName || Component.name}
        fallback={<ErrorFallback error={new Error('Component load failed')} />}
      >
        <Suspense fallback={fallback || <LoadingFallback />}>
          <Component {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }
}

// Lazy load page components
export const LazyDashboardPage = withLazyLoading(
  lazy(() =>
    import('../pages/DashboardPage').then((module) => ({
      default: module.DashboardPage,
    })),
  ),
  <LoadingFallback message="Loading dashboard..." />,
)

export const LazySessionsListPage = withLazyLoading(
  lazy(() =>
    import('../pages/SessionsListPage').then((module) => ({
      default: module.SessionsListPage,
    })),
  ),
  <LoadingFallback message="Loading sessions..." />,
)

export const LazySessionDetailPage = withLazyLoading(
  lazy(() =>
    import('../pages/SessionDetailPage').then((module) => ({
      default: module.SessionDetailPage,
    })),
  ),
  <LoadingFallback message="Loading session details..." />,
)

export const LazyDiscoveryPage = withLazyLoading(
  lazy(() =>
    import('../pages/DiscoveryPage').then((module) => ({
      default: module.DiscoveryPage,
    })),
  ),
  <LoadingFallback message="Loading discovery..." />,
)

export const LazyEvaluationPage = withLazyLoading(
  lazy(() =>
    import('../pages/EvaluationPage').then((module) => ({
      default: module.EvaluationPage,
    })),
  ),
  <LoadingFallback message="Loading evaluation..." />,
)

export const LazyAcquisitionPage = withLazyLoading(
  lazy(() =>
    import('../pages/AcquisitionPage').then((module) => ({
      default: module.AcquisitionPage,
    })),
  ),
  <LoadingFallback message="Loading acquisition..." />,
)

export const LazyIntegrationPage = withLazyLoading(
  lazy(() =>
    import('../pages/IntegrationPage').then((module) => ({
      default: module.IntegrationPage,
    })),
  ),
  <LoadingFallback message="Loading integration..." />,
)

export const LazyReportsPage = withLazyLoading(
  lazy(() =>
    import('../pages/ReportsPage').then((module) => ({
      default: module.ReportsPage,
    })),
  ),
  <LoadingFallback message="Loading reports..." />,
)

// Lazy load feature components (heavy components)
export const LazyDashboard = withLazyLoading(
  lazy(() =>
    import('../features/Dashboard').then((module) => ({
      default: module.Dashboard,
    })),
  ),
  <LoadingFallback message="Loading dashboard..." />,
)

export const LazyProgressTracker = withLazyLoading(
  lazy(() =>
    import('../features/ProgressTracker').then((module) => ({
      default: module.ProgressTracker,
    })),
  ),
  <LoadingFallback message="Loading progress..." />,
)

export const LazyProgressCharts = withLazyLoading(
  lazy(() =>
    import('../charts/ProgressCharts').then((module) => ({
      default: module.ProgressCharts,
    })),
  ),
  <LoadingFallback message="Loading charts..." />,
)

export const LazyReportGenerator = withLazyLoading(
  lazy(() =>
    import('../features/ReportGenerator').then((module) => ({
      default: module.ReportGenerator,
    })),
  ),
  <LoadingFallback message="Loading report generator..." />,
)

export const LazyReportViewer = withLazyLoading(
  lazy(() =>
    import('../features/ReportViewer').then((module) => ({
      default: module.ReportViewer,
    })),
  ),
  <LoadingFallback message="Loading report viewer..." />,
)

// Lazy load chart components
export const LazyMetricsChart = withLazyLoading(
  lazy(() =>
    import('../charts/MetricsChart').then((module) => ({
      default: module.MetricsChart,
    })),
  ),
  <LoadingFallback message="Loading metrics chart..." />,
)

export const LazyPhaseProgressChart = withLazyLoading(
  lazy(() =>
    import('../charts/PhaseProgressChart').then((module) => ({
      default: module.PhaseProgressChart,
    })),
  ),
  <LoadingFallback message="Loading progress chart..." />,
)

