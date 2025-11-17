/**
 * Error message component for consistent error display
 */

import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { normalizeError, formatErrorForUser, getFieldErrors } from '@/lib/error'
import type { ReactNode } from 'react'

export interface ErrorMessageProps {
  error?: unknown
  fieldErrors?: Record<string, string>
  className?: string
  /**
   * Show technical details
   */
  showDetails?: boolean
  /**
   * Custom error message
   */
  message?: string
  /**
   * Custom fallback component
   */
  fallback?: ReactNode
}

export function ErrorMessage({
  error,
  fieldErrors,
  className,
  showDetails = false,
  message,
  fallback,
}: ErrorMessageProps) {
  if (!error && !fieldErrors && !message) {
    return null
  }

  const normalizedError = error ? normalizeError(error) : null
  const displayMessage = message || (normalizedError ? formatErrorForUser(normalizedError) : null)
  const fieldErrs = fieldErrors || (error ? getFieldErrors(error) : undefined)

  if (fallback && !displayMessage && !fieldErrs) {
    return <>{fallback}</>
  }

  if (fieldErrs && Object.keys(fieldErrs).length > 0) {
    return (
      <div className={cn('space-y-2', className)}>
        {Object.entries(fieldErrs).map(([field, errorMessage]) => (
          <Alert key={field} variant="error" className="text-sm">
            <strong className="font-medium capitalize">{field}:</strong> {errorMessage}
          </Alert>
        ))}
      </div>
    )
  }

  if (!displayMessage) {
    return null
  }

  return (
    <Alert variant="error" className={className}>
      {displayMessage}
      {showDetails && normalizedError && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
            {normalizedError.message}
            {normalizedError.code && `\nCode: ${normalizedError.code}`}
          </pre>
        </details>
      )}
    </Alert>
  )
}

export interface FieldErrorProps {
  error?: string
  className?: string
}

export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) {
    return null
  }

  return (
    <p className={cn('text-sm text-red-500 mt-1', className)} role="alert">
      {error}
    </p>
  )
}

