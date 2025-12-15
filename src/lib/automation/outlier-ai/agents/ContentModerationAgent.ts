/**
 * Content Moderation Agent
 * 
 * Handles content moderation tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class ContentModerationAgent extends BaseAgent {
  name = 'Content Moderation Agent'
  type = 'content_moderation'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'content_moderation'
  }

  async execute(
    task: OutlierTask,
    _session: BrowserSession
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()
    const browserManager = new BrowserManager()

    try {
      // Read moderation guidelines
      const guidelines = await this.readInstructions(browserManager)
      await this.humanDelay(1000, 2000)

      // Extract content to moderate
      const contentItems = await this.extractContent(browserManager)
      await this.humanDelay(500, 1000)

      // Moderate each item
      const moderationResults = await Promise.all(
        contentItems.map((item) => this.moderateContent(item, guidelines))
      )

      await this.humanDelay(1000, 2000)

      // Fill moderation form
      await this.fillModerationResults(browserManager, moderationResults)

      // Quality check
      const qualityScore = this.assessQuality(moderationResults)

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

  private async extractContent(
    browserManager: BrowserManager
  ): Promise<string[]> {
    const _content = await browserManager.getPageContent()
    // Parse content items
    const items: string[] = []
    return items
  }

  private async moderateContent(
    content: string,
    _guidelines: string
  ): Promise<{
    violation: boolean
    category?: string
    severity?: 'low' | 'medium' | 'high'
    reason: string
  }> {
    // Check content against guidelines
    // Look for violations: hate speech, spam, inappropriate content, etc.

    const _lowerContent = content.toLowerCase()

    // Simple violation detection
    const violations = [
      { pattern: /hate|discrimination|violence/i, category: 'hate_speech', severity: 'high' as const },
      { pattern: /spam|scam|phishing/i, category: 'spam', severity: 'medium' as const },
      { pattern: /nsfw|explicit|adult/i, category: 'inappropriate', severity: 'high' as const },
    ]

    for (const violation of violations) {
      if (violation.pattern.test(content)) {
        return {
          violation: true,
          category: violation.category,
          severity: violation.severity,
          reason: `Content violates ${violation.category} policy`,
        }
      }
    }

    return {
      violation: false,
      reason: 'Content appears to comply with guidelines',
    }
  }

  private async fillModerationResults(
    browserManager: BrowserManager,
    results: Array<{
      violation: boolean
      category?: string
      severity?: 'low' | 'medium' | 'high'
      reason: string
    }>
  ): Promise<void> {
    for (let i = 0; i < results.length; i++) {
      const result = results[i]

      // Select violation status
      if (result.violation) {
        await browserManager.click(`input[data-item="${i}"][value="violation"]`)
      } else {
        await browserManager.click(`input[data-item="${i}"][value="approved"]`)
      }

      await this.humanDelay(300, 600)

      // Fill reason if violation
      if (result.violation) {
        await browserManager.click(`textarea[data-item="${i}"]`)
        await this.typeHumanLike(
          browserManager,
          `textarea[data-item="${i}"]`,
          result.reason
        )
      }

      await this.humanDelay(500, 1000)
    }
  }

  private assessQuality(
    results: Array<{
      violation: boolean
      category?: string
      severity?: 'low' | 'medium' | 'high'
      reason: string
    }>
  ): number {
    if (results.length === 0) return 0

    // Check if all results have reasons
    const allHaveReasons = results.every((r) => r.reason.length > 10)
    // Check if violations have categories
    const violationsHaveCategories = results
      .filter((r) => r.violation)
      .every((r) => r.category)

    return allHaveReasons && violationsHaveCategories ? 0.9 : 0.7
  }
}
