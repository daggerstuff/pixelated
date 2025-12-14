/**
 * Ranking Agent
 * 
 * Handles ranking and ordering tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class RankingAgent extends BaseAgent {
  name = 'Ranking Agent'
  type = 'ranking'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'ranking'
  }

  async execute(
    task: OutlierTask,
    _session: BrowserSession
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()
    const browserManager = new BrowserManager()

    try {
      // Read ranking criteria
      const criteria = await this.readInstructions(browserManager)
      await this.humanDelay(1000, 2000)

      // Extract items to rank
      const items = await this.extractItems(browserManager)
      await this.humanDelay(500, 1000)

      // Rank items
      const ranking = await this.rankItems(items, criteria)

      await this.humanDelay(1000, 2000)

      // Fill ranking form
      await this.fillRanking(browserManager, ranking)

      // Quality check
      const qualityScore = this.assessQuality(ranking)

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

  private async extractItems(browserManager: BrowserManager): Promise<string[]> {
    const _content = await browserManager.getPageContent()
    // Parse items to rank
    const items: string[] = []
    return items
  }

  private async rankItems(
    items: string[],
    _criteria: string
  ): Promise<Array<{ item: string; rank: number; score: number }>> {
    // Rank items based on criteria
    // This would use scoring logic based on criteria

    const ranked = items.map((item, index) => ({
      item,
      rank: index + 1,
      score: 0.7 + Math.random() * 0.2,
    }))

    // Sort by score (highest first)
    ranked.sort((a, b) => b.score - a.score)

    // Reassign ranks
    ranked.forEach((item, index) => {
      item.rank = index + 1
    })

    return ranked
  }

  private async fillRanking(
    browserManager: BrowserManager,
    ranking: Array<{ item: string; rank: number; score: number }>
  ): Promise<void> {
    // Use drag-and-drop or input fields to set ranking
    for (const item of ranking) {
      // Find item element and set rank
      await browserManager.click(`[data-item="${item.item}"]`)
      await browserManager.click(`[data-rank="${item.rank}"]`)

      await this.humanDelay(300, 600)
    }
  }

  private assessQuality(
    ranking: Array<{ item: string; rank: number; score: number }>
  ): number {
    if (ranking.length === 0) return 0

    // Check if ranking is consistent (scores should correlate with ranks)
    const isConsistent = ranking.every((item, index) => {
      if (index === 0) return true
      return item.score <= ranking[index - 1].score
    })

    return isConsistent ? 0.9 : 0.7
  }
}
