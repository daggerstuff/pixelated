/**
 * Quality Controller
 * 
 * Validates task quality before and after execution
 */

import type { OutlierTask, TaskExecutionResult } from './types'

export interface QualityCheck {
  passed: boolean
  score: number
  reason?: string
}

export class QualityController {
  private threshold: number

  constructor(threshold: number) {
    this.threshold = threshold
  }

  /**
   * Validate task before execution
   */
  async validateTask(task: OutlierTask): Promise<QualityCheck> {
    // Check if task has required information
    if (!task.title || !task.description) {
      return {
        passed: false,
        score: 0,
        reason: 'Missing task title or description',
      }
    }

    // Check if task type is known
    if (task.type === 'unknown') {
      return {
        passed: false,
        score: 0.5,
        reason: 'Unknown task type',
      }
    }

    // Check if task has clear instructions
    const hasInstructions = !!task.instructions || task.description.length > 50

    return {
      passed: hasInstructions,
      score: hasInstructions ? 0.8 : 0.4,
      reason: hasInstructions ? undefined : 'Insufficient task instructions',
    }
  }

  /**
   * Validate result after execution
   */
  async validateResult(
    task: OutlierTask,
    result: TaskExecutionResult
  ): Promise<QualityCheck> {
    if (!result.success) {
      return {
        passed: false,
        score: 0,
        reason: result.error || 'Task execution failed',
      }
    }

    // Check execution time (shouldn't be too fast or too slow)
    const reasonableTime =
      result.executionTime > 5000 && result.executionTime < 300000

    if (!reasonableTime) {
      return {
        passed: false,
        score: 0.5,
        reason: `Unreasonable execution time: ${result.executionTime}ms`,
      }
    }

    // Check quality score if available
    if (result.qualityScore !== undefined) {
      if (result.qualityScore < this.threshold) {
        return {
          passed: false,
          score: result.qualityScore,
          reason: `Quality score below threshold: ${result.qualityScore} < ${this.threshold}`,
        }
      }
    }

    return {
      passed: true,
      score: result.qualityScore ?? 0.8,
    }
  }
}
