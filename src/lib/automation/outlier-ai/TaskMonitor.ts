/**
 * Task Monitor
 * 
 * Monitors Outlier AI platform for available tasks
 */

import type { OutlierTask, OutlierConfig } from './types'
import { BrowserManager } from './BrowserManager'

export class TaskMonitor {
  private config: OutlierConfig
  private lastCheck: Date | null = null

  constructor(config: OutlierConfig) {
    this.config = config
  }

  /**
   * Find available tasks on the platform
   */
  async findAvailableTasks(
    browserManager: BrowserManager
  ): Promise<OutlierTask[]> {
    console.log('🔍 Scanning for available tasks...')

    const _session = await browserManager.getSession()

    // Navigate to tasks page
    await browserManager.navigate(this.config.dashboardUrl)
    await browserManager.waitForPageLoad()

    // Get page content
    const content = await browserManager.getPageContent()

    // Parse tasks from page
    const tasks = this.parseTasksFromPage(content)

    this.lastCheck = new Date()
    console.log(`📋 Found ${tasks.length} available tasks`)

    return tasks
  }

  /**
   * Check status of a specific task
   */
  async checkTaskStatus(
    _taskId: string,
    _browserManager: BrowserManager
  ): Promise<'available' | 'claimed' | 'in_progress' | 'completed' | 'submitted'> {
    // Navigate to task page
    // Check status from page content
    return 'in_progress'
  }

  /**
   * Parse tasks from HTML content
   */
  private parseTasksFromPage(_html: string): OutlierTask[] {
    const tasks: OutlierTask[] = []

    // This is a simplified parser - you'll need to adapt based on actual Outlier AI HTML structure
    // Look for task cards, list items, or table rows containing task information

    // Example patterns to look for:
    // - Task title
    // - Task description
    // - Task type
    // - Task URL
    // - Payment amount
    // - Task requirements

    // For now, return empty array - implement based on actual page structure
    return tasks
  }

  /**
   * Detect task type from content
   */
  private detectTaskType(title: string, description: string): string {
    const lowerTitle = title.toLowerCase()
    const lowerDesc = description.toLowerCase()

    if (
      lowerTitle.includes('prompt') ||
      lowerDesc.includes('prompt') ||
      lowerDesc.includes('design')
    ) {
      return 'prompt_design'
    }

    if (
      lowerTitle.includes('evaluate') ||
      lowerTitle.includes('evaluation') ||
      lowerDesc.includes('rate') ||
      lowerDesc.includes('score')
    ) {
      return 'output_evaluation'
    }

    if (
      lowerTitle.includes('moderate') ||
      lowerTitle.includes('moderation') ||
      lowerDesc.includes('content policy')
    ) {
      return 'content_moderation'
    }

    if (
      lowerTitle.includes('label') ||
      lowerTitle.includes('labeling') ||
      lowerDesc.includes('categorize')
    ) {
      return 'data_labeling'
    }

    if (
      lowerTitle.includes('rank') ||
      lowerTitle.includes('ranking') ||
      lowerDesc.includes('order')
    ) {
      return 'ranking'
    }

    if (
      lowerTitle.includes('rewrite') ||
      lowerTitle.includes('rewriting') ||
      lowerDesc.includes('rephrase')
    ) {
      return 'rewriting'
    }

    if (
      lowerTitle.includes('fact') ||
      lowerTitle.includes('verify') ||
      lowerDesc.includes('accuracy')
    ) {
      return 'fact_checking'
    }

    return 'unknown'
  }
}
