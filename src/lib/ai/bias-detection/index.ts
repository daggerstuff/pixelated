/**
 * Bias Detection Engine - Main Exports
 *
 * Barrel re-exports only symbols consumed by external callers.
 * Import specific modules directly for advanced use cases.
 */

// Main engine — consumed by EmotionValidationPipeline
export { BiasDetectionEngine } from "./BiasDetectionEngine";

// Type exports — consumed by admin dashboard components
export type {
  BiasAnalysisResult,
  BiasDashboardData,
  DashboardRecommendation,
  BiasAlert,
  BiasDashboardSummary,
} from "./types";
