#!/usr/bin/env ts-node

/**
 * Script to initialize cognitive models in the database
 * Can be run with: npm run initialize-models
 */

import { KVStore } from '../lib/db/KVStore'
import { PatientModelService } from '../lib/ai/services/PatientModelService'
import sampleCognitiveModels from '../data/sample-cognitive-models'

async function main() {
  console.log('===================================================')
  console.log('Initializing cognitive models in the database...')
  console.log('===================================================')

  try {
    // Create KV store instance
    const kvStore = new KVStore('cognitive_models_', false)
    const modelService = new PatientModelService(kvStore)

    // First check if models already exist
    const existingModels = await modelService.getAvailableModels()

    if (existingModels && existingModels.length > 0) {
      console.log(`Found ${existingModels.length} existing models:`)
      existingModels.forEach((model) => {
        console.log(
          `- ${model.name} (${model.id}): ${model.presentingIssues.join(', ')}`,
        )
      })

      const resetPrompt =
        process.argv.includes('--reset') || process.argv.includes('-r')

      if (!resetPrompt) {
        console.log(
          '\nModels already exist. Use --reset flag to reset the models.',
        )
        console.log('Example: npm run initialize-models -- --reset')
        return
      }

      console.log('\nResetting existing models...')

      // Delete each model
      for (const model of existingModels) {
        console.log(`Deleting model: ${model.name} (${model.id})`)
        await modelService.deleteModel(model.id)
      }

      console.log('All existing models have been deleted.')
    }

    // Save sample models
    console.log('\nSaving sample cognitive models...')

    for (const model of sampleCognitiveModels) {
      console.log(`Saving model: ${model.name} (${model.id})`)
      await modelService.saveModel(model)
    }

    console.log('\nSuccessfully initialized all cognitive models!')

    // Verify models were saved
    const models = await modelService.getAvailableModels()

    console.log(`\nVerified ${models.length} models in database:`)
    models.forEach((model) => {
      console.log(
        `- ${model.name} (${model.id}): ${model.presentingIssues.join(', ')}`,
      )
    })

    console.log('\nDone!')
  } catch (error) {
    console.error('Error initializing cognitive models:', error)
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
