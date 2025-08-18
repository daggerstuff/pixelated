/**
 * Base class for security-related errors
 */
export class SecurityError extends Error {
  constructor(message: string): void {
    super(message)
    this.name = 'SecurityError'
  }
}
