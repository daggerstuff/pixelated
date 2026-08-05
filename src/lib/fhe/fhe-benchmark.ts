// FHE Benchmark Constants and Utilities
export const FHE_SLO = {
  ENCRYPT_LATENCY_MS: 500,
  DECRYPT_LATENCY_MS: 500,
  PROCESS_ENCRYPTED_LATENCY_MS: 5000,
  THROUGHPUT_MIN_OPS_PER_SEC: 2,
  MEMORY_MAX_MB: 512,
  RELIABILITY_MIN_SUCCESS_RATE: 0.99,
} as const

export interface BenchmarkResult {
  name: string
  actual: number | boolean
  slo: number | boolean
  passes: boolean
  unit: string
  durationMs?: number
}

export class BenchmarkReporter {
  private readonly results: BenchmarkResult[] = []
  private startTime: number = 0

  start(): void {
    this.startTime = Date.now()
  }

  record(
    name: string,
    actual: number | boolean,
    slo: number | boolean,
    unit: string,
  ): void {
    const passes =
      typeof slo === 'number'
        ? typeof actual === 'number'
          ? actual <= slo
          : actual === (slo !== 0)
        : typeof actual === 'boolean'
          ? actual === slo
          : !!actual === slo

    this.results.push({
      name,
      actual,
      slo,
      passes,
      unit,
      durationMs: Date.now() - this.startTime,
    })
  }

  summary(): {
    total: number
    passed: number
    failed: number
    results: BenchmarkResult[]
    durationMs: number
  } {
    const passed = this.results.filter((r) => r.passes).length
    return {
      total: this.results.length,
      passed,
      failed: this.results.length - passed,
      results: [...this.results],
      durationMs: Date.now() - this.startTime,
    }
  }

  report(): string {
    const summary = this.summary()
    let report = `FHE Benchmark Report\n`
    report += `===================\n`
    report += `Total Tests: ${summary.total}\n`
    report += `Passed: ${summary.passed}\n`
    report += `Failed: ${summary.failed}\n`
    report += `Total Duration: ${summary.durationMs}ms\n\n`

    report += `Detailed Results:\n`
    for (const result of summary.results) {
      const status = result.passes ? '✓ PASS' : '✗ FAIL'
      report += `${status} ${result.name}: ${result.actual} ${result.unit} (SLO: ${result.slo} ${result.unit})\n`
    }

    return report
  }
}
