import type { ErrorInfo, ReactNode } from 'react'
import React, { Component } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { logger } from '@/lib/logger'

import { type ErrorContext } from './types'
import {
  normalizeError,
  logError,
  formatErrorForUser,
  createErrorContext,
} from './utils'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /**
   * Component name for error context
   */
  componentName?: string
  /**
   * Whether to show retry button
   */
  showRetry?: boolean
  /**
   * Custom error recovery handler
   */
  onRecover?: () => void | Promise<void>
  /**
   * Whether to log errors to monitoring service
   */
  logToMonitoring?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

const MAX_RETRY_COUNT = 3

export class ErrorBoundary extends Component<Props, State> {
  private getSentryClient():
    | {
        captureException: (
          error: Error,
          context?: Record<string, unknown>,
        ) => void
      }
    | undefined {
    if (typeof window === 'undefined') {
      return undefined
    }

    return (
      window as Window & {
        Sentry?: {
          captureException: (
            error: Error,
            context?: Record<string, unknown>,
          ) => void
        }
      }
    ).Sentry
  }

  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context: ErrorContext = createErrorContext({
      componentName: this.props.componentName,
      metadata: {
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
      },
    })

    const normalizedError = normalizeError(error, context)
    logError(normalizedError, context)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to monitoring service if enabled
    if (this.props.logToMonitoring !== false) {
      // Integration point for monitoring services (Sentry, etc.)
      const sentry = this.getSentryClient()
      if (sentry) {
        try {
          sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
            },
            tags: {
              component: this.props.componentName ?? 'Unknown',
            },
          })
        } catch (monitoringError) {
          logger.warn('Failed to log error to monitoring service', {
            error: monitoringError,
          })
        }
      }
    }

    this.setState({ errorInfo })
  }

  private handleReset = async () => {
    if (this.state.retryCount >= MAX_RETRY_COUNT) {
      // Max retries reached, reload page
      window.location.reload()
      return
    }

    try {
      // Call custom recovery handler if provided
      if (this.props.onRecover) {
        await this.props.onRecover()
      }

      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
      })
    } catch (recoveryError) {
      logger.error('Error recovery failed', { error: recoveryError })
      // If recovery fails, reload page
      window.location.reload()
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const normalizedError = this.state.error
        ? normalizeError(this.state.error, {
            componentName: this.props.componentName,
          })
        : null

      const userMessage = normalizedError
        ? formatErrorForUser(normalizedError)
        : 'An unexpected error occurred'

      const canRetry =
        this.props.showRetry !== false &&
        this.state.retryCount < MAX_RETRY_COUNT &&
        normalizedError?.recoverable

      return (
        <Card className='mx-auto my-8 max-w-lg p-6'>
          <Alert
            variant='error'
            title='Something went wrong'
            description={userMessage}
          />

          {this.state.error && (
            <details className='text-muted-foreground mt-4 text-xs'>
              <summary className='cursor-pointer'>Technical details</summary>
              <pre className='bg-muted mt-2 overflow-auto rounded p-2'>
                {this.state.error.message}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\n'}
                    Component Stack:
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}

          <div className='mt-4 flex justify-end gap-2'>
            {canRetry && (
              <Button onClick={this.handleReset} variant='outline'>
                Try Again ({MAX_RETRY_COUNT - this.state.retryCount} attempts
                left)
              </Button>
            )}
            <Button onClick={this.handleReload}>Reload Page</Button>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
