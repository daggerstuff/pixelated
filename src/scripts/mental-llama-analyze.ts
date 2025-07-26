#!/usr/bin/env ts-node
/**
 * MentalLLaMA Analysis Demo
 *
 * This script demonstrates how to use the MentalLLaMA integration
 * to analyze text for mental health indicators and provide
 * interpretable explanations.
 *
 * Usage:
 *   ts-node mental-llama-analyze.ts --text "Sample text to analyze" --output-path ./results.json
 */

import { program } from 'commander'
import { promises as fs } from 'fs'
import path from 'path'
import { createMentalLLaMAFromEnv } from '../lib/ai/mental-llama'

// Define types for CLI options
interface CliOptions {
  text?: string
  file?: string
  crisisText?: boolean
  generalText?: boolean
  outputPath: string
  evaluateExplanation?: boolean
  pythonBridge?: boolean
  expert?: boolean
  imhi?: boolean
  modelPath?: string
  listCategories?: boolean
  modelTier?: string
}

// Parse command line arguments
program
  .option('-t, --text <text>', 'Text to analyze for mental health indicators')
  .option('-f, --file <path>', 'File containing text to analyze')
  .option(
    '--crisis-text',
    'Use a predefined text sample likely to trigger crisis keyword detection for testing.',
  )
  .option(
    '--general-text',
    'Use a predefined text sample for general mental health assessment testing.',
  )
  .option(
    '-o, --output-path <path>',
    'Output path for results',
    './mental-llama-results.json',
  )
  .option(
    '-e, --evaluate-explanation',
    'Evaluate the quality of the generated explanation',
    false,
  )
  .option(
    '-p, --python-bridge',
    'Use Python bridge for advanced features',
    false,
  )
  .option('--expert', 'Use expert-guided explanations', false)
  .option(
    '--imhi',
    'Run IMHI benchmark evaluation (requires Python bridge)',
    false,
  )
  .option('--model-path <path>', 'Path to model for IMHI evaluation')
  .option(
    '--list-categories',
    'List all supported mental health categories',
    false,
  )
  .parse(process.argv)

const options = program.opts() as CliOptions

