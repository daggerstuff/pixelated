/**
 * Authentication and Token Error Classes
 * Custom error types for JWT authentication system with HIPAA compliance
 */

/**
 * Base authentication error
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AuthenticationError'
    Error.captureStackTrace(this, AuthenticationError)
  }
}

/**
 * Token validation error with specific failure reasons
 */
export class TokenValidationError extends AuthenticationError {
  constructor(
    message: string,
    public reason: TokenValidationReason,
  ) {
    super(message, 'TOKEN_VALIDATION_FAILED')
    this.name = 'TokenValidationError'
  }
}

/**
 * Token expiration error
 */
export class TokenExpiredError extends TokenValidationError {
  constructor(message: string = 'Token has expired') {
    super(message, 'EXPIRED')
    this.name = 'TokenExpiredError'
  }
}

/**
 * Token revocation error
 */
export class TokenRevokedError extends TokenValidationError {
  constructor(message: string = 'Token has been revoked') {
    super(message, 'REVOKED')
    this.name = 'TokenRevokedError'
  }
}

/**
 * Invalid token format or signature error
 */
export class InvalidTokenError extends TokenValidationError {
  constructor(message: string = 'Invalid token format or signature') {
    super(message, 'INVALID_FORMAT')
    this.name = 'InvalidTokenError'
  }
}

/**
 * Token type mismatch error
 */
export class TokenTypeMismatchError extends TokenValidationError {
  constructor(expected: string, actual: string) {
    super(
      `Invalid token type: expected ${expected}, got ${actual}`,
      'TYPE_MISMATCH',
    )
    this.name = 'TokenTypeMismatchError'
  }
}

/**
 * Session context validation error
 */
export class SessionContextError extends TokenValidationError {
  constructor(message: string) {
    super(message, 'SESSION_CONTEXT_INVALID')
    this.name = 'SessionContextError'
  }
}

/**
 * Replay attack detection error
 */
export class ReplayAttackError extends TokenValidationError {
  constructor(message: string = 'Potential replay attack detected') {
    super(message, 'REPLAY_ATTACK')
    this.name = 'ReplayAttackError'
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AuthenticationError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR')
    this.name = 'ConfigurationError'
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends AuthenticationError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    public limit?: number,
    public window?: number,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED')
    this.name = 'RateLimitError'
  }
}

/**
 * Permission denied error
 */
export class PermissionDeniedError extends AuthenticationError {
  constructor(
    message: string = 'Insufficient permissions',
    public requiredRole?: string,
    public userRole?: string,
    public requiredPermission?: string,
  ) {
    super(message, 'PERMISSION_DENIED')
    this.name = 'PermissionDeniedError'
  }
}

/**
 * Account security error
 */
export class AccountSecurityError extends AuthenticationError {
  constructor(
    message: string,
    public reason: AccountSecurityReason,
    public userId?: string,
  ) {
    super(message, 'ACCOUNT_SECURITY_VIOLATION')
    this.name = 'AccountSecurityError'
  }
}

/**
 * Token validation failure reasons
 */
export enum TokenValidationReason {
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  SESSION_CONTEXT_INVALID = 'SESSION_CONTEXT_INVALID',
  REPLAY_ATTACK = 'REPLAY_ATTACK',
  METADATA_NOT_FOUND = 'METADATA_NOT_FOUND',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  AUDIENCE_INVALID = 'AUDIENCE_INVALID',
  ISSUER_INVALID = 'ISSUER_INVALID',
}

/**
 * Account security violation reasons
 */
export enum AccountSecurityReason {
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  PASSWORD_EXPIRED = 'PASSWORD_EXPIRED',
  TOO_MANY_FAILED_ATTEMPTS = 'TOO_MANY_FAILED_ATTEMPTS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

/**
 * Error response formatter for API responses
 */
export class ErrorResponseFormatter {
  /**
   * Format authentication error for API response
   */
  static formatAuthenticationError(error: AuthenticationError): {
    error: string
    message: string
    code?: string
    details?: Record<string, unknown>
  } {
    const response: {
      error: string
      message: string
      code?: string
      details?: Record<string, unknown>
    } = {
      error: error.name,
      message: error.message,
      code: error.code,
    }

    // Add specific details based on error type
    if (error instanceof TokenValidationError) {
      response.details = {
        reason: error.reason,
      }
    }

    if (error instanceof RateLimitError) {
      response.details = {
        retryAfter: error.retryAfter,
        limit: error.limit,
        window: error.window,
      }
    }

    if (error instanceof PermissionDeniedError) {
      response.details = {
        requiredRole: error.requiredRole,
        userRole: error.userRole,
        requiredPermission: error.requiredPermission,
      }
    }

    if (error instanceof AccountSecurityError) {
      response.details = {
        reason: error.reason,
        userId: error.userId,
      }
    }

    return response
  }

  /**
   * Create standardized error response for HTTP APIs
   */
  static createHTTPErrorResponse(
    error: AuthenticationError,
    statusCode: number = 401,
  ): {
    statusCode: number
    body: {
      error: string
      message: string
      code?: string
      details?: Record<string, unknown>
      timestamp: string
    }
  } {
    return {
      statusCode,
      body: {
        ...this.formatAuthenticationError(error),
        timestamp: new Date().toISOString(),
      },
    }
  }
}

/**
 * Error handler for authentication middleware
 */
export class AuthenticationErrorHandler {
  /**
   * Handle authentication error and return appropriate response
   */
  static handleError(error: unknown): {
    statusCode: number
    body: Record<string, unknown>
  } {
    if (error instanceof AuthenticationError) {
      if (error instanceof TokenExpiredError) {
        return ErrorResponseFormatter.createHTTPErrorResponse(error, 401)
      }

      if (error instanceof TokenRevokedError) {
        return ErrorResponseFormatter.createHTTPErrorResponse(error, 401)
      }

      if (error instanceof RateLimitError) {
        return ErrorResponseFormatter.createHTTPErrorResponse(error, 429)
      }

      if (error instanceof PermissionDeniedError) {
        return ErrorResponseFormatter.createHTTPErrorResponse(error, 403)
      }

      if (error instanceof AccountSecurityError) {
        return ErrorResponseFormatter.createHTTPErrorResponse(error, 403)
      }

      // Default authentication error
      return ErrorResponseFormatter.createHTTPErrorResponse(error, 401)
    }

    // Unknown error
    return {
      statusCode: 500,
      body: {
        error: 'InternalServerError',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    }
  }
}

/**
 * Error logging utilities for authentication events
 */
export class AuthenticationErrorLogger {
  /**
   * Log authentication error with context
   */
  static logError(
    error: AuthenticationError,
    context: {
      userId?: string
      ipAddress?: string
      userAgent?: string
      endpoint?: string
      method?: string
      requestId?: string
    } = {},
  ): void {
    const logData = {
      error: error.name,
      message: error.message,
      code: error.code,
      context,
      timestamp: new Date().toISOString(),
    }

    // Log with appropriate level based on error type
    if (
      error instanceof TokenExpiredError ||
      error instanceof TokenRevokedError
    ) {
      console.warn('Authentication warning:', logData)
    } else if (
      error instanceof RateLimitError ||
      error instanceof PermissionDeniedError
    ) {
      console.warn('Security warning:', logData)
    } else {
      console.error('Authentication error:', logData)
    }
  }

  /**
   * Log security event for audit trail
   */
  static logSecurityEvent(
    event: string,
    userId: string,
    details: Record<string, unknown> = {},
  ): void {
    console.info('Security event:', {
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
    })
  }
}
