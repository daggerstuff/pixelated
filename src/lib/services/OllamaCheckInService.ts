import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getEnv } from '@/lib/utils/env'

const logger = createBuildSafeLogger('ollama-checkin')

export interface OllamaCheckInRequest {
  model: string
  prompt: string
  options?: {
    temperature?: number
    top_p?: number
    max_tokens?: number
  }
}

export interface OllamaResponse {
  response: string
  done: boolean
}

export interface ImprovementSuggestion {
  id: string
  suggestion: string
  reasoning?: string
  priority: 'low' | 'medium' | 'high'
  category:
    | 'code-quality'
    | 'architecture'
    | 'testing'
    | 'documentation'
    | 'implementation'
    | 'security'
    | 'performance'
}

export interface CheckInResult {
  shouldContinue: boolean
  improvements: ImprovementSuggestion[]
  rawResponse: string
  decision: 'yes' | 'no'
  reasoningLog: string[]
}

export class OllamaCheckInService {
  private baseUrl: string
  private defaultModel: string

  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl =
      baseUrl || getEnv('OLLAMA_BASE_URL') || 'https://api.pixelatedempathy.com'
    this.defaultModel = defaultModel || 'granite3.3'
  }

  /**
   * Generate the enhanced prompt for task check-in
   */
  private generateEnhancedPrompt(taskSummary: string): string {
    return `You are an AI project oversight system reviewing task completion progress. Based on the task summary provided, please:

1. Provide 1-3 specific improvement ideas for the completed task (focus on code quality, architecture, testing, documentation, or implementation approach)
2. Decide whether the project should continue to the next task

Response format:
IMPROVEMENTS:
- [Improvement idea 1]
- [Improvement idea 2] (if applicable)
- [Improvement idea 3] (if applicable)

DECISION: [yes/no]

Task completed: ${taskSummary}

Remember:
- Always suggest improvements unless the task is perfect
- Only say "no" if there are critical errors, failures, or security issues
- Consider maintainability, scalability, and best practices
- Be constructive and specific in your suggestions`
  }

  /**
   * Send check-in request to Ollama API
   */
  private async sendOllamaRequest(
    prompt: string,
    model?: string,
  ): Promise<OllamaResponse> {
    const requestBody: OllamaCheckInRequest = {
      model: model || this.defaultModel,
      prompt,
      options: {
        temperature: 0.3, // Lower temperature for more consistent responses
        max_tokens: 1000,
      },
    }

    logger.info('Sending check-in request to Ollama', {
      model: requestBody.model,
      promptLength: prompt.length,
    })

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Ollama API error', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        })
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }

      const result = (await response.json()) as OllamaResponse
      logger.info('Received Ollama response', {
        responseLength: result.response?.length || 0,
        done: result.done,
      })

      return result
    } catch (error: unknown) {
      logger.error('Failed to send Ollama request', {
        error: error instanceof Error ? String(error) : String(error),
        baseUrl: this.baseUrl,
      })
      throw error
    }
  }

  /**
   * Parse Ollama response to extract improvements and decision
   */
  private parseOllamaResponse(response: string): {
    improvements: ImprovementSuggestion[]
    decision: 'yes' | 'no'
  } {
    const improvements: ImprovementSuggestion[] = []
    let decision: 'yes' | 'no' = 'yes' // Default to yes if parsing fails

    try {
      // Extract improvements section
      const improvementsMatch = response.match(
        /IMPROVEMENTS:\s*([\s\S]*?)(?=DECISION:|$)/i,
      )
      if (improvementsMatch) {
        const improvementsText = improvementsMatch[1].trim()
        const improvementLines = improvementsText
          .split('\n')
          .map((line) => line.trim())
          .filter(
            (line) =>
              line.startsWith('-') ||
              line.startsWith('•') ||
              line.match(/^\d+\./),
          )

        improvementLines.forEach((line, index) => {
          const cleanedLine = line.replace(/^[-•]\s*|\d+\.\s*/, '').trim()
          if (cleanedLine) {
            improvements.push({
              id: `improvement-${Date.now()}-${index}`,
              suggestion: cleanedLine,
              priority: 'medium', // Default priority
              category: this.categorizeImprovement(cleanedLine),
            })
          }
        })
      }

      // Extract decision
      const decisionMatch = response.match(/DECISION:\s*(yes|no)/i)
      if (decisionMatch) {
        decision = decisionMatch[1].toLowerCase() as 'yes' | 'no'
      } else {
        // Fallback: look for yes/no anywhere in the response
        const fallbackMatch = response.match(/\b(yes|no)\b/i)
        if (fallbackMatch) {
          decision = fallbackMatch[1].toLowerCase() as 'yes' | 'no'
        }
      }

      logger.info('Parsed Ollama response', {
        improvementsCount: improvements.length,
        decision,
      })
    } catch (error: unknown) {
      logger.warn('Failed to parse Ollama response, using defaults', {
        error: error instanceof Error ? String(error) : String(error),
        response: response.substring(0, 200) + '...',
      })
    }

    return { improvements, decision }
  }

  /**
   * Categorize improvement suggestion based on content
   */
  private categorizeImprovement(
    suggestion: string,
  ): ImprovementSuggestion['category'] {
    const lowerSuggestion = suggestion.toLowerCase()

    if (
      lowerSuggestion.includes('test') ||
      lowerSuggestion.includes('spec') ||
      lowerSuggestion.includes('coverage')
    ) {
      return 'testing'
    }
    if (
      lowerSuggestion.includes('document') ||
      lowerSuggestion.includes('comment') ||
      lowerSuggestion.includes('readme')
    ) {
      return 'documentation'
    }
    if (
      lowerSuggestion.includes('security') ||
      lowerSuggestion.includes('auth') ||
      lowerSuggestion.includes('permission')
    ) {
      return 'security'
    }
    if (
      lowerSuggestion.includes('performance') ||
      lowerSuggestion.includes('optimize') ||
      lowerSuggestion.includes('speed')
    ) {
      return 'performance'
    }
    if (
      lowerSuggestion.includes('architecture') ||
      lowerSuggestion.includes('structure') ||
      lowerSuggestion.includes('pattern')
    ) {
      return 'architecture'
    }
    if (
      lowerSuggestion.includes('implement') ||
      lowerSuggestion.includes('logic') ||
      lowerSuggestion.includes('algorithm')
    ) {
      return 'implementation'
    }

    return 'code-quality' // Default category
  }

  /**
   * Reason about improvement suggestions and decide which to add as tasks
   */
  private reasonAboutImprovements(
    improvements: ImprovementSuggestion[],
    taskContext: string,
  ): string[] {
    const reasoningLog: string[] = []

    improvements.forEach((improvement) => {
      // Simple reasoning logic - in a real implementation, this could be more sophisticated
      let shouldAdd = false
      let reasoning = ''

      // Security improvements are always high priority
      if (improvement.category === 'security') {
        shouldAdd = true
        reasoning =
          'Security improvements are critical and should always be addressed'
      }
      // Testing improvements for new features
      else if (
        improvement.category === 'testing' &&
        taskContext.toLowerCase().includes('implement')
      ) {
        shouldAdd = true
        reasoning =
          'Testing is essential for new implementations to ensure reliability'
      }
      // Documentation for new features or APIs
      else if (
        improvement.category === 'documentation' &&
        (taskContext.toLowerCase().includes('api') ||
          taskContext.toLowerCase().includes('service'))
      ) {
        shouldAdd = true
        reasoning =
          'Documentation is important for APIs and services to ensure proper usage'
      }
      // Architecture improvements for complex features
      else if (
        improvement.category === 'architecture' &&
        taskContext.toLowerCase().includes('complex')
      ) {
        shouldAdd = true
        reasoning =
          'Architecture improvements are valuable for complex features to maintain maintainability'
      }
      // Performance improvements if explicitly mentioned
      else if (
        improvement.category === 'performance' &&
        improvement.suggestion.toLowerCase().includes('critical')
      ) {
        shouldAdd = true
        reasoning =
          'Critical performance improvements should be addressed immediately'
      } else {
        shouldAdd = false
        reasoning =
          'Improvement is valuable but not critical for current task completion'
      }

      const decision = shouldAdd ? 'ACCEPTED' : 'DEFERRED'
      reasoningLog.push(`${decision}: ${improvement.suggestion} - ${reasoning}`)
    })

    return reasoningLog
  }

  /**
   * Perform check-in with Ollama and process improvement suggestions
   */
  async performCheckIn(
    taskSummary: string,
    taskContext?: string,
  ): Promise<CheckInResult> {
    logger.info('Performing Ollama check-in', { taskSummary })

    try {
      // Generate enhanced prompt
      const prompt = this.generateEnhancedPrompt(taskSummary)

      // Send request to Ollama
      const ollamaResponse = await this.sendOllamaRequest(prompt)

      // Parse response
      const { improvements, decision } = this.parseOllamaResponse(
        ollamaResponse.response,
      )

      // Reason about improvements
      const reasoningLog = this.reasonAboutImprovements(
        improvements,
        taskContext || taskSummary,
      )

      const result: CheckInResult = {
        shouldContinue: decision === 'yes',
        improvements,
        rawResponse: ollamaResponse.response,
        decision,
        reasoningLog,
      }

      logger.info('Check-in completed', {
        shouldContinue: result.shouldContinue,
        improvementsCount: improvements.length,
        decision,
      })

      return result
    } catch (error: unknown) {
      logger.error('Check-in failed', {
        error: error instanceof Error ? String(error) : String(error),
        taskSummary,
      })

      // Return safe defaults on error
      return {
        shouldContinue: false, // Stop on error
        improvements: [],
        rawResponse: `Error: ${error instanceof Error ? String(error) : String(error)}`,
        decision: 'no',
        reasoningLog: [
          'Error occurred during check-in, stopping execution for safety',
        ],
      }
    }
  }

  /**
   * Generate task items from accepted improvement suggestions
   */
  generateTasksFromImprovements(
    improvements: ImprovementSuggestion[],
    reasoningLog: string[],
  ): string[] {
    const acceptedImprovements = improvements.filter((_, index) =>
      reasoningLog[index]?.startsWith('ACCEPTED:'),
    )

    return acceptedImprovements.map(
      (improvement) =>
        `- [ ] ${improvement.suggestion} (${improvement.category}, priority: ${improvement.priority})`,
    )
  }
}

export default OllamaCheckInService
