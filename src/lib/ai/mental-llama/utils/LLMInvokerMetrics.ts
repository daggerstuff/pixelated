/**
 * Metrics collector for monitoring
 */
export class LLMInvokerMetrics {
  private totalRequests = 0
  private successfulRequests = 0
  private failedRequests = 0
  private totalLatency = 0
  private lastResetTime = Date.now()

  recordRequest(success: boolean, latencyMs: number): void {
    this.totalRequests++
    this.totalLatency += latencyMs

    if (success) {
      this.successfulRequests++
    } else {
      this.failedRequests++
    }
  }

  getMetrics() {
    const now = Date.now()
    const uptimeMs = now - this.lastResetTime

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate:
        this.totalRequests > 0
          ? this.successfulRequests / this.totalRequests
          : 0,
      averageLatencyMs:
        this.totalRequests > 0 ? this.totalLatency / this.totalRequests : 0,
      uptimeMs,
      requestsPerMinute:
        this.totalRequests > 0 ? (this.totalRequests / uptimeMs) * 60000 : 0,
    }
  }

  reset() {
    this.totalRequests = 0
    this.successfulRequests = 0
    this.failedRequests = 0
    this.totalLatency = 0
    this.lastResetTime = Date.now()
  }
}
