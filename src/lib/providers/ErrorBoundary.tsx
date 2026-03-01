import type { ReactNode } from 'react'
import React, { Component } from 'react'
import { toast } from 'react-hot-toast'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo)

    // Show error toast
    toast.error('An error occurred. Please try again.')

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI if provided, otherwise render default error UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className='border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border p-4'>
          <h2 className='text-red-800 dark:text-red-200 mb-2 text-lg font-semibold'>
            Something went wrong
          </h2>
          <p className='text-red-600 dark:text-red-300 mb-4 text-sm'>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className='bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800 rounded px-4 py-2 text-sm font-medium'
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC to wrap components with error boundary
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  options: Omit<Props, 'children'> = {},
): React.FC<T> {
  return function WithErrorBoundaryWrapper(props: T) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Custom hook for programmatic error throwing
export function useErrorBoundary() {
  return {
    throwError: (error: Error) => {
      throw error
    },
  }
}
