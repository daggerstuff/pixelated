/**
 * Outlier AI Automation Runner
 * 
 * Main script to run the Outlier AI automation system
 */

import { OutlierOrchestrator } from './OutlierOrchestrator'
import type { OutlierConfig } from './types'

// Import config - create config.ts from config.example.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config: OutlierConfig = require('./config').config

async function main() {
  console.log('🚀 Starting Outlier AI Automation System')
  console.log('='.repeat(50))

  const orchestrator = new OutlierOrchestrator(config)

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...')
    await orchestrator.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
    await orchestrator.stop()
    process.exit(0)
  })

  try {
    // Start orchestrator
    await orchestrator.start()

    // Print stats periodically
    const _statsInterval = setInterval(() => {
      const stats = orchestrator.getStats()
      console.log('\n📊 Statistics:')
      console.log(`  Active tasks: ${stats.active}`)
      console.log(`  Completed: ${stats.completed}`)
      console.log(`  Successful: ${stats.successful}`)
      console.log(`  Submitted: ${stats.submitted}`)
      console.log(`  Total earnings: $${stats.totalEarnings.toFixed(2)}`)
    }, 60000) // Every minute

    // Keep running
    await new Promise(() => {
      // Run indefinitely
    })
  } catch (error) {
    console.error('❌ Fatal error:', error)
    await orchestrator.stop()
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})
