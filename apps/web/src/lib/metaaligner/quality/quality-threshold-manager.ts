/**
 * @module quality-threshold-manager
 * @description This module provides a quality threshold management system for the MetaAligner pipeline.
 */

/**
 * Defines the interface for the QualityThresholdManager.
 */
export interface IQualityThresholdManager {
  /**
   * Checks if a set of metrics meets the quality thresholds.
   *
   * @param metrics - The metrics to check.
   * @returns A boolean indicating whether the metrics meet the thresholds.
   */
  meetsThresholds(metrics: Record<string, number>): boolean
}
