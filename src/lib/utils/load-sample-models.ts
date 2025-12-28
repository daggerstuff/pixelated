/**
 * Utility for loading sample cognitive models into the KV store
 */

import { KVStore } from '../db/KVStore'
import { PatientModelService } from '../ai/services/PatientModelService'
import sampleCognitiveModels from '@/data/sample-cognitive-models'

/**
 * Load sample cognitive models into the KV store
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function loadSampleModels(): Promise<boolean> {
  try {
    console.log('Loading sample cognitive models into KV store...')

    // Create KV store and patient model service
    const kvStore = new KVStore('cognitive_models_', true)
    const patientService = new PatientModelService(kvStore)

    // Check if models are already loaded
    const existingModels = await patientService.getAvailableModels()

    if (existingModels && existingModels.length > 0) {
      console.log(
        `Found ${existingModels.length} existing models. Skipping load.`,
      )
      return true
    }

    // Load each sample model
    for (const model of sampleCognitiveModels) {
      console.log(`Loading model: ${model.name} (${model.id})`)
      await patientService.saveModel(model)
    }

    console.log(
      `Successfully loaded ${sampleCognitiveModels.length} sample cognitive models.`,
    )
    return true
  } catch (error: unknown) {
    console.error('Failed to load sample cognitive models:', error)
    return false
  }
}

/**
 * Reset the cognitive model store (remove all models)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function resetModelStore(): Promise<boolean> {
  try {
    console.log('Resetting cognitive model store...')

    // Create KV store and patient model service
    const kvStore = new KVStore('cognitive_models_', true)

    // Get all keys with the cognitive models prefix
    const keys = await kvStore.keys()

    // Delete each key
    for (const key of keys) {
      await kvStore.delete(key)
    }

    console.log('Successfully reset cognitive model store.')
    return true
  } catch (error: unknown) {
    console.error('Failed to reset cognitive model store:', error)
    return false
  }
}

/**
 * Check if sample models are loaded
 * @returns {Promise<boolean>} True if models are loaded, false otherwise
 */
export async function areSampleModelsLoaded(): Promise<boolean> {
  try {
    const kvStore = new KVStore('cognitive_models_', true)
    const patientService = new PatientModelService(kvStore)

    const existingModels = await patientService.getAvailableModels()
    return existingModels && existingModels.length > 0
  } catch (error: unknown) {
    console.error('Failed to check if sample models are loaded:', error)
    return false
  }
}
