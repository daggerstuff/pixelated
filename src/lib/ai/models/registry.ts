import type { AIModel, ModelCapability } from './types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { config as envConfig } from '@/config/env.config'

const appLogger = createBuildSafeLogger('app')

/**
 * Production AI Model Registry
 *
 * Provides comprehensive model management with intelligent selection,
 * provider integration, and performance monitoring capabilities.
 */

// Enhanced capability types for better type safety
export type ModelCapability =
  | 'chat'
  | 'sentiment'
  | 'crisis'
  | 'response'
  | 'intervention'
  | 'analysis'
  | 'reasoning'
  | 'code-generation'
  | 'summarization'
  | 'therapeutic-planning'
  | 'emotion-validation'
  | 'safety-assessment'

// Enhanced model interface with operational metadata
export interface ExtendedAIModel extends AIModel {
  // Basic identification
  displayName: string
  description: string
  family?: string

  // Operational metadata
  status: 'active' | 'deprecated' | 'experimental' | 'maintenance'
  lastUpdated: string
  contextWindow: number
  maxOutputTokens: number

  // Performance characteristics
  performance?: {
    averageLatencyMs: number
    tokensPerSecond: number
    reliabilityScore: number // 0-1
    uptime: number // 0-1
  }

  // Cost information
  pricing?: {
    inputTokensPerMillion: number
    outputTokensPerMillion: number
    currency: string
  }

  // Specialization and use case information
  specialization?: {
    domains: string[]
    useCases: string[]
    strengths: string[]
    limitations: string[]
  }

  // Legacy capability mapping for backward compatibility
  legacyCapabilities: Array<
    'chat' | 'sentiment' | 'crisis' | 'response' | 'intervention'
  >
}

// Provider health monitoring
export interface ProviderHealth {
  provider: string
  isAvailable: boolean
  lastChecked: Date
  responseTime: number
  errorRate: number
  rateLimit: {
    current: number
    limit: number
    resetTime: Date
  }
}

