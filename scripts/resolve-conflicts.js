#!/usr/bin/env node
/**
 * Merge conflict resolution helper
 * Helps resolve common conflict patterns automatically
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const conflictedFiles = execSync('git diff --name-only --diff-filter=U', {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

console.log(`Found ${conflictedFiles.length} conflicted files`)

// Strategy: For most conflicts, prefer master (newer) version
// But we'll handle critical files manually

const resolutionStrategies = {
  // For version conflicts in package.json, prefer newer (master)
  'package.json': (content) => {
    // Remove conflict markers and keep master (newer) version
    return content.replace(
      /<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> master/g,
      (match) => {
        const parts = match.split('=======')
        if (parts.length === 2) {
          // Keep the master version (after =======)
          const masterPart = parts[1].replace(/>>>>>>> master/, '').trim()
          return masterPart || match // Fallback if parsing fails
        }
        return match
      },
    )
  },
}

function resolveFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8')

    if (!content.includes('<<<<<<<')) {
      console.log(`✓ ${filepath} - no conflicts found`)
      return true
    }

    // Try automatic resolution
    if (resolutionStrategies[filepath]) {
      const resolved = resolutionStrategies[filepath](content)
      if (resolved !== content) {
        writeFileSync(filepath, resolved)
        console.log(`✓ ${filepath} - auto-resolved`)
        return true
      }
    }

    console.log(`⚠ ${filepath} - needs manual resolution`)
    return false
  } catch (error) {
    console.error(`✗ ${filepath} - error: ${error.message}`)
    return false
  }
}

// Process all files
let resolved = 0
let needsManual = 0

for (const file of conflictedFiles) {
  if (resolveFile(file)) {
    resolved++
  } else {
    needsManual++
  }
}

console.log(
  `\nSummary: ${resolved} auto-resolved, ${needsManual} need manual resolution`,
)