async function main() {
  console.log('🧠 MentalLLaMA Analysis')
  console.log('=======================')

  // Create MentalLLaMA adapter for listing categories
  if (options.listCategories) {
    console.log('Supported mental health categories:')
    console.log('- depression: Major depressive disorder')
    console.log('- anxiety: Generalized anxiety disorder')
    console.log('- ptsd: Post-traumatic stress disorder')
    console.log('- suicidality: Suicide risk')
    console.log('- bipolar_disorder: Bipolar disorder')
    console.log('- ocd: Obsessive-compulsive disorder')
    console.log('- eating_disorder: Various eating disorders')
    console.log('- social_anxiety: Social anxiety disorder')
    console.log('- panic_disorder: Panic disorder')
    process.exit(0)
  }

  // Validate arguments
  if (
    !options.text &&
    !options.file &&
    !options.crisisText &&
    !options.generalText
  ) {
    console.error(
      '❌ Error: Either --text, --file, --crisis-text, or --general-text must be provided',
    )
    process.exit(1)
  }

  try {
    // Create MentalLLaMA adapter
    console.log('Creating MentalLLaMA adapter components via factory...')
    // Explicitly get all returned components from the factory for potential use/logging
    const factoryOutput = await createMentalLLaMAFromEnv()

    // Only use adapter; modelProvider is not used
    const { adapter } = factoryOutput

    if (!adapter) {
      console.error(
        '❌ Error: Failed to create MentalLLaMA adapter from factory.',
      )
      process.exit(1)
    }
    console.log(`Adapter created.`)

    // Get text to analyze
    let textToAnalyze: string
    let testType = 'custom'

    if (options.crisisText) {
      textToAnalyze =
        "I feel so hopeless and I just want to kill myself sometimes. It feels like there's no reason to live."
      testType = 'crisis_keyword'
      console.log(
        `Using predefined crisis text for testing: "${textToAnalyze}"`,
      )
    } else if (options.generalText) {
      textToAnalyze =
        "I've been feeling pretty good lately, just a bit tired from work, but overall I'm managing things okay. My sleep has been alright."
      testType = 'general_assessment'
      console.log(
        `Using predefined general text for testing: "${textToAnalyze}"`,
      )
    } else if (options.text) {
      textToAnalyze = options.text
      testType = 'cli_text'
    } else if (options.file) {
      console.log(`Reading text from ${options.file}...`)
      textToAnalyze = await fs.readFile(options.file, 'utf-8')
      testType = 'file_text'
    } else {
      // Should be caught by validation above, but as a safeguard:
      console.error('Error: No text source specified.')
      process.exit(1)
    }

    const routingContextParams = {
      userId: 'cli-test-user-001',
      sessionId: `cli-session-${Date.now()}`,
      sessionType: `test_session_${testType}`,
      ...(options.expert && { explicitTaskHint: 'expert_analysis_request' }),
    }

    console.log('\nUsing Routing Context Parameters:', routingContextParams)

    // Check if we're running IMHI benchmark
    if (options.imhi) {
      console.error('❌ Error: Python bridge is not available in this build')
      process.exit(1)
    }

    // Analyze text
    console.log('Analyzing text for mental health indicators...')

    let analysisResult
    if (options.expert) {
      console.log('Using expert-guided explanations...')
      analysisResult =
        await adapter.analyzeMentalHealthWithExpertGuidance(textToAnalyze)
    } else {
      // Only include modelTier if defined to satisfy exactOptionalPropertyTypes
      const analysisOptions: {
        modelTier?: string
        useExpertGuidance?: boolean
      } = {}
      if (options.modelTier !== undefined) {
        analysisOptions.modelTier = options.modelTier
      }
      analysisOptions.useExpertGuidance = !!options.expert
      analysisResult = await adapter.analyzeMentalHealth({
        text: textToAnalyze,
        routingContext: routingContextParams,
        options: analysisOptions,
      })
    }

    console.log('\n--- Full Analysis Result ---')
    console.log(JSON.stringify(analysisResult, null, 2))
    console.log('--- End Full Analysis Result ---')

    // Simplified console output after full JSON
    console.log('\nSummary:')
    console.log(
      `Mental Health Issue Detected: ${analysisResult.hasMentalHealthIssue ? 'Yes' : 'No'}`,
    )
    console.log(
      `Category: ${analysisResult.mentalHealthCategory.replace('_', ' ')}`,
    )
    console.log(`Confidence: ${(analysisResult.confidence * 100).toFixed(2)}%`)
    // Remove isCrisis (not present on result)

    if (analysisResult._routingDecision) {
      console.log(`Routing Method: ${analysisResult._routingDecision.method}`)
      console.log(
        `Routing Target: ${analysisResult._routingDecision.targetAnalyzer}`,
      )
      if (analysisResult._routingDecision.insights) {
        console.log(
          `Routing Insights: ${JSON.stringify(analysisResult._routingDecision.insights)}`,
        )
      }
    }

    if (
      options.expert &&
      analysisResult._routingDecision?.insights?.['expertGuidanceApplied']
    ) {
      // Check the modified field
      console.log(`Explanation Type: Expert-guided (STUB)`)
    }
    console.log(`\nExplanation: ${analysisResult.explanation}`)

    // Enhanced supporting evidence display - now fully implemented with production-grade extraction
    if (
      analysisResult.supportingEvidence &&
      analysisResult.supportingEvidence.length > 0
    ) {
      console.log('\n--- Supporting Evidence ---')
      console.log(
        'Enhanced evidence extraction system identified the following supporting indicators:',
      )
      analysisResult.supportingEvidence.forEach((evidence, i) => {
        console.log(`${i + 1}. "${evidence}"`)
      })
    } else {
      console.log(
        '\nSupporting Evidence: None identified by the enhanced evidence extraction system',
      )
      console.log(
        'This could indicate insufficient detail in the input text or no clear indicators present.',
      )
    }

    // Detailed evidence extraction not available in this build

    // Evaluate explanation quality if requested
    let qualityMetricsResults = null
    if (options.evaluateExplanation) {
      console.log('\nEvaluating explanation quality (STUBBED)...')
      qualityMetricsResults = await adapter.evaluateExplanationQuality(
        analysisResult.explanation,
      )

      console.log('\nQuality Metrics (STUBBED):')
      console.log(JSON.stringify(qualityMetricsResults, null, 2))

      // Add quality metrics to result object that will be saved
      ;(
        analysisResult as unknown as {
          qualityMetrics?: typeof qualityMetricsResults
        }
      ).qualityMetrics = qualityMetricsResults
    }

    // Save results
    console.log(`\nSaving results to ${options.outputPath}...`)
    const outputDir = path.dirname(options.outputPath)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(
      options.outputPath,
      JSON.stringify(analysisResult, null, 2),
    )

    console.log('✅ Analysis complete!')
  } catch (error) {
    console.error('❌ Error analyzing text:', error)
    process.exit(1)
  }
}

main()