// Comprehensive model database
const modelDatabase: ExtendedAIModel[] = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    description:
      'Latest multimodal model with enhanced reasoning and efficiency',
    provider: 'openai',
    version: '2024-05-13',
    family: 'gpt-4',
    status: 'active',
    lastUpdated: '2024-01-15',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: true,
      imageAnalysis: true,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 128000,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: "OpenAI's most advanced multimodal model",
      trainingData: 'Internet data up to April 2024',
      releaseDate: new Date('2024-05-13'),
      lastUpdated: new Date('2024-05-13'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 5000,
        outputTokensPerMillion: 15000,
        currency: 'USD',
      },
      performance: {
        latency: 2500,
        throughput: 150,
        accuracy: 0.96,
      },
    },
    performance: {
      averageLatencyMs: 2500,
      tokensPerSecond: 150,
      reliabilityScore: 0.98,
      uptime: 0.999,
    },
    pricing: {
      inputTokensPerMillion: 5000,
      outputTokensPerMillion: 15000,
      currency: 'USD',
    },
    specialization: {
      domains: ['general', 'technical', 'creative', 'therapeutic'],
      useCases: [
        'therapeutic-conversation',
        'crisis-assessment',
        'analysis',
        'coding',
      ],
      strengths: [
        'multimodal-understanding',
        'complex-reasoning',
        'context-retention',
      ],
      limitations: ['cost', 'rate-limits'],
    },
    legacyCapabilities: ['chat', 'sentiment', 'crisis', 'response'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    description: 'High-performance model optimized for complex reasoning tasks',
    provider: 'openai',
    version: '2024-04-09',
    family: 'gpt-4',
    status: 'active',
    lastUpdated: '2024-01-10',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: true,
      imageAnalysis: false,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 128000,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Advanced reasoning model with large context window',
      trainingData: 'Internet data up to April 2024',
      releaseDate: new Date('2024-04-09'),
      lastUpdated: new Date('2024-04-09'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 10000,
        outputTokensPerMillion: 30000,
        currency: 'USD',
      },
      performance: {
        latency: 3000,
        throughput: 120,
        accuracy: 0.95,
      },
    },
    performance: {
      averageLatencyMs: 3000,
      tokensPerSecond: 120,
      reliabilityScore: 0.96,
      uptime: 0.998,
    },
    pricing: {
      inputTokensPerMillion: 10000,
      outputTokensPerMillion: 30000,
      currency: 'USD',
    },
    specialization: {
      domains: ['analytical', 'technical', 'research'],
      useCases: ['complex-analysis', 'therapeutic-planning', 'research'],
      strengths: ['large-context', 'detailed-analysis', 'reasoning'],
      limitations: ['cost', 'slower-response'],
    },
    legacyCapabilities: ['chat', 'sentiment', 'crisis', 'response'],
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    description: 'Fast and cost-effective model for general conversations',
    provider: 'openai',
    version: '1106',
    family: 'gpt-3.5',
    status: 'active',
    lastUpdated: '2024-01-05',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: true,
      imageAnalysis: false,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 16385,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Efficient model for everyday conversational tasks',
      trainingData: 'Internet data up to September 2021',
      releaseDate: new Date('2023-11-06'),
      lastUpdated: new Date('2023-11-06'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 500,
        outputTokensPerMillion: 1500,
        currency: 'USD',
      },
      performance: {
        latency: 1500,
        throughput: 200,
        accuracy: 0.9,
      },
    },
    performance: {
      averageLatencyMs: 1500,
      tokensPerSecond: 200,
      reliabilityScore: 0.94,
      uptime: 0.997,
    },
    pricing: {
      inputTokensPerMillion: 500,
      outputTokensPerMillion: 1500,
      currency: 'USD',
    },
    specialization: {
      domains: ['general', 'casual'],
      useCases: ['basic-conversation', 'quick-analysis'],
      strengths: ['speed', 'cost-effective', 'reliable'],
      limitations: ['limited-reasoning', 'smaller-context'],
    },
    legacyCapabilities: ['chat', 'sentiment', 'response'],
  },

  // Anthropic Models
  {
    id: 'claude-3-opus-20240229',
    name: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    description: 'Most capable Claude model for complex analysis and reasoning',
    provider: 'anthropic',
    version: '20240229',
    family: 'claude-3',
    status: 'active',
    lastUpdated: '2024-02-29',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: false,
      imageAnalysis: true,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 200000,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description:
        "Anthropic's most capable model with strong safety alignment",
      trainingData: 'Constitutional AI training data up to April 2024',
      releaseDate: new Date('2024-02-29'),
      lastUpdated: new Date('2024-02-29'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 15000,
        outputTokensPerMillion: 75000,
        currency: 'USD',
      },
      performance: {
        latency: 4000,
        throughput: 100,
        accuracy: 0.97,
      },
    },
    performance: {
      averageLatencyMs: 4000,
      tokensPerSecond: 100,
      reliabilityScore: 0.97,
      uptime: 0.996,
    },
    pricing: {
      inputTokensPerMillion: 15000,
      outputTokensPerMillion: 75000,
      currency: 'USD',
    },
    specialization: {
      domains: ['therapeutic', 'analytical', 'creative', 'safety-critical'],
      useCases: [
        'crisis-intervention',
        'deep-analysis',
        'therapeutic-conversation',
      ],
      strengths: [
        'safety-alignment',
        'nuanced-understanding',
        'large-context',
        'ethical-reasoning',
      ],
      limitations: ['cost', 'slower-speed'],
    },
    legacyCapabilities: [
      'chat',
      'sentiment',
      'crisis',
      'response',
      'intervention',
    ],
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'claude-3-sonnet-20240229',
    displayName: 'Claude 3 Sonnet',
    description: 'Balanced model optimized for therapeutic applications',
    provider: 'anthropic',
    version: '20240229',
    family: 'claude-3',
    status: 'active',
    lastUpdated: '2024-02-29',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: false,
      imageAnalysis: true,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 200000,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Balanced model with strong therapeutic capabilities',
      trainingData: 'Constitutional AI training data up to April 2024',
      releaseDate: new Date('2024-02-29'),
      lastUpdated: new Date('2024-02-29'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 3000,
        outputTokensPerMillion: 15000,
        currency: 'USD',
      },
      performance: {
        latency: 2800,
        throughput: 130,
        accuracy: 0.94,
      },
    },
    performance: {
      averageLatencyMs: 2800,
      tokensPerSecond: 130,
      reliabilityScore: 0.95,
      uptime: 0.998,
    },
    pricing: {
      inputTokensPerMillion: 3000,
      outputTokensPerMillion: 15000,
      currency: 'USD',
    },
    specialization: {
      domains: ['therapeutic', 'analytical', 'healthcare'],
      useCases: [
        'therapeutic-conversation',
        'emotion-validation',
        'safety-assessment',
      ],
      strengths: [
        'balanced-performance',
        'safety-focused',
        'therapeutic-awareness',
      ],
      limitations: ['moderate-reasoning-complexity'],
    },
    legacyCapabilities: [
      'chat',
      'sentiment',
      'crisis',
      'response',
      'intervention',
    ],
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    description: 'Fast and efficient model for quick responses',
    provider: 'anthropic',
    version: '20240307',
    family: 'claude-3',
    status: 'active',
    lastUpdated: '2024-03-07',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: false,
      imageAnalysis: true,
      audioProcessing: false,
      maxTokens: 4096,
      contextWindow: 200000,
      supportedLanguages: [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'ja',
        'ko',
        'zh',
      ],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Fast model optimized for speed and efficiency',
      trainingData: 'Constitutional AI training data up to April 2024',
      releaseDate: new Date('2024-03-07'),
      lastUpdated: new Date('2024-03-07'),
      license: 'Commercial',
      pricing: {
        inputTokensPerMillion: 250,
        outputTokensPerMillion: 1250,
        currency: 'USD',
      },
      performance: {
        latency: 1200,
        throughput: 250,
        accuracy: 0.88,
      },
    },
    performance: {
      averageLatencyMs: 1200,
      tokensPerSecond: 250,
      reliabilityScore: 0.93,
      uptime: 0.997,
    },
    pricing: {
      inputTokensPerMillion: 250,
      outputTokensPerMillion: 1250,
      currency: 'USD',
    },
    specialization: {
      domains: ['general', 'quick-response'],
      useCases: ['quick-analysis', 'basic-conversation'],
      strengths: ['speed', 'cost-effective', 'large-context'],
      limitations: ['limited-complex-reasoning'],
    },
    legacyCapabilities: ['chat', 'sentiment', 'response'],
  },

  // Together AI Models
  {
    id: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
    name: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
    displayName: 'Mixtral 8x7B Instruct',
    description: 'Open-source mixture of experts model via Together AI',
    provider: 'together',
    version: 'v0.2',
    family: 'mixtral',
    status: 'active',
    lastUpdated: '2024-01-20',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: true,
      functionCalling: false,
      imageAnalysis: false,
      audioProcessing: false,
      maxTokens: 8192,
      contextWindow: 32768,
      supportedLanguages: ['en', 'fr', 'de', 'es', 'it'],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 8192,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Open-source mixture of experts model',
      trainingData: 'Open web data',
      releaseDate: new Date('2024-01-15'),
      lastUpdated: new Date('2024-01-20'),
      license: 'Apache 2.0',
      pricing: {
        inputTokensPerMillion: 600,
        outputTokensPerMillion: 600,
        currency: 'USD',
      },
      performance: {
        latency: 2000,
        throughput: 180,
        accuracy: 0.85,
      },
    },
    performance: {
      averageLatencyMs: 2000,
      tokensPerSecond: 180,
      reliabilityScore: 0.9,
      uptime: 0.995,
    },
    pricing: {
      inputTokensPerMillion: 600,
      outputTokensPerMillion: 600,
      currency: 'USD',
    },
    specialization: {
      domains: ['general', 'technical'],
      useCases: ['conversation', 'technical-analysis'],
      strengths: ['cost-effective', 'good-performance', 'open-source'],
      limitations: ['less-safety-tuning', 'moderate-reasoning'],
    },
    legacyCapabilities: ['chat', 'intervention'],
  },

  // Local/Experimental Models
  {
    id: 'mental-llama-7b',
    name: 'mental-llama-7b',
    displayName: 'MentalLLaMA 7B',
    description: 'Specialized local model for mental health applications',
    provider: 'local',
    version: '1.0',
    family: 'mental-llama',
    status: 'experimental',
    lastUpdated: '2024-01-01',
    contextWindow: 4096,
    maxOutputTokens: 2048,
    capabilities: {
      textGeneration: true,
      textAnalysis: true,
      chatCompletion: true,
      streaming: false,
      functionCalling: false,
      imageAnalysis: false,
      audioProcessing: false,
      maxTokens: 2048,
      contextWindow: 4096,
      supportedLanguages: ['en'],
    },
    configuration: {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: [],
    },
    metadata: {
      description: 'Specialized model for mental health conversations',
      trainingData: 'Mental health conversation datasets',
      releaseDate: new Date('2024-01-01'),
      lastUpdated: new Date('2024-01-01'),
      license: 'Research Only',
      pricing: {
        inputTokensPerMillion: 0,
        outputTokensPerMillion: 0,
        currency: 'USD',
      },
      performance: {
        latency: 5000,
        throughput: 50,
        accuracy: 0.8,
      },
    },
    performance: {
      averageLatencyMs: 5000,
      tokensPerSecond: 50,
      reliabilityScore: 0.85,
      uptime: 0.99,
    },
    pricing: {
      inputTokensPerMillion: 0,
      outputTokensPerMillion: 0,
      currency: 'USD',
    },
    specialization: {
      domains: ['mental-health', 'therapeutic'],
      useCases: [
        'therapeutic-conversation',
        'mental-health-assessment',
        'emotion-analysis',
      ],
      strengths: [
        'specialized-training',
        'privacy-focused',
        'local-deployment',
      ],
      limitations: [
        'smaller-model',
        'experimental',
        'limited-general-knowledge',
      ],
    },
    legacyCapabilities: ['chat', 'sentiment', 'crisis', 'intervention'],
  },
]

