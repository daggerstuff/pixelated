/**
 * @module quality-reporter
 * @description This module provides a quality reporting system for the MetaAligner pipeline.
 */

/**
 * Defines the interface for the QualityReporter.
 */
export interface IQualityReporter {
  /**
   * Generates a quality report.
   *
   * @param metrics - The metrics to include in the report.
   * @returns A string containing the quality report.
   */
  generateReport(metrics: Record<string, number>): string
}
