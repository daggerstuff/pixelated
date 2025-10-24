/**
 * @module circuit-breaker
 * @description This module provides a circuit breaker implementation for the MetaAligner pipeline.
 */

/**
 * Represents the state of the circuit breaker.
 */
export enum CircuitBreakerState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

/**
 * Defines the interface for the CircuitBreaker.
 */
export interface ICircuitBreaker {
  /**
   * Executes a function with circuit breaker protection.
   *
   * @param fn - The function to execute.
   * @returns A promise that resolves to the result of the function.
   */
  fire<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * The CircuitBreaker class.
 */
export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures = 0
  private lastError: Error | null = null
  private nextAttempt: number = Date.now()

  constructor(
    private failureThreshold = 3,
    private resetTimeout = 10000,
  ) {}

  public async fire<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.nextAttempt > Date.now()) {
        throw new Error('Circuit breaker is open')
      }
      this.state = CircuitBreakerState.HALF_OPEN
    }

    try {
      const result = await fn()
      this.success()
      return result
    } catch (error) {
      this.fail(error as Error)
      throw error
    }
  }

  private success(): void {
    this.failures = 0
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED
    }
  }

  private fail(error: Error): void {
    this.failures++
    this.lastError = error
    if (this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      this.nextAttempt = Date.now() + this.resetTimeout
    }
  }
}
