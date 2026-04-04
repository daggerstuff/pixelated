import { EventEmitter } from 'events'
import {
  Investigation,
  InvestigationStepResult,
  HuntFinding,
} from './types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { ThreatInvestigationRepository } from './threat-investigation-repository'
import { ThreatReportGenerator } from './threat-report-generator'

const logger = createBuildSafeLogger('threat-investigation-manager')

// P4.2: Maximum findings allowed in a single investigation document to prevent OOM/DB size issues
const MAX_FINDINGS_PER_INVESTIGATION = 500

/**
 * Manages the lifecycle of security investigations.
 * Optimized for performance and reporting consistency.
 */
export class ThreatInvestigationManager extends EventEmitter {
  constructor(
    private repository: ThreatInvestigationRepository,
    private reportGenerator: ThreatReportGenerator,
    private aiService?: any,
    private behavioralService?: any,
  ) {
    super()
  }

  public async startInvestigation(params: {
    huntId: string
    priority: number
  }): Promise<string> {
    const investigationId = `inv_${Date.now()}`
    const investigation: Investigation = {
      investigationId,
      huntId: params.huntId,
      status: 'active',
      priority: this.mapPriority(params.priority),
      steps: [],
      findings: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      await this.repository.store(investigation)
      await this.repository.addToActive(investigationId)

      this.emit('investigation_started', { investigationId, huntId: params.huntId })
      return investigationId
    } catch (error) {
      logger.error('Failed to start investigation', { error, huntId: params.huntId })
      this.emit('investigation_failed', { huntId: params.huntId, error })
      throw error
    }
  }

  public async getInvestigation(id: string): Promise<Investigation | null> {
    return this.repository.findById(id)
  }

  public async listInvestigations(filter: Record<string, any> = {}): Promise<Investigation[]> {
    return this.repository.find(filter)
  }

  /**
   * Execute investigation step with finding caps and consistent returns (P4.1, P4.2).
   */
  public async executeInvestigationStep(
    investigationId: string,
    stepId: string,
    action: string,
    params: Record<string, unknown>,
  ): Promise<{ findings: any[] }> {
    const investigation = await this.repository.findById(investigationId)
    if (!investigation) {
      throw new Error(`Investigation ${investigationId} not found`)
    }

    logger.info(`Executing step ${stepId}: ${action}`, { investigationId })
    const startTime = Date.now()
    let stepResult: InvestigationStepResult

    try {
      let stepFindings: any[] = []

      switch (action) {
        case 'analyze_behavior':
          if (this.behavioralService) {
            // Extract userId from params or investigation context
            const userId = params.userId || params.user_id || investigation.assignedTo || 'unknown'
            // Map timeWindow (ms) to timeframe format or use provided timeframe
            const timeframe = params.timeframe || this.formatTimeframe(params.timeWindow)
            stepFindings = await this.behavioralService.analyzeUserBehavior(
              String(userId),
              timeframe,
            )
          }
          break

        case 'query_threat_intel':
          if (this.aiService) {
            const intel = await this.aiService.getThreatIntel(params.indicator)
            stepFindings = intel ? [intel] : []
          }
          break

        case 'generate_report':
          const report = this.reportGenerator.generateHuntReport(
            investigation.huntId || 'manual',
            investigation.findings as any[],
          )
          this.emit('report_generated', { investigationId, report })

          // P4.2 FIX: Return only the final summary finding for THIS step.
          // Prepending the entire history caused duplication in the persistence loop.
          stepFindings = [
            {
              type: 'report_summary',
              summary: report.summary,
              threatLevel: report.meta.threatLevel,
              timestamp: report.timestamp
            }
          ]
          break

        default:
          logger.warn(`Unknown action: ${action}`)
      }

      // Enforce document growth limits
      const currentCount = investigation.findings.length
      const remainingCapacity = MAX_FINDINGS_PER_INVESTIGATION - currentCount

      if (remainingCapacity <= 0) {
        logger.warn(`Investigation ${investigationId} has reached finding limit. Ignoring new step findings.`)
      } else if (stepFindings.length > 0) {
        const findingsToAdd = stepFindings.slice(0, remainingCapacity)
        investigation.findings.push(...findingsToAdd)
      }

      stepResult = {
        stepId,
        name: action,
        status: 'completed',
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        result: { found: stepFindings.length },
      }

      investigation.steps.push(stepResult)
      investigation.updatedAt = new Date()

      await this.repository.update(investigation)
      return { findings: stepFindings }
    } catch (error) {
      stepResult = {
        stepId,
        name: action,
        status: 'failed',
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      }

      investigation.steps.push(stepResult)
      await this.repository.update(investigation)
      throw error
    }
  }

  /**
   * Format timeWindow in milliseconds to timeframe string (e.g., "1h", "24h", "7d")
   */
  private formatTimeframe(timeWindowMs?: number): string {
    if (!timeWindowMs) return '24h'

    const hours = timeWindowMs / (1000 * 60 * 60)
    if (hours === 24) return '24h'
    if (hours === 1) return '1h'

    const days = hours / 24
    if (days === 7) return '7d'

    // Default to 24h if unknown
    return '24h'
  }

  public async closeInvestigation(
    investigationId: string,
    resolutionData: Record<string, unknown>,
  ): Promise<Investigation | null> {
    const investigation = await this.repository.findById(investigationId)
    if (!investigation) return null

    investigation.status = 'resolved'
    investigation.completedAt = new Date()
    investigation.updatedAt = new Date()
    investigation.metadata = { ...investigation.metadata, ...resolutionData }

    try {
      await this.repository.update(investigation)
      await this.repository.deleteFromActive(investigationId)

      this.emit('investigation_completed', { investigationId })
      return investigation
    } catch (error) {
      logger.error('Failed to close investigation', { error, investigationId })
      throw error
    }
  }

  public async getActiveInvestigations(): Promise<Investigation[]> {
    const ids = await this.repository.getActiveIds()
    return this.repository.getByIds(ids)
  }

  private mapPriority(priority: number): 'low' | 'medium' | 'high' | 'critical' {
    if (priority >= 4) return 'critical'
    if (priority >= 3) return 'high'
    if (priority >= 2) return 'medium'
    return 'low'
  }
}
