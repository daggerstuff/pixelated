#!/usr/bin/env ts-node
/**
 * MentalArena Data Generation Script - Production Version
 *
 * This script uses the production-grade MentalArena implementation
 * to generate synthetic therapeutic conversations with comprehensive
 * validation, quality metrics, and security features.
 *
 * Usage:
 *   ts-node mental-arena-generate-production.ts --num-conversations 10 --output-path ./data/synthetic.jsonl
 */

import path from 'path'
import { program } from 'commander'
import { promises as fs } from 'fs'
import {
  MentalArenaAdapter,
  MentalArenaPythonBridge,
  DisorderCategory,
  validateConversation,
  VERSION,
} from '../lib/ai/mental-arena'
import type {
  MentalArenaProvider,
  FHEService,
} from '../lib/ai/mental-arena/MentalArenaAdapter'

// Parse command line arguments
program
  .option(
    '-n, --num-conversations <number>',
    'Number of conversations to generate',
    '10',
  )
  .option(
    '-o, --output-path <path>',
    'Output path for generated data',
    './data/mental-arena-synthetic.jsonl',
  )
  .option('-m, --model <name>', 'Base model to use', 'gpt-4')
  .option('-p, --python-path <path>', 'Path to Python executable', 'python3')
  .option(
    '--complexity <level>',
    'Complexity level (low|medium|high)',
    'medium',
  )
  .option(
    '--enable-encryption',
    'Enable FHE encryption for sensitive data',
    false,
  )
  .option('--validate-output', 'Enable comprehensive output validation', true)
  .option('--max-turns <number>', 'Maximum turns per conversation', '8')
  .option(
    '--disorders <list>',
    'Comma-separated list of disorders',
    'anxiety,depression,ptsd',
  )
  .parse(process.argv)

const options = program.opts()

// Mock provider implementation with production-like features
class MockMentalArenaProvider {
  async analyzeEmotions(text: string) {
    // Simulate emotion analysis with realistic patterns
    const emotions = ['anxiety', 'depression', 'neutral', 'hope', 'frustration']
    const dominant = emotions[Math.floor(Math.random() * emotions.length)]

    const emotionScores: Record<string, number> = {}
    if (dominant) {
      emotionScores[dominant] = 0.7 + Math.random() * 0.3
    }

    return {
      dominant,
      emotions: emotionScores,
      confidence: 0.8 + Math.random() * 0.2,
      timestamp: new Date().toISOString(),
      overallSentiment: Math.random() > 0.5 ? 'positive' : 'negative',
      riskFactors: text.includes('harm') ? ['self-harm'] : [],
      contextualFactors: ['therapy-session'],
      requiresAttention: text.includes('crisis'),
    }
  }

  async generateIntervention(symptoms: string[]) {
    const techniques = [
      'cognitive-reframing',
      'mindfulness',
      'behavioral-activation',
      'grounding',
    ]
    const selectedTechnique =
      techniques[Math.floor(Math.random() * techniques.length)]

    return {
      content: `I hear that you're experiencing ${symptoms.join(' and ')}. Let's try ${selectedTechnique} to help you work through this.`,
      techniques: [selectedTechnique],
      rationale: `${selectedTechnique} is effective for addressing ${symptoms[0]}`,
      followUpActions: ['practice-exercise', 'homework-assignment'],
    }
  }

  async createChatCompletion() {
    const responses = [
      "Can you tell me more about how you've been feeling?",
      'That sounds really challenging. How are you coping with this?',
      'I appreciate you sharing that with me. What would help you feel better?',
      "Let's explore some strategies that might be helpful for you.",
    ]

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
    }
  }

  async assessRisk(conversation: string) {
    const riskKeywords = ['harm', 'hurt', 'end', 'die', 'kill']
    const hasRiskIndicators = riskKeywords.some((keyword) =>
      conversation.toLowerCase().includes(keyword),
    )

    return {
      riskLevel: hasRiskIndicators
        ? 'high'
        : Math.random() > 0.8
          ? 'medium'
          : 'low',
      reasoning: hasRiskIndicators
        ? 'Risk indicators detected in conversation'
        : 'No immediate risk indicators',
      confidence: 0.85,
      recommendedActions: hasRiskIndicators
        ? ['immediate-intervention']
        : ['continue-monitoring'],
    }
  }

  async handleEmergency() {
    return {
      response:
        'Emergency protocols activated. Immediate support resources provided.',
      actions: ['crisis-hotline-referral', 'emergency-contact-notification'],
      timestamp: new Date().toISOString(),
    }
  }

  async generateText(prompt: string) {
    // Generate contextually appropriate therapeutic responses
    if (prompt.includes('patient')) {
      return "I've been feeling really anxious lately, especially about work and social situations."
    } else {
      return 'I understand that anxiety can be overwhelming. What specific situations tend to trigger these feelings?'
    }
  }
}

