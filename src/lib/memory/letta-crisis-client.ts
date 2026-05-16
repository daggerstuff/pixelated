/**
 * @file letta-crisis-client.ts
 * @module lib/memory/letta-crisis-client
 * @description
 * Letta Crisis Client - TypeScript client for crisis detection.
 *
 * Provides crisis detection and monitoring for Letta agents
 * with Foresight integration.
 */

export interface CrisisResult {
  severity: 'none' | 'medium' | 'high' | 'critical'
  indicators: string[]
  requiresAction: boolean
  suggestedAction?: string
}

export interface CrisisConfig {
  apiUrl: string
  enabled: boolean
  severityThreshold: 'medium' | 'high' | 'critical'
}

export interface CrisisContext {
  userId: string
  sessionId: string
  [key: string]: unknown
}

export interface CrisisResources {
  resources: string[]
}

/**
 * Letta Crisis Client for crisis detection and monitoring.
 *
 * Provides crisis detection capabilities for Letta agents
 * with Foresight integration for clinically-safe AI agents.
 */
export class LettaCrisisClient {
  private readonly config: CrisisConfig

  constructor(config: CrisisConfig) {
    this.config = config
  }

  /**
   * Check message for crisis indicators.
   *
   * @param message - User message to analyze
   * @returns Crisis detection result
   */
  async checkMessage(message: string): Promise<CrisisResult> {
    if (!this.config.enabled) {
      return {
        severity: 'none',
        indicators: [],
        requiresAction: false,
      }
    }

    const response = await fetch(`${this.config.apiUrl}/crisis/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      throw new Error(
        `Crisis detection failed: ${response.status} ${response.statusText}`,
      )
    }

    return response.json() as Promise<CrisisResult>
  }

  /**
   * Report crisis event.
   *
   * @param result - Crisis detection result
   * @param context - Contextual information (userId, sessionId)
   */
  async reportCrisis(
    result: CrisisResult,
    context: CrisisContext,
  ): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/crisis/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ result, context }),
    })

    if (!response.ok) {
      throw new Error(
        `Crisis report failed: ${response.status} ${response.statusText}`,
      )
    }
  }

  /**
   * Get crisis resources based on indicators.
   *
   * @param indicators - List of crisis indicators
   * @returns List of resource URLs or descriptions
   */
  async getResources(indicators: string[]): Promise<string[]> {
    const response = await fetch(`${this.config.apiUrl}/crisis/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ indicators }),
    })

    if (!response.ok) {
      throw new Error('Failed to get crisis resources')
    }

    const data = (await response.json()) as
      | CrisisResources
      | { resources: string[] }
    return data.resources
  }

  /**
   * Check if message requires immediate action based on severity threshold.
   *
   * @param result - Crisis detection result
   * @returns True if immediate action is required
   */
  requiresImmediateAction(result: CrisisResult): boolean {
    const severityOrder: Record<CrisisResult['severity'], number> = {
      none: 0,
      medium: 1,
      high: 2,
      critical: 3,
    }

    const threshold = severityOrder[this.config.severityThreshold]
    const current = severityOrder[result.severity]

    return current >= threshold
  }

  /**
   * Get appropriate crisis response message.
   *
   * @param result - Crisis detection result
   * @returns Response message for the user
   */
  getCrisisResponse(result: CrisisResult): string {
    if (result.severity === 'critical') {
      if (result.indicators.includes('suicide')) {
        return (
          "I'm concerned about your safety. Please reach out to a professional. " +
          'National Suicide Prevention Lifeline: 988 (US), ' +
          'International: https://findahelpline.com'
        )
      }

      if (result.indicators.includes('self-harm')) {
        return (
          "I'm here to help. Consider reaching out to support resources. " +
          'Crisis Text Line: Text HOME to 741741'
        )
      }

      if (result.indicators.includes('violence')) {
        return (
          "Let's de-escalate this situation. If there's immediate danger, " +
          'please contact emergency services.'
        )
      }

      return "I'm concerned. Please consider reaching out to a professional for support."
    }

    if (result.severity === 'high' && result.suggestedAction) {
      return `Supportive response: ${result.suggestedAction}`
    }

    return "I'm here to help. Let me know if you need support."
  }
}

/**
 * Create a Letta Crisis Client instance.
 *
 * @param config - Crisis client configuration
 * @returns Configured crisis client instance
 */
export function createCrisisClient(config: CrisisConfig): LettaCrisisClient {
  return new LettaCrisisClient(config)
}
