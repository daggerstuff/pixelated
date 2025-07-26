#!/usr/bin/env node

/**
 * Consolidated Ollama Overlord Check-in Utility
 * 
 * This is the SINGLE, UNIFIED method for checking in with the Ollama Overlord.
 * All other check-in scripts should be removed and references updated to use this.
 * 
 * Usage: node scripts/ollama-checkin.mjs "Task completion summary"
 * 
 * Features:
 * - Cross-platform compatibility (Windows, macOS, Linux)
 * - Robust error handling and logging
 * - Structured response parsing
 * - Task list integration
 * - Color-coded output
 * - Standardized exit codes
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const CONFIG = {
  API_URL: 'https://api.pixelatedempathy.com/api/generate',
  MODEL: 'granite3.3:2b',
  TASK_LIST_PATHS: [
    path.join(__dirname, '..', 'lint-fixes-task-list.md'),
    path.join(__dirname, '..', '.notes', 'tasks', 'current-task-list.md'),
    path.join(__dirname, '..', '.notes', 'tasks', 'tasks-proposed.md')
  ],
  TIMEOUT: 30000
}

// ANSI color codes for cross-platform terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// Utility functions
function colorize(text, color = 'reset') {
  return `${COLORS[color]}${text}${COLORS.reset}`
}

function log(emoji, message, color = 'reset') {
  console.log(`${emoji} ${colorize(message, color)}`)
}

function createPrompt(taskSummary) {
  return `You are an AI project oversight system with a balanced approach to code quality and development velocity.

Your job is to evaluate the completed task and provide constructive feedback for continuous improvement.

QUALITY EVALUATION APPROACH:
✅ APPROVE: Functional implementations that advance the project, even if they can be improved
✅ APPROVE: Work that resolves the main issue, with room for enhancement
✅ APPROVE: Progress that demonstrates concrete technical validation and scope
⚠️  CONCERN: Very vague summaries lacking technical details
❌ REJECT: Work with critical errors that prevent basic functionality
❌ REJECT: Fundamentally incomplete implementations that don't address the core issue

EVALUATION CRITERIA:
1. Functionality: Does the implementation work for its intended purpose?
2. Progress: Does this represent meaningful advancement toward project goals?
3. Quality Baseline: Are there showstopping issues that prevent basic operation?
4. Technical Validation: Is there evidence the work was properly tested/verified?

IMPROVEMENT GENERATION GUIDELINES:
Generate original, contextual suggestions based on the specific work completed:
- Consider the technical domain and suggest relevant best practices
- Think about the next logical steps for this type of implementation
- Identify potential architectural, performance, or maintainability enhancements
- Suggest complementary work like monitoring, documentation, or additional testing
- Consider security, accessibility, or operational concerns specific to this feature
- Recommend patterns or practices that would benefit this type of work

Response format:
IMPROVEMENTS:
- [Original, contextual improvement suggestion based on the work described]
- [Second practical enhancement if applicable]
- [Third suggestion focusing on different aspect if needed]

DECISION: [yes/no]

Task completed: ${taskSummary}

REMEMBER: Focus on functional progress and meaningful improvement suggestions. Balance quality standards with development momentum. Provide value-adding feedback rather than just gatekeeping.`
}

function makeApiCall(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: CONFIG.MODEL,
      prompt: prompt,
      stream: false,
    })

    const url = new URL(CONFIG.API_URL)
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: CONFIG.TIMEOUT
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData)
          if (!jsonResponse.response) {
            reject(new Error('No response content received from Ollama API'))
            return
          }
          resolve(jsonResponse)
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`))
    })

    req.write(data)
    req.end()
  })
}

function parseResponse(responseText) {
  const lines = responseText.split('\n')
  let improvements = []
  let decision = ''
  let originalDecision = ''
  let inImprovements = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.toUpperCase().startsWith('IMPROVEMENTS:')) {
      inImprovements = true
      continue
    }

    if (trimmedLine.toUpperCase().startsWith('DECISION:')) {
      originalDecision = trimmedLine.replace(/^DECISION:\s*/i, '').trim()
      decision = originalDecision
        .toLowerCase()
        .trim()
      // Handle various decision formats for internal processing
      if (decision.includes('approve') || decision.includes('✅')) {
        decision = 'yes'
      } else if (decision.includes('reject') || decision.includes('❌') || decision.includes('block')) {
        decision = 'no'
      }
      inImprovements = false
      continue
    }

    if (inImprovements && trimmedLine.startsWith('-')) {
      improvements.push(trimmedLine.substring(1).trim())
    }
  }

  return { improvements, decision, originalDecision }
}

function displayResults(improvements, decision) {
  console.log('\n' + '='.repeat(60))
  log('📋', 'Ollama Overlord Response:', 'bright')
  console.log('='.repeat(60))

  log('💡', 'Improvements Suggested:', 'yellow')
  if (improvements.length > 0) {
    improvements.forEach((improvement, index) => {
      console.log(`   ${index + 1}. ${improvement}`)
    })
  } else {
    console.log('   (None specified)')
  }

  console.log('')
  log(
    '⚖️ ',
    `Decision: ${decision.toUpperCase()}`,
    decision === 'yes' ? 'green' : decision === 'no' ? 'red' : 'yellow',
  )
  console.log('')
}

