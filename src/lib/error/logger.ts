/**
 * Error logging service with monitoring integration
 */

import {
  AppError,
  ErrorSeverity,
  ErrorCategory,
  type ErrorContext,
  type FormattedError,
} from './types'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { formatErrorForLogging } from './utils'

const logger = createBuildSafeLogger('error-logger')

export interface ErrorLogEntry {
  error: FormattedError
  context?: ErrorContext
  timestamp: Date
  userAgent?: string
  url?: string
  userId?: string
}

export interface MonitoringService {
  captureException(error: Error, context?: Record<string, unknown>): void
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void
  setUser(userId: string, metadata?: Record<string, unknown>): void
  setContext(key: string, context: Record<string, unknown>): void
}

class ErrorLoggingService {
  private monitoringService?: MonitoringService
  private errorQueue: ErrorLogEntry[] = []
  private maxQueueSize = 100
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.flushQueue()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
      })
    }
  }

  /**
   * Set monitoring service (e.g., Sentry)
   */
  setMonitoringService(service: MonitoringService) {
    this.monitoringService = service
  }

  /**
   * Log an error
   */
  logError(error: AppError, context?: ErrorContext) {
    const entry: ErrorLogEntry = {
      error: formatErrorForLogging(error),
      context: {
        ...context,
        timestamp: new Date(),
      },
      timestamp: new Date(),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userId: context?.userId,
    }

    // Log to console
    this.logToConsole(error, entry)

    // Send to monitoring service if available
    if (this.monitoringService) {
      this.sendToMonitoring(error, entry)
    } else if (this.isOnline) {
      // Queue for later if offline
      this.queueError(entry)
    }
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(error: AppError, entry: ErrorLogEntry) {
    const logData = {
      error: entry.error,
      context: entry.context,
      timestamp: entry.timestamp.toISOString(),
    }

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('Critical error', logData)
        break
      case ErrorSeverity.HIGH:
        logger.error('High severity error', logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error', logData)
        break
      case ErrorSeverity.LOW:
        logger.info('Low severity error', logData)
        break
    }
  }

  /**
   * Send error to monitoring service
   */
  private sendToMonitoring(error: AppError, entry: ErrorLogEntry) {
    if (!this.monitoringService) return

    try {
      const errorObj = error.cause instanceof Error ? error.cause : new Error(error.message)

      const context: Record<string, unknown> = {
        severity: error.severity,
        category: error.category,
        code: error.code,
        recoverable: error.recoverable,
        retryable: error.retryable,
        ...entry.context?.metadata,
      }

      if (entry.context?.userId) {
        this.monitoringService.setUser(entry.context.userId, {
          sessionId: entry.context.sessionId,
        })
      }

      if (entry.context) {
        this.monitoringService.setContext('error', {
          componentName: entry.context.componentName,
          action: entry.context.action,
        })
      }

      this.monitoringService.captureException(errorObj, context)
    } catch (monitoringError) {
      logger.warn('Failed to send error to monitoring service', {
        error: monitoringError,
      })
      // Queue for retry
      this.queueError(entry)
    }
  }

  /**
   * Queue error for later sending
   */
  private queueError(entry: ErrorLogEntry) {
    this.errorQueue.push(entry)
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift() // Remove oldest entry
    }
  }

  /**
   * Flush queued errors
   */
  private flushQueue() {
    if (!this.monitoringService || !this.isOnline) return

    const entries = [...this.errorQueue]
    this.errorQueue = []

    entries.forEach((entry) => {
      // Recreate AppError from formatted error
      const error = new AppError(entry.error.message, {
        code: entry.error.code,
        severity: entry.error.severity as ErrorSeverity,
        category: entry.error.category as ErrorCategory,
        context: entry.context,
        recoverable: entry.error.recoverable,
        retryable: entry.error.retryable,
      })
      this.sendToMonitoring(error, entry)
    })
  }

  /**
   * Set user context for monitoring
   */
  setUser(userId: string, metadata?: Record<string, unknown>) {
    if (this.monitoringService) {
      this.monitoringService.setUser(userId, metadata)
    }
  }

  /**
   * Set additional context
   */
  setContext(key: string, context: Record<string, unknown>) {
    if (this.monitoringService) {
      this.monitoringService.setContext(key, context)
    }
  }
}

export const errorLoggingService = new ErrorLoggingService()

/**
 * Initialize error logging with monitoring service
 */
export function initializeErrorLogging(monitoringService?: MonitoringService) {
  if (monitoringService) {
    errorLoggingService.setMonitoringService(monitoringService)
  }

  // Set up global error handlers
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      const error = new AppError(event.message, {
        code: 'global.error',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
        recoverable: false,
      })
      errorLoggingService.logError(error, {
        componentName: 'Global',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const error = normalizeErrorForLogging(event.reason, {
        componentName: 'UnhandledPromiseRejection',
      })
      errorLoggingService.logError(error)
    })
  }
}

/**
 * Normalize error for logging
 */
function normalizeError(
  error: unknown,
  context?: ErrorContext,
): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      code: 'unhandled.error',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.UNKNOWN,
      context,
      recoverable: true,
    })
  }

  return new AppError(String(error), {
    code: 'unknown.error',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.UNKNOWN,
    context,
    recoverable: true,
  })
}

