#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current file and directory path for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const DIALOGUES_DIR = path.join(
  path.resolve(),
  'ai/data/processed/generated_dialogues',
)
const OUTPUT_REPORT = path.join(DIALOGUES_DIR, 'validation_report.md')
const MIN_TURNS = 20 // Minimum number of "Therapist:" and "Client:" exchanges

// Read all dialogue files in the directory
function readDialogueFiles() {
  if (!fs.existsSync(DIALOGUES_DIR)) {
    console.error(`Directory not found: ${DIALOGUES_DIR}`)
    return []
  }

  try {
    const files = fs
      .readdirSync(DIALOGUES_DIR)
      .filter((file) => file.endsWith('.txt') && file.startsWith('edge-'))

    console.log(`Found ${files.length} dialogue files.`)
    return files
  } catch (error) {
    console.error('Error reading dialogue directory:', error.message)
    return []
  }
}

// Extract prompt ID and scenario type from filename
function parseFilename(filename) {
  const parts = filename.replace('.txt', '').split('_')
  return {
    promptId: parts[0],
    scenarioType: parts.slice(1).join('_'),
  }
}

// Count the number of therapist and client turns
function countTurns(content) {
  const therapistMatches = content.match(/Therapist:/g) || []
  const clientMatches = content.match(/Client:/g) || []

  return {
    therapistTurns: therapistMatches.length,
    clientTurns: clientMatches.length,
    totalTurns: therapistMatches.length + clientMatches.length,
  }
}

// Check if the turns alternate properly (Therapist -> Client -> Therapist -> etc.)
function checkAlternating(content) {
  // Remove any content before the first "Therapist:" or "Client:"
  const startsWithTherapist =
    content.indexOf('Therapist:') < content.indexOf('Client:') ||
    content.indexOf('Client:') === -1
  const startsWithClient =
    content.indexOf('Client:') < content.indexOf('Therapist:') ||
    content.indexOf('Therapist:') === -1

  if (!startsWithTherapist && !startsWithClient) {
    return {
      alternates: false,
      message: 'Dialogue does not contain Therapist: or Client: markers',
    }
  }

  // Split the content by lines and identify turn boundaries
  const lines = content.split('\n')
  const turns = []
  let currentSpeaker = null
  let currentTurn = []

  for (const line of lines) {
    if (line.startsWith('Therapist:')) {
      if (currentSpeaker === 'Therapist') {
        // Found another Therapist turn without a Client turn in between
        return {
          alternates: false,
          message:
            'Found consecutive Therapist turns without Client turns in between',
        }
      }
      // Save previous turn if it exists
      if (currentSpeaker !== null) {
        turns.push({ speaker: currentSpeaker, content: currentTurn.join('\n') })
        currentTurn = []
      }
      currentSpeaker = 'Therapist'
      currentTurn.push(line)
    } else if (line.startsWith('Client:')) {
      if (currentSpeaker === 'Client') {
        // Found another Client turn without a Therapist turn in between
        return {
          alternates: false,
          message:
            'Found consecutive Client turns without Therapist turns in between',
        }
      }
      // Save previous turn if it exists
      if (currentSpeaker !== null) {
        turns.push({ speaker: currentSpeaker, content: currentTurn.join('\n') })
        currentTurn = []
      }
      currentSpeaker = 'Client'
      currentTurn.push(line)
    } else if (currentSpeaker !== null) {
      // Continue current turn
      currentTurn.push(line)
    }
  }

  // Add the last turn
  if (currentSpeaker !== null && currentTurn.length > 0) {
    turns.push({ speaker: currentSpeaker, content: currentTurn.join('\n') })
  }

  // Check if there's a reasonable number of turns
  if (turns.length < MIN_TURNS) {
    return {
      alternates: true,
      message: `Turn count is below minimum (${turns.length} < ${MIN_TURNS})`,
    }
  }

  return {
    alternates: true,
    message: `Dialogue alternates properly with ${turns.length} turns`,
  }
}

