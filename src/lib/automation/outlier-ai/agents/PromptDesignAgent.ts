/**
 * Prompt Design Agent
 * 
 * Handles prompt design tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class PromptDesignAgent extends BaseAgent {
  name = 'Prompt Design Agent'
  type = 'prompt_design'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'prompt_design'
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

      // Analyze requirements
      const requirements = this.parseRequirements(instructions)
      await this.humanDelay(500, 1000)

      // Design prompt based on requirements
      const prompt = await this.designPrompt(requirements)

      // Fill in the prompt field
      await browserManager.waitForElement('textarea, input[type="text"]', 10000)
      await this.typeHumanLike(
        browserManager,
        'textarea, input[type="text"]',
        prompt
      )

      await this.humanDelay(500, 1000)

      // Quality check
      const qualityScore = this.assessQuality(prompt, requirements)

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

  private parseRequirements(_instructions: string): string[] {
    // Parse requirements from instructions
    // Look for keywords like "must", "should", "include", etc.
    const requirements: string[] = []
    // Simple parsing logic
    return requirements
  }

  private async designPrompt(requirements: string[]): Promise<string> {
    // Use LLM or template-based approach to design prompt
    // For now, return a basic prompt structure
    return `You are a helpful assistant. Please provide a detailed response to the following request:

${requirements.join('\n')}

Please ensure your response is:
- Clear and concise
- Well-structured
- Accurate and informative`
  }

  private assessQuality(prompt: string, requirements: string[]): number {
    // Assess prompt quality
    let score = 0.5

    // Check length
    if (prompt.length > 100 && prompt.length < 2000) {
      score += 0.2
    }

    // Check if requirements are addressed
    const requirementsMet = requirements.filter((req) =>
      prompt.toLowerCase().includes(req.toLowerCase())
    ).length
    score += (requirementsMet / requirements.length) * 0.3

    return Math.min(1.0, score)
  }
}