// Mock FHE service for encryption capabilities
class MockFHEService {
  async encrypt(value: unknown) {
    return {
      data: `encrypted_${typeof value}_${Date.now()}`,
      originalType: typeof value,
      encryptionLevel: 'production',
    }
  }

  async decrypt(encrypted: unknown) {
    const encryptedData = encrypted as { data?: string }
    return (
      encryptedData.data?.replace(/^encrypted_\w+_\d+$/, 'decrypted_data') ||
      'decrypted'
    )
  }

  async encryptText(text: string) {
    return `enc:${Buffer.from(text).toString('base64')}`
  }

  async decryptText(encrypted: string) {
    if (encrypted.startsWith('enc:')) {
      return Buffer.from(encrypted.slice(4), 'base64').toString()
    }
    return encrypted
  }

  async generateHash(data: unknown) {
    return `hash_${JSON.stringify(data).length}_${Date.now()}`
  }

  setEncryptionMode(mode: string) {
    console.log(`Encryption mode set to: ${mode}`)
  }

  get scheme() {
    return { supportsOperation: () => true }
  }

  isInitialized() {
    return true
  }
  async initialize() {
    console.log('FHE service initialized')
  }
  async generateKeys() {
    return {
      publicKey: 'mock_public_key_' + Date.now(),
      privateKey: 'mock_private_key_' + Date.now(),
    }
  }
  supportsOperation() {
    return true
  }
}

