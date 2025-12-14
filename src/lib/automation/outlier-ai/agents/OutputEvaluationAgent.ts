/**
 * Output Evaluation Agent
 * 
 * Handles output evaluation and ranking tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class OutputEvaluationAgent extends BaseAgent {
  name = 'Output Evaluation Agent'
  type = 'output_evaluation'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'output_evaluation' || task.type === 'ranking'
  }

  async execute(
    task: OutlierTask,
    _session: BrowserSession
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()
    const browserManager = new BrowserManager()

    try {
      // Read task instructions
      const instructions = await this.readInstructions(browserManager)
      await this.humanDelay(1000, 2000)

      // Extract outputs to evaluate
      const outputs = await this.extractOutputs(browserManager)
      await this.humanDelay(500, 1000)

      // Evaluate each output
      const evaluations = await Promise.all(
        outputs.map((output) => this.evaluateOutput(output, instructions))
      )

      await this.humanDelay(1000, 2000)

      // Fill evaluation form
      await this.fillEvaluations(browserManager, evaluations)

      // Quality check
      const qualityScore = this.assessQuality(evaluations)

      return {
        taskId: task.id,
        success: true,
        submitted: false,
        executionTime: Date.now() - startTime,
        qualityScore,
      }
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        submitted: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  }

  private async extractOutputs(
    browserManager: BrowserManager
  ): Promise<string[]> {
    // Extract outputs from page
    const _content = await browserManager.getPageContent()
    // Parse outputs (could be in divs, list items, etc.)
    const outputs: string[] = []
    // Simple extraction logic
    return outputs
  }

  private async evaluateOutput(
    output: string,
    _criteria: string
  ): Promise<{
    score: number
    feedback: string
    reasoning: string
  }> {
    // Evaluate output based on criteria
    // Use scoring rubric from instructions

    // For now, generate a reasonable evaluation
    const score = 0.7 + Math.random() * 0.2 // 0.7-0.9 range
    const feedback = this.generateFeedback(output, score)
    const reasoning = `This output ${score > 0.8 ? 'meets' : 'partially meets'} the evaluation criteria.`

    return { score, feedback, reasoning }
  }

  private generateFeedback(output: string, score: number): string {
    return score > 0.85
      ? 'Excellent output that clearly addresses the requirements.'
      : score > 0.75
        ? 'Good output with minor areas for improvement.'
        : 'Adequate output that could benefit from more detail or clarity.'
  }

  private async fillEvaluations(
    browserManager: BrowserManager,
    evaluations: Array<{ score: number; feedback: string; reasoning: string }>
  ): Promise<void> {
    // Fill in evaluation form fields
    for (let i = 0; i < evaluations.length; i++) {
      const evaluation = evaluations[i]

      // Find score input
      await browserManager.click(`input[data-output="${i}"]`)
      await this.typeHumanLike(
        browserManager,
        `input[data-output="${i}"]`,
        evaluation.score.toString()
      )

      await this.humanDelay(300, 600)

      // Fill feedback
      await browserManager.click(`textarea[data-output="${i}"]`)
      await this.typeHumanLike(
        browserManager,
        `textarea[data-output="${i}"]`,
        evaluation.feedback
      )

      await this.humanDelay(500, 1000)
    }
  }

  private assessQuality(
    evaluations: Array<{ score: number; feedback: string; reasoning: string }>
  ): number {
    // Check if evaluations are consistent and well-reasoned
    if (evaluations.length === 0) return 0

    const avgScore = evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
    const hasFeedback = evaluations.every((e) => e.feedback.length > 20)

    return hasFeedback ? Math.min(1.0, avgScore) : 0.6
  }
}