// Provider availability cache
const providerHealthCache = new Map<string, ProviderHealth>()

/**
 * Production AI Model Registry Class
 */
export class AIModelRegistry {
  private models: Map<string, ExtendedAIModel>
  private providerModels: Map<string, string[]>
  private capabilityModels: Map<string, string[]>

  constructor() {
    this.models = new Map()
    this.providerModels = new Map()
    this.capabilityModels = new Map()
    this.initializeRegistry()
  }

  private initializeRegistry(): void {
    // Populate lookup maps for performance
    for (const model of modelDatabase) {
      this.models.set(model.id, model)

      // Index by provider
      if (!this.providerModels.has(model.provider)) {
        this.providerModels.set(model.provider, [])
      }
      this.providerModels.get(model.provider)!.push(model.id)

      // Index by legacy capabilities for backward compatibility
      for (const capability of model.legacyCapabilities) {
        if (!this.capabilityModels.has(capability)) {
          this.capabilityModels.set(capability, [])
        }
        this.capabilityModels.get(capability)!.push(model.id)
      }
    }

    appLogger.info(
      `AI Model Registry initialized with ${this.models.size} models across ${this.providerModels.size} providers`,
    )
  }

  /**
   * Check if provider is configured and available
   */
  isProviderAvailable(provider: string): boolean {
    // Lazy load config to avoid initialization order issues
    const getConfig = () => {
      try {
        return envConfig
      } catch {
        return null
      }
    }

    const config = getConfig()
    if (!config) {
      return false
    }

    switch (provider) {
      case 'openai':
        return !!config.ai.openAiKey()
      case 'anthropic':
        return !!config.ai.anthropicApiKey()
      case 'together':
        return !!config.ai.togetherApiKey()
      case 'azure-openai':
        return !!(config.ai.azureOpenAiKey() && config.ai.azureOpenAiEndpoint())
      case 'local':
        return true // Local models are always "available" if configured
      default:
        return false
    }
  }

