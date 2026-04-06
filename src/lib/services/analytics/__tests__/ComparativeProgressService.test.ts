import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ComparativeProgressService } from "@/lib/services/analytics/ComparativeProgressService"
import type { ProgressSnapshot, ComparativeProgressParams, Benchmark } from "@/types/analytics"

/**
 * Test-specific subclass to allow overriding private/protected data-fetching methods
 */
class TestComparativeProgressService extends ComparativeProgressService {
  public mockUserSnapshots: ProgressSnapshot[] = []
  public mockBenchmark: Benchmark | null = null

  async fetchUserProgressData(_params: ComparativeProgressParams): Promise<ProgressSnapshot[]> {
    return this.mockUserSnapshots
  }

  async fetchBenchmarkData(_params: ComparativeProgressParams): Promise<Benchmark | null> {
    return this.mockBenchmark
  }
}

describe("ComparativeProgressService", () => {
  let service: TestComparativeProgressService
  let mockLogger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    service = new TestComparativeProgressService(mockLogger)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should return insufficient data when no user progress snapshots exist", async () => {
    service.mockUserSnapshots = []

    const result = await service.analyzeProgress({
      anonymizedUserId: "test-user",
      metricName: "phq-9",
      cohortId: "test-cohort",
      dateRange: { startDate: "2023-01-01", endDate: "2023-01-31" }
    })

    expect(result.userProgressSnapshots).toHaveLength(0)
    expect(result.comparisonInsights.trend).toBe("insufficient_data")
  })

  it("should calculate an improving trend for clinical scores (lower is better)", async () => {
    service.mockUserSnapshots = [
      { anonymizedUserId: "u1", date: "2023-01-01", metricName: "phq-9", metricValue: 15, sessionId: "s1" },
      { anonymizedUserId: "u1", date: "2023-01-08", metricName: "phq-9", metricValue: 10, sessionId: "s2" }
    ]
    service.mockBenchmark = {
      cohortId: "c1",
      metricName: "phq-9",
      averageValue: 8.5,
      percentile25: 5.0,
      percentile75: 12.0,
      standardDeviation: 3.2,
      sampleSize: 1000,
      benchmarkDescription: "desc"
    }

    const result = await service.analyzeProgress({
      anonymizedUserId: "u1",
      metricName: "phq-9",
      cohortId: "c1",
      dateRange: { startDate: "2023-01-01", endDate: "2023-01-08" }
    })

    expect(result.comparisonInsights.trend).toBe("improving")
    expect(result.comparisonInsights.relativeToAverage).toBeDefined()
  })

  it("should calculate a declining trend for engagement scores (higher is better)", async () => {
    service.mockUserSnapshots = [
      { anonymizedUserId: "u1", date: "2023-01-01", metricName: "engagement", metricValue: 80, sessionId: "s1" },
      { anonymizedUserId: "u1", date: "2023-01-08", metricName: "engagement", metricValue: 60, sessionId: "s2" }
    ]
    service.mockBenchmark = {
      cohortId: "c1",
      metricName: "engagement",
      averageValue: 70,
      percentile25: 50,
      percentile75: 90,
      standardDeviation: 10,
      sampleSize: 1000,
      benchmarkDescription: "desc"
    }

    const result = await service.analyzeProgress({
      anonymizedUserId: "u1",
      metricName: "engagement",
      cohortId: "c1",
      dateRange: { startDate: "2023-01-01", endDate: "2023-01-08" }
    })

    // For engagement, a decrease from 80 to 60 is "declining"
    expect(result.comparisonInsights.trend).toBe("declining")
  })

  it("should handle service errors gracefully", async () => {
    // Force an error by patching a method to throw
    vi.spyOn(service as any, "fetchUserProgressData").mockRejectedValue(new Error("DB Connection Failed"))

    const result = await service.analyzeProgress({
      anonymizedUserId: "u1",
      metricName: "test",
      cohortId: "c1",
      dateRange: { startDate: "2023-01-01", endDate: "2023-01-08" }
    })

    expect(result.error).toBe("Failed to complete comparative analysis")
    expect(result.comparisonInsights.trend).toBe("insufficient_data")
    expect(mockLogger.error).toHaveBeenCalled()
  })
})
