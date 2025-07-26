/**
 * Custom error classes for security-related operations
 */

export class SecurityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'SecurityError'
    if (options?.cause) {
      this.cause = options.cause
    }
  }
}