  /**
   * Get filtered models based on availability
   */
  getAvailableModels(): ExtendedAIModel[] {
    return Array.from(this.models.values()).filter(
      (model) =>
        model.status === 'active' && this.isProviderAvailable(model.provider),
    )
  }

  /**
   * Intelligent model selection for therapeutic use cases
   */
  selectOptimalModel(requirements: {
    capabilities?: ModelCapability[]
    maxLatency?: number
    maxCostPerToken?: number
    minReliability?: number
    preferredProviders?: string[]
    contextWindowMin?: number
    useCase?: 'crisis' | 'therapy' | 'analysis' | 'general'
  }): ExtendedAIModel | null {
    let candidates = this.getAvailableModels()

    // Filter by capabilities if specified
    if (requirements.capabilities) {
      candidates = candidates.filter((model) =>
        requirements.capabilities!.every((cap) =>
          model.legacyCapabilities.includes(cap as ModelCapability),
        ),
      )
    }

    // Apply performance filters
    if (requirements.maxLatency && candidates.length > 0) {
      candidates = candidates.filter(
        (model) =>
          !model.performance ||
          model.performance.averageLatencyMs <= requirements.maxLatency!,
      )
    }

    if (requirements.maxCostPerToken && candidates.length > 0) {
      candidates = candidates.filter((model) => {
        if (!model.pricing) {
          return true
        }
        const costPerToken = model.pricing.outputTokensPerMillion / 1000000
        return costPerToken <= requirements.maxCostPerToken!
      })
    }

    if (requirements.minReliability && candidates.length > 0) {
      candidates = candidates.filter(
        (model) =>
          !model.performance ||
          model.performance.reliabilityScore >= requirements.minReliability!,
      )
    }

    if (requirements.contextWindowMin && candidates.length > 0) {
      candidates = candidates.filter(
        (model) => model.contextWindow >= requirements.contextWindowMin!,
      )
    }

    if (requirements.preferredProviders && candidates.length > 0) {
      const preferred = candidates.filter((model) =>
        requirements.preferredProviders!.includes(model.provider),
      )
      if (preferred.length > 0) {
        candidates = preferred
      }
    }

    if (candidates.length === 0) {
      return null
    }

    // Score and rank candidates
    const scoredCandidates = candidates
      .map((model) => ({
        model,
        score: this.calculateModelScore(model, requirements),
      }))
      .sort((a, b) => b.score - a.score)

    // Safety check and explicit access to avoid TypeScript undefined error
    const topCandidate = scoredCandidates[0]
    if (!topCandidate) {
      return null
    }

    return topCandidate.model
  }

