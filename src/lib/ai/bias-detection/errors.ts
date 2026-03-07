/**
 * Comprehensive Error Handling System for Bias Detection Engine
 *
 * This module provides a complete error taxonomy and handling system
 * for production deployment, including proper error types, recovery strategies,
 * and detailed error reporting capabilities.
 */

/**
 * Base error class for all bias detection related errors
 */
export abstract class BiasDetectionError extends Error {
  public readonly code: string
  public readonly severity: 'low' | 'medium' | 'high' | 'critical'
  public readonly category:
    | 'configuration'
    | 'validation'
    | 'service'
    | 'data'
    | 'security'
    | 'performance'
    | 'system'
  public readonly timestamp: Date
  public readonly context: Record<string, unknown>
  public readonly recoverable: boolean
  public readonly userMessage?: string | undefined

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    category:
      | 'configuration'
      | 'validation'
      | 'service'
      | 'data'
      | 'security'
      | 'performance'
      | 'system',
    options: {
      context?: Record<string, unknown>
      recoverable?: boolean
      userMessage?: string
      cause?: Error | unknown
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = this.constructor.name
    this.code = code
    this.severity = severity
    this.category = category
    this.timestamp = new Date()
    this.context = options.context || {}
    this.recoverable = options.recoverable ?? false
    this.userMessage = options.userMessage

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Get a user-friendly error message
   */
  public getUserMessage(): string {
    return this.userMessage || this.getDefaultUserMessage()
  }

  /**
   * Get default user message (to be overridden by subclasses)
   */
  protected getDefaultUserMessage(): string {
    return 'An error occurred in the bias detection system. Please contact support.'
  }

  /**
   * Convert error to JSON for logging and transmission
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      stack: this.stack,
    }
  }

  /**
   * Create a sanitized version for client transmission
   */
  public toClientSafe(): Record<string, unknown> {
    return {
      code: this.code,
      severity: this.severity,
      category: this.category,
      userMessage: this.getUserMessage(),
      recoverable: this.recoverable,
    }
  }
}

/**
 * Configuration-related errors
 */
export class BiasConfigurationError extends BiasDetectionError {
  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      configProperty?: string
      configValue?: unknown
      userMessage?: string
      cause?: Error | unknown
    } = {},
  ) {
    super(message, 'BIAS_CONFIG_ERROR', 'high', 'configuration', {
      ...options,
      context: {
        ...options.context,
        configProperty: options.configProperty,
        configValue: options.configValue,
      },
    })
  }

  protected override getDefaultUserMessage(): string {
    return 'Configuration error occurred. Please check your bias detection settings.'
  }
}

export class BiasConfigurationValidationError extends BiasDetectionError {
  public readonly configProperty: string
  public readonly configValue: unknown
  public readonly expectedType: string

  constructor(
    property: string,
    value: unknown,
    expectedType: string,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
      cause?: Error | unknown
    } = {},
  ) {
    super(
      `Invalid configuration for property '${property}': expected ${expectedType}, got ${typeof value}`,
      'BIAS_CONFIG_VALIDATION_ERROR',
      'high',
      'configuration',
      {
        ...options,
        context: {
          ...options.context,
          configProperty: property,
          configValue: value,
          expectedType,
          actualType: typeof value,
        },
      },
    )
    this.configProperty = property
    this.configValue = value
    this.expectedType = expectedType
  }
}

export class BiasThresholdError extends BiasConfigurationError {
  public readonly thresholdName: string
  public readonly value: number
  public readonly min: number
  public readonly max: number

  constructor(
    thresholdName: string,
    value: number,
    min: number,
    max: number,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(
      `Invalid threshold '${thresholdName}': value ${value} must be between ${min} and ${max}`,
      {
        ...options,
        configProperty: thresholdName,
        configValue: value,
        context: {
          ...options.context,
          min,
          max,
          actualValue: value,
        },
      },
    )
    this.thresholdName = thresholdName
    this.value = value
    this.min = min
    this.max = max
  }

  protected override getDefaultUserMessage(): string {
    return 'Bias threshold configuration is invalid. Please use values between 0 and 1.'
  }
}

/**
 * General validation errors
 */
