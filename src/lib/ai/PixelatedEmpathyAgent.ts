/**
 * Azure AI Agent Service for Pixelated Empathy
 * Connects to our specialized clinical AI agent for therapeutic scenario generation
 */

export interface AgentResponse {
  success: boolean
  response: string | null
  error?: string
  metadata?: Record<string, unknown>
  conversation_id?: string
}
export class PixelatedEmpathyAgent {
  private readonly agentEndpoint: string
  private readonly apiKey: string
  private readonly agentId: string

  constructor(config: {
    agentEndpoint: string
    apiKey: string
    agentId: string
  }) {
    this.agentEndpoint = config.agentEndpoint
    this.apiKey = config.apiKey
    this.agentId = config.agentId
  }

  /**
   * Generate a therapeutic training scenario
   */
  async generateScenario(request: {
    condition:
      | 'depression'
      | 'anxiety'
      | 'ptsd'
      | 'bipolar'
      | 'substance_use'
      | 'personality_disorder'
      | 'crisis'
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    population?:
      | 'adolescent'
      | 'adult'
      | 'geriatric'
      | 'cultural_minority'
      | 'lgbtq'
      | 'veteran'
    learningObjectives?: string[]
  }): Promise<AgentResponse> {
    const prompt = `Generate a ${request.difficulty} level training scenario for ${request.condition}${
      request.population ? ` with a ${request.population} client` : ''
    }.${
      request.learningObjectives
        ? ` Focus on these learning objectives: ${request.learningObjectives.join(', ')}`
        : ''
    }`

    return this.sendMessage(prompt, 'scenario_generation')
  }

  /**
   * Get bias detection analysis
   */
  async analyzeBias(conversationTranscript: string): Promise<AgentResponse> {
    const prompt = `Analyze this therapeutic conversation for potential biases (cultural, gender, racial, socioeconomic): ${conversationTranscript}`
    return this.sendMessage(prompt, 'bias_detection')
  }

  /**
   * Get training module recommendations
   */
  async recommendTraining(therapistProfile: {
    experience: 'beginner' | 'intermediate' | 'advanced'
    specializations: string[]
    weakAreas?: string[]
  }): Promise<AgentResponse> {
    const prompt = `Recommend training modules for a ${therapistProfile.experience} therapist specializing in ${therapistProfile.specializations.join(', ')}${
      therapistProfile.weakAreas
        ? ` who needs improvement in ${therapistProfile.weakAreas.join(', ')}`
        : ''
    }`
    return this.sendMessage(prompt, 'training_recommendation')
  }

  /**
   * Get platform status and metrics
   */
  async getPlatformStatus(): Promise<AgentResponse> {
    const prompt =
      'Check the current status of Pixelated Empathy platform services and provide a summary of recent metrics'
    return this.sendMessage(prompt, 'platform_status')
  }

  /**
   * Generate assessment criteria for a scenario
   */
  async generateAssessment(
    scenarioId: string,
    difficulty: string,
  ): Promise<AgentResponse> {
    const prompt = `Generate assessment criteria and rubric for scenario ${scenarioId} at ${difficulty} difficulty level`
    return this.sendMessage(prompt, 'assessment_generation')
  }

  /**
   * Send message to the Azure AI Agent
   */
  async sendMessage(message: string, context: string): Promise<AgentResponse> {
    try {
      const response = await fetch(`${this.agentEndpoint}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Agent-Context': context,
        },
        body: JSON.stringify({
          message,
          agent_id: this.agentId,
          conversation_id: `${context}_${Date.now()}`,
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        throw new Error(
          `Agent API error: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()
      return {
        success: true,
        response: data.response || data.message,
        metadata: data.metadata || {},
        conversation_id: data.conversation_id,
      }
    } catch (error: unknown) {
      console.error('Azure AI Agent error:', error)
      return {
        success: false,
        error: error instanceof Error ? String(error) : 'Unknown error',
        response: null,
      }
    }
  }

  /**
   * Stream conversation with the agent (for real-time interactions)
   */
  async *streamConversation(
    message: string,
    context: string = 'general',
  ): AsyncGenerator<unknown, void, unknown> {
    try {
      const response = await fetch(`${this.agentEndpoint}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          agent_id: this.agentId,
          context,
          stream: true,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6) as unknown)
                yield data
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error: unknown) {
      console.error('Stream error:', error)
      yield { error: error instanceof Error ? String(error) : 'Stream error' }
    }
  }
}

// Environment configuration
export const createPixelatedEmpathyAgent = () => {
  const config = {
    agentEndpoint: process.env['AZURE_AI_AGENT_ENDPOINT'] || '',
    apiKey: process.env['AZURE_AI_AGENT_KEY'] || '',
    agentId: process.env['AZURE_AI_AGENT_ID'] || '',
  }

  if (!config.agentEndpoint || !config.apiKey || !config.agentId) {
    throw new Error(
      'Missing Azure AI Agent configuration. Please set AZURE_AI_AGENT_ENDPOINT, AZURE_AI_AGENT_KEY, and AZURE_AI_AGENT_ID environment variables.',
    )
  }

  return new PixelatedEmpathyAgent(config)
}

// Example usage types
export interface TherapeuticScenario {
  scenario_id: string
  client_background: string
  presenting_problem: string
  session_goals: string[]
  expected_challenges: string[]
  assessment_criteria: {
    therapeutic_alliance: string[]
    intervention_quality: string[]
    crisis_management?: string[]
  }
}

export interface BiasAnalysis {
  overall_score: number
  detected_biases: {
    type: string
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendations: string[]
  }[]
  cultural_sensitivity_score: number
  inclusive_language_score: number
}
