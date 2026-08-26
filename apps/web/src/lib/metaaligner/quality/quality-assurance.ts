/**
 * @module quality-assurance
 * @description This module provides a quality assurance workflow for the MetaAligner pipeline.
 */

/**
 * Defines the interface for the QualityAssurance.
 */
export interface IQualityAssurance {
  /**
   * Runs the quality assurance workflow.
   *
   * @param response - The response to run the workflow on.
   * @returns A promise that resolves when the workflow is complete.
   */
  run(response: string): Promise<void>
}
