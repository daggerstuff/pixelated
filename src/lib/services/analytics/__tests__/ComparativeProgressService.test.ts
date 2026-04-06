import { describe, it, expect, vi, beforeEach } from "vitest"
import { ComparativeProgressService } from "../ComparativeProgressService"

describe("ComparativeProgressService", () => {
  let service: ComparativeProgressService
  let mockLogger: any

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    service = new ComparativeProgressService(mockLogger)
  })

  it("should return insufficient data when no user progress snapshots exist", async () => {
    vi.spyOn(service as any, "fetchUserProgressData").mockResolvedValue([])

    const result = await service.analyzeProgress({
      anonymizedUserId: "test-user",
      metricName: "test-metric",
      cohortId: "test-cohort",
      dateRange: { startDate: "2023-01-01", endDate: "2023-01-31" }
    })

    expect(result.userProgressSnapshots).toHaveLength(0)
    expect(result.comparisonInsights.trend).toBe("insufficient_data")
  })
})
