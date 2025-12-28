/**
 * Pattern Recognition Shared Types
 *
 * This module defines core, extensible interfaces describing analytic patterns
 * used throughout FHE (Fully Homomorphic Encryption)-enabled analytics systems.
 * All interfaces are intended for cross-cutting feature support by any future
 * AI, analytics, or reporting capabilities in Pixelated Empathy, ensuring strong
 * type safety, discoverability, and maintainability.
 *
 * - Strictly for type definitions and documentation; contains no runtime logic.
 * - All interfaces are exported for shared use.
 * - Extend via interface extension or augmentation for domain-specific analytics.
 */

/**
 * Describes a recurring analytic trend detected within a dataset or session group.
 * Suitable for time-series, behavioral, or outcome trends.
 */
export interface TrendPattern {
  /**
   * Unique, stable identifier for this analytic pattern instance.
   */
  id: string

  /**
   * Human-readable summary describing the nature or significance of the pattern.
   * Suggests typical cause, outcome, or interpretation.
   */
  description: string

  /**
   * List of metric names, factors, or signals that indicate this pattern's presence.
   * E.g. ["spike", "deviation", "sentiment_shift"]
   */
  indicators: string[]

  /**
   * Optional: Additional free-form metadata for extensibility.
   */
  [key: string]: unknown
}

/**
 * Represents a pattern or motif discovered by analyzing across multiple distinct sessions.
 * Useful for persistent behaviors, treatment effects, or cross-participant signals.
 */
export interface CrossSessionPattern {
  /**
   * Globally unique identifier for this pattern instance.
   */
  id: string

  /**
   * General description of what links the sessions in this cross-session pattern.
   */
  description: string

  /**
   * List of unique session identifiers involved in this pattern.
   */
  sessionIds: string[]

  /**
   * The timespan in whole days encompassing all related sessions.
   */
  timeSpanDays: number

  /**
   * Optional: Extensible field for future multi-session attributes.
   */
  [key: string]: unknown
}

/**
 * Captures a detected correlation between features or events and a risk indicator.
 * Used for risk modeling, alerting, or analytics.
 */
export interface RiskCorrelation {
  /**
   * Unique identifier for this risk-correlation instance.
   */
  id: string

  /**
   * Description of the risk, trigger, or statistical relation detected.
   */
  description: string

  /**
   * Relative strength or confidence of the correlation, normalized (e.g. -1.0 to 1.0 or 0-1).
   */
  strength: number

  /**
   * Optional: Room for domain-specific confidence, p-value, or reference attributions.
   */
  [key: string]: unknown
}
