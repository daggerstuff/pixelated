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

export async function profile<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; profile: ProfilerResult }> {
  const memoryBefore = getMemoryUsage()
  const start = process.hrtime.bigint()
  const result = await fn()
  const end = process.hrtime.bigint()
  const memoryAfter = getMemoryUsage()
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

  return { result, profile }
}

function getMemoryUsage(): number {
  const used = process.memoryUsage()
  return Math.round((used.heapUsed / 1024 / 1024) * 100) / 100
}

export function formatProfile(profile: ProfilerResult): string {
  return `[${profile.timestamp}] ${profile.label}: ${profile.durationMs.toFixed(2)}ms | Memory: ${profile.memoryBefore}MB → ${profile.memoryAfter}MB (Δ${profile.memoryDelta >= 0 ? '+' : ''}${profile.memoryDelta}MB)`
}

// Export the type for external use
export type { ProfilerResult }