  private calculateModelScore(
    model: ExtendedAIModel,
    requirements: {
      capabilities?: ModelCapability[]
      maxLatency?: number
      maxCostPerToken?: number
      minReliability?: number
      preferredProviders?: string[]
      contextWindowMin?: number
      useCase?: 'crisis' | 'therapy' | 'analysis' | 'general'
    },
  ): number {
    let score = 0

    // Base reliability score (30% weight)
    if (model.performance?.reliabilityScore) {
      score += model.performance.reliabilityScore * 30
    }

    // Speed bonus (20% weight - inverse of latency)
    if (model.performance?.averageLatencyMs) {
      const speedScore = Math.max(
        0,
        20 - (model.performance.averageLatencyMs / 1000) * 2,
      )
      score += speedScore
    }

    // Cost efficiency (20% weight)
    if (model.pricing?.outputTokensPerMillion) {
      const costScore = Math.max(
        0,
        20 - model.pricing.outputTokensPerMillion / 5000,
      )
      score += costScore
    }

    // Use case specialization (20% weight)
    if (requirements.useCase && model.specialization) {
      const useCaseScores = {
        crisis: model.legacyCapabilities.includes('crisis') ? 15 : 0,
        therapy: model.specialization.domains.includes('therapeutic') ? 15 : 0,
        analysis: model.legacyCapabilities.includes('sentiment') ? 10 : 0,
        general: 5,
      }
      score += useCaseScores[requirements.useCase] || 0
    }

    // Provider preference (10% weight)
    if (requirements.preferredProviders?.includes(model.provider)) {
      score += 10
    }

    return score
  }

