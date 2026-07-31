/**
 * Bias Detection Engine — Enterprise Performance Monitor
 *
 * Tracks per-endpoint/method latency percentiles (p50/p95/p99), request
 * volumes, error rates, and aggregate health status. Exports in JSON or
 * Prometheus format. Implements sliding-window retention so memory stays
 * bounded under production load.
 *
 * Built for Section 3 of PIX-3913 (Observability & Monitoring Enhancement).
 */

import type { PerformanceSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max raw request records retained in memory (≈ 1 min at 1k QPS). */
const MAX_RECORDED_REQUESTS = 5_000;

/** Max analysis records retained. */
const MAX_RECORDED_ANALYSES = 2_500;

/** Default time window for Prometheus-style export (60 seconds). */
const DEFAULT_EXPORT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute percentile from a sorted array of numbers.
 * Uses linear interpolation between bounding ranks.
 *
 * @param sorted — ascending numeric array.
 * @param p — percentile in [0, 100].
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sorted[lower];

  const frac = rank - lower;
  return sorted[lower]! * (1 - frac) + sorted[upper]! * frac;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EndpointMetrics {
  requestCount: number;
  errorCount: number;
  p50: number;
  p95: number;
  p99: number;
}

export type EndpointBreakdown = Record<string, EndpointMetrics>;

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

class PerformanceMonitor {
  private readonly startTime = Date.now();

  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;

  private readonly requestDetails: {
    endpoint: string;
    method: string;
    duration: number;
    statusCode: number;
    timestamp: number;
  }[] = [];

  private readonly analysisDetails: {
    duration: number;
    biasScore: number;
    timestamp: number;
  }[] = [];

  // ── Health / Degradation tracking ───────────────────────────────────
  private consecutiveErrors = 0;
  private poorLatencyCount = 0;
  private healthStatus: HealthStatus = "healthy";

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Get performance snapshot for the specified time range.
   *
   * @param timeWindowMs — optional sliding window (default: all time).
   * @param includeEndpointBreakdown — if true, returns per-endpoint metrics.
   */
  getSnapshot(
    timeWindowMs?: number,
    includeEndpointBreakdown?: boolean,
  ): PerformanceSnapshot & { endpointBreakdown?: EndpointBreakdown } {
    const now = Date.now();
    const uptime = now - this.startTime;
    const memoryUsage = process.memoryUsage().heapUsed;

    const recentRequests = this.sliceWindow(timeWindowMs);

    const rCount = recentRequests.length;
    const eCount = recentRequests.filter((r) => r.statusCode >= 400).length;
    const totalTime = recentRequests.reduce((s, r) => s + r.duration, 0);

    const durations = recentRequests.map((r) => r.duration).sort((a, b) => a - b);
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);

    let endpointBreakdown: EndpointBreakdown | undefined;
    if (includeEndpointBreakdown) {
      endpointBreakdown = this.buildEndpointBreakdown(recentRequests);
    }

    return {
      timestamp: now,
      metrics: [
        { name: "uptime", value: uptime, unit: "ms" },
        { name: "requests_total", value: rCount, unit: "count" },
        { name: "errors_total", value: eCount, unit: "count" },
        { name: "memory_usage", value: memoryUsage, unit: "bytes" },
        { name: "p50_latency_ms", value: p50, unit: "ms" },
        { name: "p95_latency_ms", value: p95, unit: "ms" },
        { name: "p99_latency_ms", value: p99, unit: "ms" },
        { name: "consecutive_errors", value: this.consecutiveErrors, unit: "count" },
        { name: "health_status", value: this.healthStatusCode(), unit: "" },
      ],
      summary: {
        averageResponseTime: rCount > 0 ? totalTime / rCount : 0,
        requestCount: rCount,
        errorRate: rCount > 0 ? eCount / rCount : 0,
        p50Latency: p50,
        p95Latency: p95,
        p99Latency: p99,
      },
      ...(endpointBreakdown ? { endpointBreakdown } : {}),
    };
  }

  /**
   * Record request timing — granular event log.
   */
  recordRequestTiming(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
  ): void {
    this.requestCount++;
    this.totalResponseTime += duration;

    if (statusCode >= 400) {
      this.errorCount++;
      this.consecutiveErrors++;
    } else {
      this.consecutiveErrors = 0;
    }

    if (duration > 2000) {
      this.poorLatencyCount++;
    }

    this.updateHealth();
    this.pruneRequestDetails();

    this.requestDetails.push({
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: Date.now(),
    });
  }

  /**
   * Record bias analysis performance.
   */
  recordAnalysis(duration: number, biasScore: number): void {
    this.requestCount++;
    this.totalResponseTime += duration;

    if (this.analysisDetails.length >= MAX_RECORDED_ANALYSES) {
      this.analysisDetails.shift();
    }

    this.analysisDetails.push({
      duration,
      biasScore,
      timestamp: Date.now(),
    });
  }

  /**
   * Reset accumulated error/latency tracking (e.g. after a deployment).
   */
  resetHealth(): void {
    this.consecutiveErrors = 0;
    this.poorLatencyCount = 0;
    this.healthStatus = "healthy";
  }

  /**
   * Export metrics in the requested format.
   */
  exportMetrics(format: "json" | "prometheus", timeWindowMs?: number): string {
    const snapshot = this.getSnapshot(timeWindowMs ?? DEFAULT_EXPORT_WINDOW_MS, true);
    if (format === "prometheus") return this.renderPrometheus(snapshot);
    return JSON.stringify(snapshot, null, 2);
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private sliceWindow(timeWindowMs: number | undefined): typeof this.requestDetails {
    if (timeWindowMs === undefined) return this.requestDetails;
    if (timeWindowMs <= 0) return [];
    const cutoff = Date.now() - timeWindowMs;
    return this.requestDetails.filter((r) => r.timestamp >= cutoff);
  }

  private buildEndpointBreakdown(recent: typeof this.requestDetails): EndpointBreakdown {
    const map: Record<string, { durations: number[]; errors: number }> = {};
    for (const r of recent) {
      if (!map[r.endpoint]) map[r.endpoint] = { durations: [], errors: 0 };
      map[r.endpoint]!.durations.push(r.duration);
      if (r.statusCode >= 400) map[r.endpoint]!.errors++;
    }

    const breakdown: EndpointBreakdown = {};
    for (const [endpoint, data] of Object.entries(map)) {
      const sorted = data.durations.slice().sort((a, b) => a - b);
      breakdown[endpoint] = {
        requestCount: data.durations.length,
        errorCount: data.errors,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      };
    }
    return breakdown;
  }

  private updateHealth(): void {
    if (this.consecutiveErrors >= 10) this.healthStatus = "unhealthy";
    else if (this.consecutiveErrors >= 5 || this.poorLatencyCount > 100)
      this.healthStatus = "degraded";
    else this.healthStatus = "healthy";
  }

  private healthStatusCode(): number {
    switch (this.healthStatus) {
      case "healthy":
        return 0;
      case "degraded":
        return 1;
      case "unhealthy":
        return 2;
    }
  }

  private pruneRequestDetails(): void {
    while (this.requestDetails.length >= MAX_RECORDED_REQUESTS) {
      this.requestDetails.shift();
    }
  }

  // ── Prometheus format renderer ──────────────────────────────────────

  private renderPrometheus(
    snapshot: PerformanceSnapshot & { endpointBreakdown?: EndpointBreakdown },
  ): string {
    const lines: string[] = [];

    lines.push("# HELP bias_engine_requests_total Total requests processed");
    lines.push("# TYPE bias_engine_requests_total counter");
    lines.push(`bias_engine_requests_total ${snapshot.summary.requestCount}`);

    lines.push("# HELP bias_engine_errors_total Total error count");
    lines.push("# TYPE bias_engine_errors_total counter");
    lines.push(
      `bias_engine_errors_total ${snapshot.summary.errorRate * snapshot.summary.requestCount}`,
    );

    lines.push("# HELP bias_engine_latency_p50_ms P50 response latency");
    lines.push("# TYPE bias_engine_latency_p50_ms gauge");
    lines.push(`bias_engine_latency_p50_ms ${snapshot.summary.p50Latency}`);

    lines.push("# HELP bias_engine_latency_p95_ms P95 response latency");
    lines.push("# TYPE bias_engine_latency_p95_ms gauge");
    lines.push(`bias_engine_latency_p95_ms ${snapshot.summary.p95Latency}`);

    lines.push("# HELP bias_engine_latency_p99_ms P99 response latency");
    lines.push("# TYPE bias_engine_latency_p99_ms gauge");
    lines.push(`bias_engine_latency_p99_ms ${snapshot.summary.p99Latency}`);

    lines.push("# HELP bias_engine_health_status Current health (0=ok, 1=degraded, 2=unhealthy)");
    lines.push("# TYPE bias_engine_health_status gauge");
    const hVal = snapshot.metrics.find((m) => m.name === "health_status");
    if (hVal) lines.push(`bias_engine_health_status ${hVal.value}`);

    if (snapshot.endpointBreakdown) {
      const breakdown = snapshot.endpointBreakdown;
      for (const [ep, m] of Object.entries(breakdown)) {
        lines.push(`bias_engine_endpoint_requests_total{endpoint="${ep}"} ${m.requestCount}`);
        lines.push(`bias_engine_endpoint_errors_total{endpoint="${ep}"} ${m.errorCount}`);
        lines.push(`bias_engine_endpoint_p50{endpoint="${ep}"} ${m.p50}`);
        lines.push(`bias_engine_endpoint_p95{endpoint="${ep}"} ${m.p95}`);
        lines.push(`bias_engine_endpoint_p99{endpoint="${ep}"} ${m.p99}`);
      }
    }

    return lines.join("\n");
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