export class BiasValidationError extends BiasDetectionError {
  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      field?: string
      value?: unknown
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_VALIDATION_ERROR', 'medium', 'validation', {
      ...options,
      context: {
        ...options.context,
        field: options.field,
        value: options.value,
      },
    })
  }

  protected override getDefaultUserMessage(): string {
    return 'Validation error occurred. Please check your input data.'
  }
}

/**
 * Session validation errors
 */
export class BiasSessionValidationError extends BiasDetectionError {
  public readonly sessionId?: string | undefined
  public readonly validationField: string

  constructor(
    sessionId: string | undefined,
    field: string,
    message: string,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_SESSION_VALIDATION_ERROR', 'medium', 'validation', {
      ...options,
      context: {
        ...options.context,
        sessionId,
        field,
      },
    })
    this.sessionId = sessionId
    this.validationField = field
  }

  protected override getDefaultUserMessage(): string {
    return 'Session data validation failed. Please check the input data format.'
  }
}

/**
 * Service-related errors (Python bridge, API calls)
 */
export class BiasPythonServiceError extends BiasDetectionError {
  public readonly serviceUrl?: string | undefined
  public readonly httpStatus?: number | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      serviceUrl?: string
      httpStatus?: number
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_PYTHON_SERVICE_ERROR', 'high', 'service', options)
    this.serviceUrl = options.serviceUrl
    this.httpStatus = options.httpStatus
  }

  protected override getDefaultUserMessage(): string {
    return 'Bias detection service is temporarily unavailable. Please try again later.'
  }
}

export class BiasPythonServiceTimeoutError extends BiasPythonServiceError {
  public readonly timeout: number

  constructor(
    timeout: number,
    options: {
      context?: Record<string, unknown>
      serviceUrl?: string
      userMessage?: string
    } = {},
  ) {
    super(`Python service request timed out after ${timeout}ms`, {
      ...options,
      context: {
        ...options.context,
        timeout,
      },
    })
    this.timeout = timeout
  }
}

export class BiasPythonServiceUnavailableError extends BiasPythonServiceError {
  constructor(
    serviceUrl: string,
    options: {
      context?: Record<string, unknown>
      httpStatus?: number
      userMessage?: string
    } = {},
  ) {
    super(`Python bias detection service is unavailable at ${serviceUrl}`, {
      ...options,
      serviceUrl,
      context: {
        ...options.context,
        serviceUrl,
      },
    })
  }
}

/**
 * Data-related errors
 */
export class BiasDataError extends BiasDetectionError {
  public readonly dataType?: string | undefined
  public readonly dataSize?: number | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      dataType?: string
      dataSize?: number
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_DATA_ERROR', 'medium', 'data', options)
    this.dataType = options.dataType
    this.dataSize = options.dataSize
  }

  protected override getDefaultUserMessage(): string {
    return 'Data processing error occurred. Please check your input data.'
  }
}

export class BiasDataCorruptionError extends BiasDataError {
  constructor(
    dataType: string,
    message: string,
    options: {
      context?: Record<string, unknown>
      dataSize?: number
      userMessage?: string
    } = {},
  ) {
    super(`Data corruption detected in ${dataType}: ${message}`, {
      ...options,
      dataType,
      context: {
        ...options.context,
        dataType,
        corruptionType: message,
      },
    })
  }

  protected override getDefaultUserMessage(): string {
    return 'Data corruption detected. Please verify your input data and try again.'
  }
}

/**
 * Security-related errors
 */
export class BiasSecurityError extends BiasDetectionError {
  public readonly securityContext?: string | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      securityContext?: string
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_SECURITY_ERROR', 'high', 'security', options)
    this.securityContext = options.securityContext
  }

  protected override getDefaultUserMessage(): string {
    return 'Security violation detected. Access denied.'
  }
}

export class BiasAuthenticationError extends BiasSecurityError {
  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(message, {
      ...options,
      securityContext: 'authentication',
    })
  }
}

export class BiasAuthorizationError extends BiasSecurityError {
  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(message, {
      ...options,
      securityContext: 'authorization',
    })
  }
}

/**
 * Performance-related errors
 */