// Check for internal monologue, non-verbal cues, and physical symptoms of stress
function checkNarrativeElements(content) {
  // We'll look for common patterns that indicate these narrative elements

  // Internal monologue markers
  const internalMonologuePatterns = [
    /thought to (himself|herself|themselves)/i,
    /wondered if/i,
    /\(thinking\)/i,
    /in (his|her|their) mind/i,
    /reminded (himself|herself|themselves)/i,
    /internal voice/i,
    /thought:/i,
    /internal monologue/i,
    /silently questioned/i,
    /mentally noted/i,
  ]

  // Non-verbal cues
  const nonVerbalCuePatterns = [
    /nodded/i,
    /shook (his|her|their) head/i,
    /sighed/i,
    /shifted (uncomfortably|nervously)/i,
    /fidgeted/i,
    /clenched (his|her|their) (hands|fists|jaw)/i,
    /tense posture/i,
    /leaned (forward|back)/i,
    /crossed (his|her|their) arms/i,
    /avoiding eye contact/i,
    /glanced/i,
    /facial expression/i,
    /gesture/i,
  ]

  // Physical symptoms
  const physicalSymptomPatterns = [
    /heart (raced|pounding|racing)/i,
    /trembling hands/i,
    /sweat/i,
    /shallow breath/i,
    /palms (were )?sweaty/i,
    /pulse quickened/i,
    /adrenaline/i,
    /stomach (churned|knotted|twisted)/i,
    /tension in (his|her|their) (body|shoulders|muscles)/i,
    /felt sick/i,
    /nauseous/i,
  ]

  // Count occurrences
  const internalMonologue = internalMonologuePatterns.reduce(
    (count, pattern) => {
      return count + (content.match(pattern) || []).length
    },
    0,
  )

  const nonVerbalCues = nonVerbalCuePatterns.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length
  }, 0)

  const physicalSymptoms = physicalSymptomPatterns.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length
  }, 0)

  return {
    internalMonologue,
    nonVerbalCues,
    physicalSymptoms,
    hasRequiredElements:
      internalMonologue > 0 && nonVerbalCues > 0 && physicalSymptoms > 0,
  }
}

// Check for ethical dilemma mentions
function checkEthicalDilemmas(content) {
  const ethicalDilemmaPatterns = [
    /ethical dilemma/i,
    /ethics/i,
    /ethical (concern|issue|question|consideration)/i,
    /morally (right|wrong)/i,
    /conflicting (duties|obligations|responsibilities)/i,
    /professional (boundaries|standards|ethics)/i,
    /duty (of|to) (care|report|warn)/i,
    /confidentiality/i,
    /legally (obligated|required)/i,
    /code of ethics/i,
    /moral (quandary|question|dilemma)/i,
  ]

  const ethicalMentions = ethicalDilemmaPatterns.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length
  }, 0)

  return {
    ethicalMentions,
    hasEthicalDilemmas: ethicalMentions > 0,
  }
}

// Check the outcome and tone of the dialogue
function analyzeOutcome(content, scenarioType) {
  // Look for keywords that indicate a troubling outcome
  const troublingOutcomePatterns = [
    /tragic/i,
    /danger/i,
    /threat/i,
    /suicide/i,
    /harm/i,
    /violence/i,
    /crisis/i,
    /escalation/i,
    /hopeless/i,
    /fatal/i,
    /emergency/i,
    /irreparable/i,
    /damaged beyond repair/i,
    /failed/i,
    /disaster/i,
  ]

  // Count occurrences
  const troublingOutcomeCount = troublingOutcomePatterns.reduce(
    (count, pattern) => {
      return count + (content.match(pattern) || []).length
    },
    0,
  )

  // For scenarios that should always fail, ensure they actually do
  const shouldFail = scenarioType.includes('fail_no_matter_what=true')
  const lastFewLines = content.split('\n').slice(-15).join('\n').toLowerCase()

  // Check if the ending seems positive (contradicting the "should fail" requirement)
  const positiveResolutionPatterns = [
    /resolved/i,
    /breakthrough/i,
    /success/i,
    /improvement/i,
    /progress/i,
    /positive outcome/i,
    /better understanding/i,
    /agreed to continue/i,
    /hope/i,
    /healing/i,
  ]

  const positiveEnding =
    shouldFail &&
    positiveResolutionPatterns.some((pattern) => pattern.test(lastFewLines))

  return {
    troublingOutcomeCount,
    shouldFail,
    positiveEnding,
    appropriateOutcome: !shouldFail || (shouldFail && !positiveEnding),
  }
}

// Validate a single dialogue file
function validateDialogue(filename) {
  const filePath = path.join(DIALOGUES_DIR, filename)
  const { promptId, scenarioType } = parseFilename(filename)

  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Perform validation checks
    const turnCounts = countTurns(content)
    const alternatingCheck = checkAlternating(content)
    const narrativeElements = checkNarrativeElements(content)
    const ethicalDilemmas = checkEthicalDilemmas(content)
    const outcomeAnalysis = analyzeOutcome(content, scenarioType)

    // Determine overall validation status
    const enoughTurns = turnCounts.totalTurns >= MIN_TURNS
    const isValid =
      enoughTurns &&
      alternatingCheck.alternates &&
      narrativeElements.hasRequiredElements &&
      ethicalDilemmas.hasEthicalDilemmas &&
      outcomeAnalysis.appropriateOutcome

    return {
      promptId,
      scenarioType,
      isValid,
      turnCounts,
      alternatingCheck,
      narrativeElements,
      ethicalDilemmas,
      outcomeAnalysis,
      issues: isValid ? [] : [],
    }
  } catch (error) {
    console.error(`Error validating ${filename}:`, error.message)
    return {
      promptId,
      scenarioType,
      isValid: false,
      error: error.message,
      issues: [`Error: ${error.message}`],
    }
  }
}

