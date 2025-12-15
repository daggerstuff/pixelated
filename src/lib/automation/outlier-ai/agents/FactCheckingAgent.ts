/**
 * Fact Checking Agent
 * 
 * Handles fact checking and verification tasks
 */

import type { OutlierTask, TaskExecutionResult, BrowserSession } from '../types'
import { BaseAgent } from './BaseAgent'
import { BrowserManager } from '../BrowserManager'

export class FactCheckingAgent extends BaseAgent {
  name = 'Fact Checking Agent'
  type = 'fact_checking'

  canHandle(task: OutlierTask): boolean {
    return task.type === 'fact_checking'
  }

  async execute(
    task: OutlierTask,
    _session: BrowserSession
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now()
    const browserManager = new BrowserManager()

    try {
      // Read fact-checking guidelines
      const guidelines = await this.readInstructions(browserManager)
      await this.humanDelay(1000, 2000)

      // Extract claims to verify
      const claims = await this.extractClaims(browserManager)
      await this.humanDelay(500, 1000)

      // Verify each claim
      const verifications = await Promise.all(
        claims.map((claim) => this.verifyClaim(claim, guidelines))
      )

      await this.humanDelay(1000, 2000)

      // Fill verification form
      await this.fillVerifications(browserManager, verifications)

      // Quality check
      const qualityScore = this.assessQuality(verifications)

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

  private async extractClaims(
    browserManager: BrowserManager
  ): Promise<string[]> {
    const _content = await browserManager.getPageContent()
    // Parse claims to verify
    const claims: string[] = []
    return claims
  }

  private async verifyClaim(
    claim: string,
    _guidelines: string
  ): Promise<{
    verified: 'true' | 'false' | 'unverified'
    confidence: number
    sources?: string[]
    reasoning: string
  }> {
    // Verify claim (this would use web search or knowledge base)
    // For now, use simple heuristics

    const lowerClaim = claim.toLowerCase()

    // Check for common false patterns
    if (lowerClaim.includes('guaranteed') || lowerClaim.includes('100%')) {
      return {
        verified: 'false',
        confidence: 0.8,
        reasoning: 'Contains absolute claims that are typically false',
      }
    }

    // Check for verifiable facts
    if (lowerClaim.match(/\d{4}/)) {
      // Contains a year - could be historical fact
      return {
        verified: 'unverified',
        confidence: 0.5,
        reasoning: 'Requires historical verification',
      }
    }

    // Default to unverified
    return {
      verified: 'unverified',
      confidence: 0.5,
      reasoning: 'Claim requires further verification',
    }
  }

  private async fillVerifications(
    browserManager: BrowserManager,
    verifications: Array<{
      verified: 'true' | 'false' | 'unverified'
      confidence: number
      sources?: string[]
      reasoning: string
    }>
  ): Promise<void> {
    for (let i = 0; i < verifications.length; i++) {
      const verification = verifications[i]

      // Select verification status
      await browserManager.click(
        `input[data-claim="${i}"][value="${verification.verified}"]`
      )

      await this.humanDelay(300, 600)

      // Fill reasoning
      await browserManager.click(`textarea[data-claim="${i}"]`)
      await this.typeHumanLike(
        browserManager,
        `textarea[data-claim="${i}"]`,
        verification.reasoning
      )

      await this.humanDelay(500, 1000)
    }
  }

  private assessQuality(
    verifications: Array<{
      verified: 'true' | 'false' | 'unverified'
      confidence: number
      sources?: string[]
      reasoning: string
    }>
  ): number {
    if (verifications.length === 0) return 0

    // Check if all have reasoning
    const allHaveReasoning = verifications.every((v) => v.reasoning.length > 20)
    const avgConfidence =
      verifications.reduce((sum, v) => sum + v.confidence, 0) /
      verifications.length

    return allHaveReasoning ? Math.min(1.0, avgConfidence) : 0.6
  }
}