export class BiasPerformanceError extends BiasDetectionError {
  public readonly operation?: string | undefined
  public readonly duration?: number | undefined
  public readonly threshold?: number | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      operation?: string
      duration?: number
      threshold?: number
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_PERFORMANCE_ERROR', 'medium', 'performance', options)
    this.operation = options.operation
    this.duration = options.duration
    this.threshold = options.threshold
  }

  protected override getDefaultUserMessage(): string {
    return 'Performance degradation detected. The system may be experiencing high load.'
  }
}

export class BiasPerformanceTimeoutError extends BiasPerformanceError {
  constructor(
    operation: string,
    duration: number,
    threshold: number,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(
      `Operation '${operation}' exceeded performance threshold: ${duration}ms > ${threshold}ms`,
      {
        ...options,
        operation,
        duration,
        threshold,
      } as {
        context?: Record<string, unknown>
        operation: string
        duration?: number
        threshold?: number
        userMessage?: string
      },
    )
  }
}

export class BiasResourceExhaustionError extends BiasPerformanceError {
  constructor(
    resource: string,
    options: {
      context?: Record<string, unknown>
      operation: string
      duration?: number
      threshold?: number
      userMessage?: string
    },
  ) {
    super(`Resource exhaustion: ${resource}`, {
      ...options,
      context: {
        ...options.context,
        resource,
      },
      operation: options.operation,
    } as {
      context?: Record<string, unknown>
      operation: string
      duration?: number
      threshold?: number
      userMessage?: string
    })
  }
}

/**
 * Model-related errors
 */
export class BiasModelError extends BiasDetectionError {
  public readonly modelId?: string | undefined
  public readonly confidenceScore?: number | undefined
  public readonly biasType?: string | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      modelId?: string
      confidenceScore?: number
      biasType?: string
      userMessage?: string
    } = {},
  ) {
    super(message, 'BIAS_MODEL_ERROR', 'high', 'system', options)
    this.modelId = options.modelId
    this.confidenceScore = options.confidenceScore
    this.biasType = options.biasType
  }

  protected override getDefaultUserMessage(): string {
    return 'An error occurred within the bias detection model.'
  }
}

/**
 * System-related errors
 */
export class BiasSystemError extends BiasDetectionError {
  public readonly component?: string | undefined

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>
      component?: string
      userMessage?: string
    } = {},
  ) {
    const { component, context, ...rest } = options
    super(message, 'BIAS_SYSTEM_ERROR', 'critical', 'system', {
      ...rest,
      context: {
        ...context,
        component,
      },
    })
    this.component = component
  }

  protected override getDefaultUserMessage(): string {
    return 'A critical system error occurred in the bias detection engine. Please contact support immediately.'
  }
}

export class BiasInitializationError extends BiasSystemError {
  constructor(
    component: string,
    message: string,
    options: {
      context?: Record<string, unknown>
      userMessage?: string
    } = {},
  ) {
    super(`Failed to initialize ${component}: ${message}`, {
      ...options,
      component,
      context: {
        ...options.context,
        component,
        initializationError: message,
      },
    })
  }
}

/**
/**
 * Central error handling utility
 */

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return String(error)
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error occurred'
}

/**
 * Create BiasDetectionError from unknown error
 */
export function createErrorFromUnknown(
  error: unknown,
  context: {
    operation: string
    category?:
      | 'configuration'
      | 'validation'
      | 'service'
      | 'data'
      | 'security'
      | 'performance'
      | 'system'
    severity?: 'low' | 'medium' | 'high' | 'critical'
    additionalContext?: Record<string, unknown>
  },
): BiasDetectionError {
  const message = getErrorMessage(error)

  const errorOptions: {
    component: string
    context?: Record<string, unknown>
    userMessage: string
  } = {
    component: context.operation,
    userMessage: 'An unexpected error occurred during processing.',
    ...(context.additionalContext !== undefined
      ? { context: context.additionalContext }
      : {}),
  }

  return new BiasSystemError(
    `Error in ${context.operation}: ${message}`,
    errorOptions,
  )
}

