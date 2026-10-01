// Re-export the live hook for external consumers (MetricsDialog).
// The prototype simulator component family that once lived here was dead
// code — zero importers, never mounted — and was removed.
export { useAnonymizedMetrics } from './hooks'
