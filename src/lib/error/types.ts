/**
 * Error types and utilities for comprehensive error handling
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  API = 'api',
  UI = 'ui',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  userId?: string
  sessionId?: string
  componentName?: string
  action?: string
  metadata?: Record<string, unknown>
  timestamp?: Date
}

export interface FormattedError {
  message: string
  code?: string
  severity: ErrorSeverity
  category: ErrorCategory
  context?: ErrorContext
  originalError?: unknown
  recoverable: boolean
  retryable: boolean
}

export class AppError extends Error {
  public readonly code: string
  public readonly severity: ErrorSeverity
  public readonly category: ErrorCategory
  public readonly context?: ErrorContext
  public readonly recoverable: boolean
  public readonly retryable: boolean

  constructor(
    message: string,
    options: {
      code?: string
      severity?: ErrorSeverity
      category?: ErrorCategory
      context?: ErrorContext
      recoverable?: boolean
      retryable?: boolean
      cause?: unknown
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.code = options.code ?? 'app.unknown_error'
    this.severity = options.severity ?? ErrorSeverity.MEDIUM
    this.category = options.category ?? ErrorCategory.UNKNOWN
    this.context = options.context
    this.recoverable = options.recoverable ?? true
    this.retryable = options.retryable ?? false
  }

  toJSON(): FormattedError {
    return {
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      context: this.context,
      originalError: this.cause,
      recoverable: this.recoverable,
      retryable: this.retryable,
    }
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
    context?: ErrorContext,
  ) {
    super(message, {
      code: 'validation.error',
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.VALIDATION,
      context,
      recoverable: true,
      retryable: false,
    })
    this.name = 'ValidationError'
  }
}

export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: ErrorContext,
  ) {
    super(message, {
      code: 'network.error',
      severity: statusCode && statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      context,
      recoverable: true,
      retryable: statusCode !== 400 && statusCode !== 401 && statusCode !== 403,
    })
    this.name = 'NetworkError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, {
      code: 'auth.error',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.AUTHENTICATION,
      context,
      recoverable: true,
      retryable: false,
    })
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, {
      code: 'authz.error',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.AUTHORIZATION,
      context,
      recoverable: false,
      retryable: false,
    })
    this.name = 'AuthorizationError'
  }
}