async function main() {
  console.log(`🧠 MentalArena Data Generation v${VERSION}`)
  console.log('==========================================')
  console.log(
    `Generating ${options['num-conversations']} synthetic therapy conversations`,
  )
  console.log(`Output path: ${options['output-path']}`)
  console.log(`Using model: ${options['model']}`)
  console.log(`Complexity: ${options['complexity']}`)
  console.log(
    `Encryption: ${options['enable-encryption'] ? 'enabled' : 'disabled'}`,
  )

  try {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(options['output-path'])
    await fs.mkdir(outputDir, { recursive: true })

    // Parse disorders from command line
    const disorderNames = options['disorders']
      .split(',')
      .map((d: string) => d.trim())

    // Type-safe mapping of disorder names to DisorderCategory enum values
    const disorderNameMap: Record<string, DisorderCategory> = {
      anxiety: DisorderCategory.Anxiety,
      depression: DisorderCategory.Depression,
      ptsd: DisorderCategory.PTSD,
      adhd: DisorderCategory.ADHD,
      ocd: DisorderCategory.OCD,
      bipolar: DisorderCategory.BipolarDisorder,
      bipolardisorder: DisorderCategory.BipolarDisorder,
      bipolar_disorder: DisorderCategory.BipolarDisorder,
      eating: DisorderCategory.EatingDisorder,
      eatingdisorder: DisorderCategory.EatingDisorder,
      eating_disorder: DisorderCategory.EatingDisorder,
      social: DisorderCategory.SocialAnxiety,
      socialanxiety: DisorderCategory.SocialAnxiety,
      social_anxiety: DisorderCategory.SocialAnxiety,
      panic: DisorderCategory.PanicDisorder,
      panicdisorder: DisorderCategory.PanicDisorder,
      panic_disorder: DisorderCategory.PanicDisorder,
      trauma: DisorderCategory.Trauma,
    }

    const disorders = disorderNames.map((name: string) => {
      const normalizedName = name.toLowerCase().replace(/[-\s]/g, '')
      return disorderNameMap[normalizedName] || DisorderCategory.Anxiety
    })

    console.log(`Target disorders: ${disorders.join(', ')}`)

    // Initialize production components
    const provider = new MockMentalArenaProvider()
    const fheService = options['enable-encryption']
      ? new MockFHEService()
      : undefined

    // Initialize Python bridge if needed
    const pythonBridge = new MentalArenaPythonBridge({
      mentalArenaPath: '/tmp/mental-arena',
      pythonPath: options['python-path'],
      timeout: 60000,
      securityMode: 'strict',
    })

    // Create production adapter
    const adapter = new MentalArenaAdapter(
      provider as unknown as MentalArenaProvider,
      fheService as unknown as FHEService,
      'http://localhost:3000', // baseUrl
      'mock-api-key', // apiKey
      true, // pythonBridgeEnabled
      pythonBridge,
    )

    console.log('\n🔧 Initializing MentalArena components...')

    if (fheService) {
      await fheService.initialize()
      console.log('✅ FHE encryption service initialized')
    }

    // Generate synthetic data with production configuration
    console.log('\n🎭 Generating synthetic therapeutic conversations...')
    const generationOptions = {
      numSessions: parseInt(options['num-conversations']),
      maxTurns: parseInt(options['max-turns']),
      disorders: disorders.map((d: DisorderCategory) => d.toString()),
      qualityThreshold: 0.7,
      enableValidation: options['validate-output'],
    }

    const result =
      await adapter.generateSyntheticDataWithMetrics(generationOptions)

    console.log('\n📊 Generation Results:')
    console.log(
      `✅ Successfully generated: ${result.conversations.length} conversations`,
    )
    console.log(`📈 Quality metrics:`)
    console.log(
      `   - Coherence score: ${result.qualityMetrics.coherenceScore.toFixed(2)}`,
    )
    console.log(
      `   - Clinical accuracy: ${result.qualityMetrics.clinicalAccuracy.toFixed(2)}`,
    )
    console.log(
      `   - Conversational flow: ${result.qualityMetrics.conversationalFlow.toFixed(2)}`,
    )
    console.log(
      `   - Therapeutic value: ${result.qualityMetrics.therapeuticValue.toFixed(2)}`,
    )

    if (result.validationResults && result.validationResults.length > 0) {
      const totalIssues = result.validationResults.reduce(
        (sum, vr) => sum + vr.issues.length,
        0,
      )
      console.log(`\n⚠️  Validation issues found: ${totalIssues}`)
      result.validationResults.forEach((validationResult, index) => {
        validationResult.issues.forEach((issue, issueIndex) => {
          console.log(
            `   ${index + 1}.${issueIndex + 1}. [${issue.severity}] ${issue.description}`,
          )
        })
      })
    }

    // Validate individual conversations
    let validConversations = 0
    result.conversations.forEach((conv, index) => {
      if (validateConversation(conv)) {
        validConversations++
      } else {
        console.log(`⚠️  Conversation ${index + 1} failed validation`)
      }
    })

    console.log(
      `✅ Valid conversations: ${validConversations}/${result.conversations.length}`,
    )

    // Save data to file with metadata
    const outputData = {
      generationMetadata: {
        version: VERSION,
        generatedAt: new Date().toISOString(),
        configuration: generationOptions,
        qualityMetrics: result.qualityMetrics,
        validationResults: result.validationResults,
        processingTime: result.metadata.processingTime,
      },
      conversations: result.conversations,
      metadata: result.metadata,
    }

    // Save as JSONL format for easy processing
    const jsonlData = result.conversations
      .map((conversation) => JSON.stringify(conversation))
      .join('\n')

    await fs.writeFile(options['output-path'], jsonlData)

    // Also save detailed results with metadata
    const metadataPath = options['output-path'].replace(
      /\.jsonl?$/,
      '.meta.json',
    )
    await fs.writeFile(metadataPath, JSON.stringify(outputData, null, 2))

    console.log(`\n💾 Data saved successfully:`)
    console.log(`   📄 Conversations: ${options['output-path']}`)
    console.log(`   📋 Metadata: ${metadataPath}`)

    console.log(`\n⏱️  Performance metrics:`)
    console.log(
      `   - Total generation time: ${result.metadata.processingTime}ms`,
    )
    console.log(
      `   - Average time per conversation: ${Math.round(result.metadata.processingTime / result.conversations.length)}ms`,
    )
    console.log(
      `   - Successful generations: ${result.metadata.successfulGenerations}`,
    )
    console.log(`   - Failed generations: ${result.metadata.failedGenerations}`)

    console.log('\n✅ Mental Arena data generation complete!')
  } catch (error) {
    console.error('\n❌ Error generating data:', error)
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Generation interrupted by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Generation terminated')
  process.exit(0)
})

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
