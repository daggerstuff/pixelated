/**
 * Error handling utilities
 */

import { z } from 'zod'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import {
  AppError,
  ValidationError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ErrorSeverity,
  ErrorCategory,
  type ErrorContext,
  type FormattedError,
} from './types'

const logger = createBuildSafeLogger('error-handler')

/**
 * Normalize any error into an AppError
 */
export function normalizeError(
  error: unknown,
  context?: ErrorContext,
): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {}
    error.issues.forEach((err) => {
      const path = err.path.join('.')
      fieldErrors[path] = err.message
    })
    return new ValidationError('Validation failed', fieldErrors, context)
  }

  if (error instanceof TypeError || error instanceof ReferenceError) {
    return new AppError((error instanceof Error ? error.message : "Unknown error"), {
      code: 'runtime.error',
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      context,
      recoverable: false,
    })
  }

  if (error instanceof Error) {
    // Check for network-related errors
    if (
      (error instanceof Error ? error.message : "Unknown error").includes('fetch') ||
      (error instanceof Error ? error.message : "Unknown error").includes('network') ||
      (error instanceof Error ? error.message : "Unknown error").includes('timeout')
    ) {
      return new NetworkError((error instanceof Error ? error.message : "Unknown error"), undefined, context)
    }

    // Check for authentication errors
    if (
      (error instanceof Error ? error.message : "Unknown error").includes('unauthorized') ||
      (error instanceof Error ? error.message : "Unknown error").includes('authentication') ||
      (error instanceof Error ? error.message : "Unknown error").includes('401')
    ) {
      return new AuthenticationError((error instanceof Error ? error.message : "Unknown error"), context)
    }

    // Check for authorization errors
    if (
      (error instanceof Error ? error.message : "Unknown error").includes('forbidden') ||
      (error instanceof Error ? error.message : "Unknown error").includes('authorization') ||
      (error instanceof Error ? error.message : "Unknown error").includes('403')
    ) {
      return new AuthorizationError((error instanceof Error ? error.message : "Unknown error"), context)
    }

    return new AppError((error instanceof Error ? error.message : "Unknown error"), {
      code: 'unknown.error',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.UNKNOWN,
      context,
      recoverable: true,
    })
  }

  // Handle non-Error objects
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'An unknown error occurred'

  return new AppError(message, {
    code: 'unknown.error',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.UNKNOWN,
    context,
    recoverable: true,
  })
}

/**
 * Format error for display to users
 */
export function formatErrorForUser(error: AppError): string {
  // Don't expose internal error details to users
  switch (error.category) {
    case ErrorCategory.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    case ErrorCategory.AUTHENTICATION:
      return 'Your session has expired. Please log in again.'
    case ErrorCategory.AUTHORIZATION:
      return "You don't have permission to perform this action."
    case ErrorCategory.VALIDATION:
      return (error instanceof Error ? error.message : "Unknown error") || 'Please check your input and try again.'
    default:
      return 'Something went wrong. Please try again later.'
  }
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: AppError): FormattedError {
  return error.toJSON()
}

/**
 * Check if error is recoverable
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.recoverable
  }
  // Assume unknown errors are recoverable
  return true
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable
  }
  return false
}

/**
 * Extract user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  const normalized = normalizeError(error)
  return formatErrorForUser(normalized)
}

/**
 * Extract field errors from validation error
 */
export function getFieldErrors(
  error: unknown,
): Record<string, string> | undefined {
  if (error instanceof ValidationError) {
    return error.fieldErrors
  }
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {}
    error.issues.forEach((err) => {
      const path = err.path.join('.')
      fieldErrors[path] = err.message
    })
    return fieldErrors
  }
  return undefined
}

/**
 * Create error context from current state
 */
export function createErrorContext(
  overrides?: Partial<ErrorContext>,
): ErrorContext {
  return {
    timestamp: new Date(),
    ...overrides,
  }
}

/**
 * Log error with appropriate level based on severity
 */
export function logError(error: AppError, additionalContext?: ErrorContext) {
  const context = { ...error.context, ...additionalContext }
  const formatted = formatErrorForLogging(error)

  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('Critical error occurred', { error: formatted, context })
      break
    case ErrorSeverity.HIGH:
      logger.error('High severity error', { error: formatted, context })
      break
    case ErrorSeverity.MEDIUM:
      logger.warn('Medium severity error', { error: formatted, context })
      break
    case ErrorSeverity.LOW:
      logger.info('Low severity error', { error: formatted, context })
      break
  }
}
