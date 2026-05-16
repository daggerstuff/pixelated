/**
 * Shared analyzer utility helpers.
 */

export function generateAnomalyId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function calculateTimeIntervals(timestamps: number[]): number[] {
  if (timestamps.length < 2) {
    return []
  }

  const sorted = [...timestamps].sort((a, b) => a - b)
  const intervals: number[] = []

  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i - 1])
  }

  return intervals
}
