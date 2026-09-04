/**
 * MentalArena adapter types — extracted from MentalArenaAdapter.ts.
 */

import type { SyntheticConversation } from './types.ts'

export interface MentalArenaProvider {
  analyzeEmotions(text: string): Promise<EmotionAnalysisResult>
  generateIntervention(
    context: InterventionContext,
  ): Promise<InterventionResult>
  createChatCompletion(messages: ChatMessage[]): Promise<ChatCompletionResult>
  assessRisk(text: string): Promise<RiskAssessmentResult>
  handleEmergency(context: EmergencyContext): Promise<EmergencyResponse>
  generateText(prompt: string, options?: TextGenerationOptions): Promise<string>
}

export interface FHEService {
  encrypt(value: unknown): Promise<EncryptedData>
  decrypt(encrypted: EncryptedData): Promise<unknown>
  encryptText(text: string): Promise<string>
  decryptText(encrypted: string): Promise<string>
  generateHash(data: unknown): Promise<string>
  setEncryptionMode(mode: 'standard' | 'enhanced'): void
  scheme: {
    supportsOperation(op: string): boolean
  }
  isInitialized(): boolean
  initialize(config: any): Promise<void>
  generateKeys(): Promise<{ publicKey: string; privateKey: string }>
  supportsOperation(op: string): boolean
}

export interface GenerateSyntheticDataOptions {
  numSessions: number
  maxTurns: number
  disorders: string[]
  outputPath?: string
  model?: string
  temperature?: number
  qualityThreshold?: number
  enableValidation?: boolean
  encryptOutput?: boolean
}

export interface SyntheticDataGenerationResult {
  conversations: SyntheticConversation[]
  metadata: {
    totalSessions: number
    successfulGenerations: number
    failedGenerations: number
    averageAccuracyScore: number
    averageQualityScore: number
    processingTime: number
    uniqueSymptoms: number
    coverageByDisorder: Record<string, number>
  }
  qualityMetrics: {
    coherenceScore: number
    clinicalAccuracy: number
    conversationalFlow: number
    therapeuticValue: number
  }
  validationResults?: ValidationResult[]
}

export interface ValidationResult {
  sessionId: string
  isValid: boolean
  issues: ValidationIssue[]
  qualityScore: number
  recommendations: string[]
}

export interface ValidationIssue {
  type: 'clinical' | 'conversational' | 'ethical' | 'technical'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location?: string
  suggestion?: string
}

// Supporting interfaces
export interface EmotionAnalysisResult {
  dominant: string
  emotions: Record<string, number>
  confidence: number
  timestamp: string
  overallSentiment: string
  riskFactors: string[]
  contextualFactors: string[]
  requiresAttention: boolean
}

export interface InterventionContext {
  patientState: string
  symptoms: string[]
  history: string[]
  preferences: Record<string, unknown>
}

export interface InterventionResult {
  content: string
  techniques: string[]
  rationale?: string
  followUpSuggestions?: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
}

export interface ChatCompletionResult {
  content: string
  finishReason?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface RiskAssessmentResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  reasoning: string
  recommendations?: string[]
  urgency?: number
}

export interface EmergencyContext {
  userId?: string
  sessionId?: string
  riskLevel: string
  symptoms: string[]
  immediateNeeds: string[]
}

export interface EmergencyResponse {
  response: string
  actions: string[]
  resources: string[]
  escalationRequired: boolean
}

export interface TextGenerationOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
}

export interface EncryptedData {
  data: string
  originalType: string
  timestamp: string
  algorithm: string
}

/**
 * Production-grade Mental Arena Adapter for generating synthetic therapeutic conversations
 */

/**
 * Performance metrics tracker for MentalArena operations
 */
export class PerformanceMetrics {
  private generations: Array<{
    timestamp: number
    processingTime: number
    sessionCount: number
  }> = []

  recordGeneration(processingTime: number, sessionCount: number): void {
    this.generations.push({
      timestamp: Date.now(),
      processingTime,
      sessionCount,
    })

    // Keep only last 100 records
    if (this.generations.length > 100) {
      this.generations = this.generations.slice(-100)
    }
  }

  getAverageProcessingTime(): number {
    if (this.generations.length === 0) {
      return 0
    }
    const total = this.generations.reduce(
      (sum, gen) => sum + gen.processingTime,
      0,
    )
    return total / this.generations.length
  }

  getThroughput(): number {
    if (this.generations.length === 0) {
      return 0
    }
    const totalSessions = this.generations.reduce(
      (sum, gen) => sum + gen.sessionCount,
      0,
    )
    const totalTime = this.generations.reduce(
      (sum, gen) => sum + gen.processingTime,
      0,
    )
    return totalSessions / (totalTime / 1000) // sessions per second
  }

  getMetrics(): {
    averageProcessingTime: number
    throughput: number
    totalGenerations: number
  } {
    return {
      averageProcessingTime: this.getAverageProcessingTime(),
      throughput: this.getThroughput(),
      totalGenerations: this.generations.length,
    }
  }
}