  /**
   * Get model by ID
   */
  getModelById(id: string): ExtendedAIModel | undefined {
    return this.models.get(id)
  }

  /**
   * Get provider health status
   */
  getProviderHealth(provider: string): ProviderHealth | null {
    return providerHealthCache.get(provider) || null
  }

  /**
   * Update provider health status
   */
  updateProviderHealth(
    provider: string,
    health: Partial<ProviderHealth>,
  ): void {
    const existing = providerHealthCache.get(provider) || {
      provider,
      isAvailable: false,
      lastChecked: new Date(),
      responseTime: 0,
      errorRate: 0,
      rateLimit: { current: 0, limit: 1000, resetTime: new Date() },
    }

    providerHealthCache.set(provider, {
      ...existing,
      ...health,
      lastChecked: new Date(),
    })
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalModels: number
    activeModels: number
    availableProviders: number
    modelsByProvider: Record<string, number>
    averageLatency: number
    averageReliability: number
  } {
    const allModels = Array.from(this.models.values())
    const activeModels = allModels.filter((m) => m.status === 'active')

    let totalLatency = 0
    let totalReliability = 0
    let performanceCount = 0

    const modelsByProvider: Record<string, number> = {}

    for (const model of allModels) {
      modelsByProvider[model.provider] =
        (modelsByProvider[model.provider] || 0) + 1

      if (model.performance) {
        totalLatency += model.performance.averageLatencyMs
        totalReliability += model.performance.reliabilityScore
        performanceCount++
      }
    }

    return {
      totalModels: allModels.length,
      activeModels: activeModels.length,
      availableProviders: Array.from(this.providerModels.keys()).filter((p) =>
        this.isProviderAvailable(p),
      ).length,
      modelsByProvider,
      averageLatency:
        performanceCount > 0 ? totalLatency / performanceCount : 0,
      averageReliability:
        performanceCount > 0 ? totalReliability / performanceCount : 0,
    }
  }
}

// Singleton registry instance
export const modelRegistry = new AIModelRegistry()

// Backward compatibility functions with enhanced functionality
export function getAllModels(): AIModel[] {
  return modelRegistry.getAvailableModels().map(extendedToLegacy)
}

export function getModelsByProvider(provider: string): AIModel[] {
  return modelRegistry
    .getAvailableModels()
    .filter((model) => model.provider === provider)
    .map(extendedToLegacy)
}

export function getModelsByCapability(
  capability: 'chat' | 'sentiment' | 'crisis' | 'response' | 'intervention',
): AIModel[] {
  return modelRegistry
    .getAvailableModels()
    .filter((model) => model.legacyCapabilities.includes(capability))
    .map(extendedToLegacy)
}

// Helper function to convert extended model to legacy format
function extendedToLegacy(extended: ExtendedAIModel): AIModel {
  return {
    id: extended.id,
    name: extended.name,
    provider: extended.provider,
    version: extended.version,
    capabilities: extended.capabilities,
    configuration: extended.configuration,
    metadata: extended.metadata,
  }
}
