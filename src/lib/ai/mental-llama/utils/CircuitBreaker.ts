/**
 * Circuit breaker for reliability
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold: number,
    private resetTimeMs: number,
  ) {}

  canExecute(): boolean {
    if (this.state === 'closed') {
      return true
    }

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
        this.state = 'half-open'
        return true
      }
      return false
    }

    // half-open state
    return true
  }

  onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }
}