function handleDecision(decision, improvements) {
  switch (decision) {
    case 'yes':
    case 'y':
      log('✅', 'APPROVED: You may proceed to the next task', 'green')
      if (improvements.length > 0) {
        log('💡', 'Consider implementing the suggested improvements in future tasks', 'cyan')
      }
      return 0
    case 'no':
    case 'n':
      log('🛑', 'BLOCKED: Please address concerns before proceeding', 'red')
      log('   ', 'Consider the suggested improvements and revisit the implementation', 'red')
      if (improvements.length > 0) {
        log('📋', 'Recommended improvements:', 'yellow')
        improvements.forEach((improvement, index) => {
          log('   ', `${index + 1}. ${improvement}`, 'yellow')
        })
      }
      log('💡', 'Address the key concerns and check in again when ready', 'yellow')
      return 2
    default:
      log(
        '⚠️ ',
        `UNCLEAR: Decision was '${decision}' (expected yes/no)`,
        'yellow',
      )
      log('   ', 'Manual review required - please clarify decision criteria', 'yellow')
      return 3
  }
}

function getFileContext() {
  try {
    // Get current git status for recently modified files
    const gitStatus = execSync('git status --porcelain', { 
      encoding: 'utf8', 
      cwd: path.join(__dirname, '..'),
      timeout: 5000 
    }).trim()
    
    const changedFiles = []
    if (gitStatus) {
      const lines = gitStatus.split('\n')
      for (const line of lines.slice(0, 5)) { // Limit to first 8 files
        const status = line.substring(0, 2)
        const filename = line.substring(3)
        if (filename && !filename.includes('tasks-proposed.md')) { // Exclude the log file itself
          const statusSymbol = status.includes('M') ? '📝' : 
                              status.includes('A') ? '✨' : 
                              status.includes('D') ? '🗑️' : 
                              status.includes('R') ? '📋' : '📄'
          changedFiles.push(`${statusSymbol} ${filename}`)
        }
      }
    }
    
    return changedFiles
  } catch {
    // Fallback: try to get some context from current working directory
    try {
      const recentFiles = []
      const commonPaths = ['src/', 'scripts/', 'api/', 'docs/', '.github/']
      
      for (const pathPrefix of commonPaths) {
        const fullPath = path.join(__dirname, '..', pathPrefix)
        if (fs.existsSync(fullPath)) {
          recentFiles.push(`📁 ${pathPrefix}`)
        }
      }
      
      return recentFiles.slice(0, 3) // Return up to 3 directory indicators
    } catch {
      return ['📄 (context unavailable)']
    }
  }
}

function updateTaskLogs(taskSummary, improvements, decision, originalDecision) {
  const timestamp = new Date().toISOString()
  const fileContext = getFileContext()
  
  const fileContextSection = fileContext.length > 0 
    ? `\n**Files Context:**\n${fileContext.map(file => `- ${file}`).join('\n')}\n`
    : '\n**Files Context:** (no git changes detected)\n'
  
  // Use original decision format for better visual appeal
  const displayDecision = originalDecision || decision.toUpperCase()
  
  const logEntry = `\n## Check-in Log Entry - ${timestamp}\n\n**Task Completed:** ${taskSummary}${fileContextSection}\n**Improvements Suggested:**\n${improvements.map((imp) => `- ${imp}`).join('\n') || '(None)'}\n\n**Decision:** ${displayDecision}\n\n---\n`

  for (const taskListPath of CONFIG.TASK_LIST_PATHS) {
    if (fs.existsSync(taskListPath)) {
      try {
        fs.appendFileSync(taskListPath, logEntry)
        log('📝', `Updated task list: ${path.basename(taskListPath)}`, 'cyan')
      } catch (error) {
        log('⚠️ ', `Failed to update ${path.basename(taskListPath)}: ${error.message}`, 'yellow')
      }
    }
  }
}

function showUsage() {
  console.error(colorize('\nUsage:', 'bright'))
  console.error('  node scripts/ollama-checkin.mjs "Task completion summary"')
  console.error('\nExamples:')
  console.error('  node scripts/ollama-checkin.mjs "Fixed all TypeScript eslint errors in 5 components"')
  console.error('  node scripts/ollama-checkin.mjs "Implemented user authentication with JWT tokens"')
  console.error('  node scripts/ollama-checkin.mjs "Added unit tests with 90% coverage"')
  console.error('')
}

async function main() {
  const taskSummary = process.argv[2]

  if (!taskSummary) {
    showUsage()
    process.exit(1)
  }

  if (taskSummary.length < 10) {
    log('⚠️ ', 'Task summary seems too short. Please provide more detail.', 'yellow')
    showUsage()
    process.exit(1)
  }

  try {
    log('🤖', 'Checking in with Ollama Overlord...', 'cyan')
    log('📝', `Task Summary: ${taskSummary}`, 'blue')
    log('🌐', `API: ${CONFIG.API_URL}`, 'magenta')
    log('🔧', `Model: ${CONFIG.MODEL}`, 'magenta')

    const prompt = createPrompt(taskSummary)
    const response = await makeApiCall(prompt)

    const { improvements, decision, originalDecision } = parseResponse(response.response)

    displayResults(improvements, decision)
    updateTaskLogs(taskSummary, improvements, decision, originalDecision)

    const exitCode = handleDecision(decision, improvements)
    
    log('📊', `Exit code: ${exitCode}`, 'cyan')
    process.exit(exitCode)

  } catch (error) {
    log('❌', `Error: ${error.message}`, 'red')
    log('🔍', 'Check your network connection and API availability', 'yellow')
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('⚠️ ', 'Process interrupted by user', 'yellow')
  process.exit(130)
})

process.on('SIGTERM', () => {
  log('⚠️ ', 'Process terminated', 'yellow')
  process.exit(143)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { createPrompt, makeApiCall, parseResponse }
