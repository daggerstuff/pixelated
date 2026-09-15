import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface DashboardErrorBoundaryProps {
  children: ReactNode
}

interface DashboardErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level error boundary for the whole BiasDashboard island.
 *
 * ChartErrorBoundary only wraps the chart tabs. Any throw elsewhere in the
 * island tree (Header, SummaryCards, filter controls, a fetch race, or a
 * Recharts/use-sync-external-store interop bug) has no parent boundary, so
 * React 19 unmounts the entire astro-island and the dashboard renders blank.
 * This boundary contains that failure and shows a recoverable fallback.
 */
export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  public override state: DashboardErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(
    error: Error,
  ): DashboardErrorBoundaryState {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Dependency-free logging so this never throws in tests or production.
    if (typeof console !== 'undefined' && console.error) {
      console.error(
        '[DashboardErrorBoundary]',
        error.message,
        errorInfo.componentStack,
      )
    }
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-6">
          <div className="border-border bg-card text-card-foreground rounded-md border p-6">
            <h2 className="text-lg font-semibold">
              Dashboard failed to render
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              className="text-foreground/80 mt-4 text-sm underline"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Reload dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default DashboardErrorBoundary