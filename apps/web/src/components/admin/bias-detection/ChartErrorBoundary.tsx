import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ChartErrorBoundaryProps {
  children: ReactNode
  /** Label for the error message, e.g. the chart/tab name. */
  label?: string
}

interface ChartErrorBoundaryState {
  hasError: boolean
}

/**
 * Minimal self-contained error boundary for chart sections.
 *
 * Recharts (v3.x) can throw during render or ref-cleanup on re-renders
 * (e.g. WebSocket status flips triggering dashboard re-renders). Without a
 * boundary, React 19 unmounts the whole island, leaving the dashboard blank.
 * This boundary contains the failure to the chart section and shows a
 * recoverable fallback instead.
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  public override state: ChartErrorBoundaryState = { hasError: false }

  public static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Keep the render path dependency-free so this never throws in tests.
    if (typeof console !== 'undefined' && console.error) {
      console.error(
        `[ChartErrorBoundary:${this.props.label ?? 'chart'}]`,
        error.message,
        errorInfo.componentStack,
      )
    }
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="border-border bg-card text-card-foreground rounded-md border p-4"
        >
          <p className="text-sm font-medium">
            {this.props.label ?? 'Chart'} is temporarily unavailable
          </p>
          <button
            type="button"
            className="text-foreground/80 mt-2 text-xs underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ChartErrorBoundary