// Generate a report of validation results
function generateReport(results) {
  const validCount = results.filter((r) => r.isValid).length
  const invalidCount = results.length - validCount

  let report = `# Dialogue Validation Report\n\n`
  report += `- Date: ${new Date().toISOString()}\n`
  report += `- Total dialogues: ${results.length}\n`
  report += `- Valid: ${validCount}\n`
  report += `- Invalid: ${invalidCount}\n\n`

  // Add summary table
  report += `## Summary\n\n`
  report += `| Prompt ID | Scenario Type | Valid | Therapist Turns | Client Turns | Issues |\n`
  report += `|-----------|---------------|-------|------------------|-------------|--------|\n`

  results.forEach((result) => {
    const issues =
      result.issues && result.issues.length > 0 ? result.issues.join(', ') : ''

    const therapistTurns = result.turnCounts
      ? result.turnCounts.therapistTurns
      : 'N/A'
    const clientTurns = result.turnCounts
      ? result.turnCounts.clientTurns
      : 'N/A'

    report += `| ${result.promptId} | ${result.scenarioType} | ${result.isValid ? '✅' : '❌'} | ${therapistTurns} | ${clientTurns} | ${issues} |\n`
  })

  // Add detailed section for invalid dialogues
  const invalidDialogues = results.filter((r) => !r.isValid)
  if (invalidDialogues.length > 0) {
    report += `\n## Invalid Dialogues (${invalidDialogues.length})\n\n`

    invalidDialogues.forEach((result) => {
      report += `### ${result.promptId} (${result.scenarioType})\n\n`

      if (result.error) {
        report += `- Error: ${result.error}\n`
      } else {
        if (result.turnCounts && result.turnCounts.totalTurns < MIN_TURNS) {
          report += `- Not enough turns: ${result.turnCounts.totalTurns} (minimum required: ${MIN_TURNS})\n`
        }

        if (result.alternatingCheck && !result.alternatingCheck.alternates) {
          report += `- Turns don't alternate properly: ${result.alternatingCheck.message}\n`
        }

        if (
          result.narrativeElements &&
          !result.narrativeElements.hasRequiredElements
        ) {
          report += `- Missing narrative elements:\n`
          report += `  - Internal monologue mentions: ${result.narrativeElements.internalMonologue}\n`
          report += `  - Non-verbal cue mentions: ${result.narrativeElements.nonVerbalCues}\n`
          report += `  - Physical symptom mentions: ${result.narrativeElements.physicalSymptoms}\n`
        }

        if (
          result.ethicalDilemmas &&
          !result.ethicalDilemmas.hasEthicalDilemmas
        ) {
          report += `- No ethical dilemma mentions found\n`
        }

        if (
          result.outcomeAnalysis &&
          !result.outcomeAnalysis.appropriateOutcome
        ) {
          report += `- Inappropriate outcome: This scenario should fail but has a positive ending\n`
        }
      }

      report += '\n'
    })
  }

  return report
}

// Save the report to a file
function saveReport(report) {
  try {
    fs.writeFileSync(OUTPUT_REPORT, report)
    console.log(`Saved validation report to ${OUTPUT_REPORT}`)
    return true
  } catch (error) {
    console.error('Error saving validation report:', error.message)
    return false
  }
}

// Main function
async function main() {
  console.log('Dialogue Validation Tool')
  console.log('=======================\n')

  // Read all dialogue files
  const files = readDialogueFiles()
  if (files.length === 0) {
    console.error('No dialogue files found to validate.')
    process.exit(1)
  }

  console.log(`Validating ${files.length} dialogue files...\n`)

  // Validate each file
  const results = []
  for (let i = 0; i < files.length; i++) {
    console.log(`[${i + 1}/${files.length}] Validating ${files[i]}...`)
    const result = validateDialogue(files[i])
    results.push(result)

    // Print live validation status
    if (result.isValid) {
      console.log(`  ✅ Valid`)
    } else {
      console.log(`  ❌ Invalid: ${result.error || 'Failed validation checks'}`)
    }
  }

  // Generate and save the report
  const report = generateReport(results)
  saveReport(report)

  // Print summary
  const validCount = results.filter((r) => r.isValid).length
  console.log('\nValidation complete!')
  console.log(`Valid: ${validCount}/${results.length}`)
  console.log(`Invalid: ${results.length - validCount}/${results.length}`)
  console.log(`Check ${OUTPUT_REPORT} for the full validation report.`)
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
