/**
 * Base Agent
 * 
 * Base class for all task agents
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession, TaskAgent } from '../types'
import { BrowserManager } from '../BrowserManager'

export abstract class BaseAgent implements TaskAgent {
  abstract name: string
  abstract type: string

  abstract canHandle(task: OutlierTask): boolean

  abstract execute(
    task: OutlierTask,
    session: BrowserSession
  ): Promise<TaskExecutionResult>

  /**
   * Common helper: Read task instructions
   */
  protected async readInstructions(
    browserManager: BrowserManager
  ): Promise<string> {
    // Extract instructions from page
    // Parse instructions section
    return await browserManager.getPageContent()
  }

  /**
   * Common helper: Human-like delay
   */
  protected async humanDelay(min = 500, max = 2000): Promise<void> {
    const delay = min + Math.random() * (max - min)
    await this.sleep(delay)
  }

  /**
   * Common helper: Type text with human-like speed
   */
  protected async typeHumanLike(
    browserManager: BrowserManager,
    selector: string,
    text: string
  ): Promise<void> {
    // Type character by character with random delays
    for (const _char of text) {
      // Use Browser Use MCP type tool
      await this.sleep(50 + Math.random() * 100)
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
