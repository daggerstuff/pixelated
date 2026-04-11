/**
 * Patient Model Service for managing cognitive models
 */

import type { KVStore } from '../../db/KVStore'
import type { CognitiveModel } from '../types/CognitiveModel'

export type ModelIdentifier = string

export class PatientModelService {
  constructor(private kvStore: KVStore) {}

  /**
   * Get all available cognitive models
   */
  async getAvailableModels(): Promise<CognitiveModel[]> {
    try {
      const keys = await this.kvStore.keys()
      const models: CognitiveModel[] = []

      for (const key of keys) {
        const model = await this.kvStore.get<CognitiveModel>(key)
        if (model) {
          models.push(model)
        }
      }

      return models
    } catch (error: unknown) {
      console.error('Failed to get available models:', error)
      return []
    }
  }

  /**
   * Save a cognitive model
   */
  async saveModel(model: CognitiveModel): Promise<void> {
    try {
      await this.kvStore.set(model.id, model)
    } catch (error: unknown) {
      console.error('Failed to save model:', error)
      throw error
    }
  }

  /**
   * Get a specific model by ID
   */
  async getModel(id: string): Promise<CognitiveModel | null> {
    try {
      return await this.kvStore.get<CognitiveModel>(id)
    } catch (error: unknown) {
      console.error('Failed to get model:', error)
      return null
    }
  }

  /**
   * Delete a model by ID
   */
  async deleteModel(id: string): Promise<void> {
    try {
      await this.kvStore.delete(id)
    } catch (error: unknown) {
      console.error('Failed to delete model:', error)
      throw error
    }
  }

  /**
   * Create response context for patient simulation
   */
  async createResponseContext(
    modelId: string,
    conversationHistory: Array<{ role: 'therapist' | 'patient'; content: string }>,
    styleConfig: Record<string, unknown>,
    therapeuticFocus?: string[],
    sessionNumber?: number,
  ): Promise<{
    modelId: string
    conversationHistory: Array<{ role: 'therapist' | 'patient'; content: string }>
    styleConfig: Record<string, unknown>
    therapeuticFocus?: string[]
    sessionNumber: number
  } | null> {
    const model = await this.getModel(modelId)
    if (!model) return null

    return {
      modelId,
      conversationHistory,
      styleConfig,
      therapeuticFocus,
      sessionNumber: sessionNumber ?? 1,
    }
  }

  /**
   * Generate patient prompt from context
   */
  generatePatientPrompt(context: {
    modelId: string
    conversationHistory: Array<{ role: 'therapist' | 'patient'; content: string }>
    styleConfig: Record<string, unknown>
    therapeuticFocus?: string[]
    sessionNumber: number
  }): string {
    const historyText = context.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    return `You are simulating a patient in a therapy session.
Session: ${context.sessionNumber}
${context.therapeuticFocus ? `Focus areas: ${context.therapeuticFocus.join(', ')}` : ''}

Conversation history:
${historyText}

Respond as the patient would, staying in character and showing appropriate emotional responses.`
  }
}