/**
 * Determine if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof BiasDetectionError) {
    return error.recoverable
  }
  if (error instanceof Error) {
    // Network errors are typically retryable
    return (
      String(error).includes('fetch') ||
      String(error).includes('timeout') ||
      String(error).includes('network') ||
      String(error).includes('ECONNRESET') ||
      String(error).includes('ENOTFOUND')
    )
  }
  return false
}

/**
 * Get retry delay based on error type and attempt number
 */
export function getRetryDelay(error: unknown, attempt: number): number {
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds

  if (error instanceof BiasPythonServiceTimeoutError) {
    // Exponential backoff for timeout errors
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  }

  if (error instanceof BiasPythonServiceError) {
    // Linear backoff for service errors
    return Math.min(baseDelay * (attempt + 1), maxDelay)
  }

  // Default exponential backoff
  return Math.min(baseDelay * Math.pow(1.5, attempt), maxDelay)
}

/**
 * Should error be logged as critical alert
 */
export function shouldAlert(error: unknown): boolean {
  if (error instanceof BiasDetectionError) {
    return (
      error.severity === 'critical' ||
      (error.severity === 'high' && !error.recoverable)
    )
  }
  return false
}

/**
 * Extract monitoring metrics from error
 */
export function getMetrics(error: unknown): Record<string, unknown> {
  if (error instanceof BiasDetectionError) {
    return {
      errorCode: error.code,
      errorCategory: error.category,
      errorSeverity: error.severity,
      errorRecoverable: error.recoverable,
      errorTimestamp: error.timestamp.toISOString(),
      ...error.context,
    }
  }

  return {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    errorMessage: getErrorMessage(error),
    errorTimestamp: new Date().toISOString(),
  }
}

/**
 * Error aggregation for monitoring and alerting
 */
export class BiasErrorAggregator {
  private errorCounts: Map<string, number> = new Map()
  private errorSamples: Map<string, BiasDetectionError[]> = new Map()
  private readonly maxSamplesPerType = 10

  /**
   * Record error occurrence
   */
  recordError(error: unknown): void {
    if (error instanceof BiasDetectionError) {
      const key = `${error.code}_${error.severity}`
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1)

      if (!this.errorSamples.has(key)) {
        this.errorSamples.set(key, [])
      }

      const samples = this.errorSamples.get(key)!
      if (samples.length < this.maxSamplesPerType) {
        samples.push(error)
      }
    }
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalErrors: number
    errorsByType: Record<string, number>
    criticalErrors: number
    recoverableErrors: number
    samples: Record<string, BiasDetectionError[]>
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    )
    const errorsByType = Object.fromEntries(this.errorCounts)

    let criticalErrors = 0
    let recoverableErrors = 0

    for (const [_key, samples] of Array.from(this.errorSamples)) {
      for (const sample of samples) {
        if (sample.severity === 'critical') {
          criticalErrors++
        }
        if (sample.recoverable) {
          recoverableErrors++
        }
      }
    }

    return {
      totalErrors,
      errorsByType,
      criticalErrors,
      recoverableErrors,
      samples: Object.fromEntries(this.errorSamples),
    }
  }

  /**
   * Reset statistics
   */
  reset() {
    this.errorCounts.clear()
    this.errorSamples.clear()
  }
}

/**
 * Type guard utilities
 */
export function isBiasDetectionError(
  error: unknown,
): error is BiasDetectionError {
  return error instanceof BiasDetectionError
}

export function isBiasConfigurationError(
  error: unknown,
): error is BiasConfigurationError {
  return error instanceof BiasConfigurationError
}

export function isBiasValidationError(
  error: unknown,
): error is BiasValidationError {
  return error instanceof BiasValidationError
}

export function isBiasPythonServiceError(
  error: unknown,
): error is BiasPythonServiceError {
  return error instanceof BiasPythonServiceError
}

export function isBiasSecurityError(
  error: unknown,
): error is BiasSecurityError {
  return error instanceof BiasSecurityError
}

export function isBiasPerformanceError(
  error: unknown,
): error is BiasPerformanceError {
  return error instanceof BiasPerformanceError
}

export function isBiasSystemError(error: unknown): error is BiasSystemError {
  return error instanceof BiasSystemError
}
