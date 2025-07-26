#!/usr/bin/env node

import path from 'path'
import { exec } from 'child_process'
import readline from 'readline'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

// Convert exec to promise-based
const execPromise = promisify(exec)

// Get current file and directory path for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const SCRIPTS_DIR = path.join(__dirname)
const GENERATE_SCRIPT = path.join(SCRIPTS_DIR, 'generate_dialogues.js')
const BATCH_GENERATE_SCRIPT = path.join(
  SCRIPTS_DIR,
  'batch_generate_dialogues.js',
)
const VALIDATE_SCRIPT = path.join(SCRIPTS_DIR, 'validate_dialogues.js')
const OUTPUT_DIR = path.join(
  path.resolve(),
  'ai/data/processed/generated_dialogues',
)

// Check if the scripts exist
function checkScripts() {
  const missingScripts = []

  if (!fs.existsSync(GENERATE_SCRIPT)) {
    missingScripts.push('generate_dialogues.js')
  }

  if (!fs.existsSync(BATCH_GENERATE_SCRIPT)) {
    missingScripts.push('batch_generate_dialogues.js')
  }

  if (!fs.existsSync(VALIDATE_SCRIPT)) {
    missingScripts.push('validate_dialogues.js')
  }

  if (missingScripts.length > 0) {
    console.error('The following required scripts are missing:')
    missingScripts.forEach((script) => console.error(`- ${script}`))
    return false
  }

  return true
}

// Create a readline interface for user interaction
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

// Run a script and handle its output
async function runScript(scriptPath, args = []) {
  const command = `node ${scriptPath} ${args.join(' ')}`
  console.log(`Running: ${command}`)

  try {
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })

    if (stderr && stderr.trim() !== '') {
      console.error(`Error output: ${stderr}`)
    }

    console.log(stdout)
    return true
  } catch (error) {
    console.error(`Failed to run script: ${error.message}`)
    if (error.stdout) {
      console.log(error.stdout)
    }
    if (error.stderr) {
      console.error(error.stderr)
    }
    return false
  }
}

// Display main menu and get user choice
async function showMainMenu() {
  console.log('\nDialogue Generation Pipeline\n')
  console.log('1. Generate individual dialogue (interactive)')
  console.log('2. Batch generate dialogues')
  console.log('3. Validate generated dialogues')
  console.log('4. Run full pipeline (batch generate + validate)')
  console.log('5. Exit')

  const rl = createInterface()

  try {
    const answer = await new Promise((resolve) => {
      rl.question('\nSelect an option (1-5): ', resolve)
    })

    rl.close()
    return answer.trim()
  } catch (error) {
    console.error(`Error during menu selection: ${error.message}`)
    rl.close()
    return '5' // Default to exit on error
  }
}

// Get batch generation options from user
async function getBatchOptions() {
  const rl = createInterface()

  try {
    const concurrency = await new Promise((resolve) => {
      rl.question('Enter concurrency (1-4, default: 1): ', (answer) => {
        const value = parseInt(answer, 10)
        resolve(
          isNaN(value) || answer.trim() === ''
            ? 1
            : Math.min(Math.max(value, 1), 4),
        )
      })
    })

    const startFrom = await new Promise((resolve) => {
      rl.question('Start from prompt # (0-based, default: 0): ', (answer) => {
        const value = parseInt(answer, 10)
        resolve(isNaN(value) || answer.trim() === '' ? 0 : Math.max(value, 0))
      })
    })

    const maxPrompts = await new Promise((resolve) => {
      rl.question('Maximum prompts to process (default: all): ', (answer) => {
        if (!answer.trim()) {
          return resolve(Infinity)
        }
        const value = parseInt(answer, 10)
        return resolve(isNaN(value) ? Infinity : value)
      })
    })

    rl.close()

    return {
      concurrency,
      startFrom,
      maxPrompts,
    }
  } catch (error) {
    console.error(`Error getting batch options: ${error.message}`)
    rl.close()
    return {
      concurrency: 1,
      startFrom: 0,
      maxPrompts: Infinity,
    }
  }
}

// Handle individual dialogue generation
async function handleGenerateDialogue() {
  return runScript(GENERATE_SCRIPT)
}

// Handle batch dialogue generation
async function handleBatchGenerate() {
  const options = await getBatchOptions()

  // Pass options as command line arguments
  return runScript(BATCH_GENERATE_SCRIPT, [
    '--concurrency',
    options.concurrency,
    '--startFrom',
    options.startFrom,
    '--maxPrompts',
    options.maxPrompts,
  ])
}

// Handle dialogue validation
async function handleValidate() {
  return runScript(VALIDATE_SCRIPT)
}

// Handle full pipeline
async function handleFullPipeline() {
  console.log('\n=== Step 1: Batch Generate Dialogues ===\n')

  // Run batch generation with default options
  const batchSuccess = await runScript(BATCH_GENERATE_SCRIPT)

  if (batchSuccess) {
    console.log('\n=== Step 2: Validate Dialogues ===\n')
    return runScript(VALIDATE_SCRIPT)
  }

  return false
}

// Process a single menu choice
async function processMenuChoice(choice) {
  switch (choice) {
    case '1':
      // Generate individual dialogue (interactive)
      return handleGenerateDialogue()
    case '2':
      // Batch generate dialogues
      return handleBatchGenerate()
    case '3':
      // Validate generated dialogues
      return handleValidate()
    case '4':
      // Run full pipeline (batch generate + validate)
      return handleFullPipeline()
    case '5':
      // Exit
      console.log('Exiting...')
      return null
    default:
      console.log('Invalid option. Please try again.')
      return true
  }
}

// Main function to run the pipeline
async function main() {
  console.log('Edge Case Dialogue Pipeline')
  console.log('===========================\n')

  // Check if required scripts exist
  if (!checkScripts()) {
    console.error('Cannot continue due to missing scripts.')
    process.exit(1)
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`Created output directory: ${OUTPUT_DIR}`)
  }

  // Main menu loop - using recursion instead of a while loop to avoid await in loop
  async function runMenuLoop() {
    const choice = await showMainMenu()
    const result = await processMenuChoice(choice)

    // If result is null, exit the loop
    if (result !== null) {
      // Schedule the next iteration asynchronously
      return runMenuLoop()
    }
  }

  // Start the menu loop
  await runMenuLoop()
}

// Run the main function
main().catch((error) => {
  console.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
