/**
 * Rewriting Agent
 * 
 * Handles content rewriting tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class RewritingAgent extends BaseAgent {
  name = 'Rewriting Agent'
  type = 'rewriting'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'rewriting'
  }

  async execute(
    task: OutlierTask,
    _session: BrowserSession
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()
    const browserManager = new BrowserManager()

    try {
      // Read rewriting instructions
      const instructions = await this.readInstructions(browserManager)
      await this.humanDelay(1000, 2000)

      // Extract content to rewrite
      const content = await this.extractContent(browserManager)
      await this.humanDelay(500, 1000)

      // Rewrite content
      const rewritten = await this.rewriteContent(content, instructions)

      await this.humanDelay(1000, 2000)

      // Fill rewritten content
      await browserManager.waitForElement('textarea, [contenteditable]', 10000)
      await this.typeHumanLike(
        browserManager,
        'textarea, [contenteditable]',
        rewritten
      )

      // Quality check
      const qualityScore = this.assessQuality(content, rewritten, instructions)

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

  private async extractContent(browserManager: BrowserManager): Promise<string> {
    return await browserManager.getPageContent();
  }

  private async rewriteContent(
    content: string,
    instructions: string
  ): Promise<string> {
    // Rewrite content based on instructions
    // This would use LLM or template-based rewriting

    // Simple rewriting logic
    let rewritten = content

    // Apply common rewriting instructions
    if (instructions.toLowerCase().includes('simplify')) {
      rewritten = this.simplify(content)
    }
    if (instructions.toLowerCase().includes('formal')) {
      rewritten = this.makeFormal(content)
    }
    if (instructions.toLowerCase().includes('casual')) {
      rewritten = this.makeCasual(content)
    }
    if (instructions.toLowerCase().includes('shorter')) {
      rewritten = this.shorten(content)
    }

    return rewritten
  }

  private simplify(text: string): string {
    // Simplify text (basic implementation)
    return text
      .replace(/utilize/gi, 'use')
      .replace(/facilitate/gi, 'help')
      .replace(/approximately/gi, 'about')
  }

  private makeFormal(text: string): string {
    // Make text more formal
    return text
      .replace(/can't/gi, 'cannot')
      .replace(/won't/gi, 'will not')
      .replace(/don't/gi, 'do not')
  }

  private makeCasual(text: string): string {
    // Make text more casual
    return text
      .replace(/cannot/gi, "can't")
      .replace(/will not/gi, "won't")
      .replace(/do not/gi, "don't")
  }

  private shorten(text: string): string {
    // Shorten text by removing unnecessary words
    const sentences = text.split('.')
    return sentences.slice(0, Math.ceil(sentences.length * 0.7)).join('.')
  }

  private assessQuality(
    original: string,
    rewritten: string,
    instructions: string
  ): number {
    // Check if rewritten content is different from original
    if (original === rewritten) return 0.3

    // Check if instructions were followed
    let score = 0.5

    if (instructions.toLowerCase().includes('simplify') && rewritten.length < original.length) {
      score += 0.2
    }

    if (instructions.toLowerCase().includes('preserve meaning')) {
      // Check if meaning is preserved (simplified check)
      const originalWords = new Set(original.toLowerCase().split(/\s+/))
      const rewrittenWords = new Set(rewritten.toLowerCase().split(/\s+/))
      const overlap = [...originalWords].filter((w) => rewrittenWords.has(w)).length
      const similarity = overlap / originalWords.size
      score += similarity * 0.3
    }

    return Math.min(1.0, score)
  }
}
