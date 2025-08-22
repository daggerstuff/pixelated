// Performance Profiler for Bias Detection Engine and Job System
// Provides CPU, memory, and latency profiling for bottleneck identification

type ProfilerResult = {
  label: string
  durationMs: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
  timestamp: string
}

export class PerformanceProfiler {
  static async profile<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; profile: ProfilerResult }> {
    const memoryBefore = PerformanceProfiler.getMemoryUsage()
    const start = process.hrtime.bigint()
    const result = await fn()
    const end = process.hrtime.bigint()
    const memoryAfter = PerformanceProfiler.getMemoryUsage()
    const durationMs = Number(end - start) / 1e6
    const memoryDelta = memoryAfter - memoryBefore
    const profile: ProfilerResult = {
      label,
      durationMs,
      memoryBefore,
      memoryAfter,
      memoryDelta,
      timestamp: new Date().toISOString(),
    }
    PerformanceProfiler.logProfile(profile)
    return { result, profile }
  }

  static getMemoryUsage(): number {
    return process.memoryUsage().heapUsed
  }

  static logProfile(profile: ProfilerResult) {
    console.info('[PerformanceProfiler]', profile)
  }
}

// Example usage:
// const { result, profile } = await PerformanceProfiler.profile('analyzeSession', () => engine.analyzeSession(sessionData))
