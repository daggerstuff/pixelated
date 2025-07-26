#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as globModule from 'glob'

const glob = globModule.glob || globModule.default || globModule
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔍 Scanning files to add audit logging for PHI...')

// Files to exclude
const excludePatterns = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  'test-results/**',
  'coverage/**',
  'scripts/hipaa-security-check.js',
  '**/polyfills/**',
  '**/*.test.ts',
  '**/__tests__/**',
  '**/test/**',
  '**/mock/**',
  '**/test-utils/**',
]

// Logger import templates based on file extension
const loggerImports = {
  '.ts':
    "import { logger as getLogger } from '../../lib/utils/logger';\n\nconst logger = getLogger({ prefix: 'phi-audit' });",
  '.js':
    "import { logger as getLogger } from '../../lib/utils/logger';\n\nconst logger = getLogger({ prefix: 'phi-audit' });",
  '.tsx':
    "import { logger as getLogger } from '../../lib/utils/logger';\n\nconst logger = getLogger({ prefix: 'phi-audit' });",
}

// Pattern to detect PHI-related content
const phiPattern = /patient|phi|medical/i

// Pattern to detect logger
const loggerPattern = /audit|log\.info|logger/i

// Function to add logger to a file
async function addLoggerToFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')

    // Skip if already has logging
    if (loggerPattern.test(content)) {
      console.log(`✅ File already has logging: ${filePath}`)
      return false
    }

    // Skip if no PHI-related content
    if (!phiPattern.test(content)) {
      console.log(`⏭️ File has no PHI references: ${filePath}`)
      return false
    }

    const ext = path.extname(filePath)
    const loggerImport = loggerImports[ext] || loggerImports['.ts'] // Default to TS if extension not found

    let updatedContent

    // Check if there are existing imports
    if (content.includes('import ')) {
      // Add logger import after last import statement
      const lastImportIndex = content.lastIndexOf('import ')
      const endOfImportsIndex = content.indexOf(';', lastImportIndex) + 1

      updatedContent =
        content.substring(0, endOfImportsIndex) +
        '\n\n' +
        loggerImport.split('\n\n')[1] + // Just add the const logger line, not the import
        '\n\n' +
        content.substring(endOfImportsIndex)

      // Add import at the top
      updatedContent =
        "import { logger as getLogger } from '../../lib/utils/logger';\n" +
        updatedContent
    } else {
      // No imports - add logging import at the top
      updatedContent = loggerImport + '\n\n' + content
    }

    // Add logger example comment
    updatedContent += `\n\n// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });`

    // Write updated content back to file
    await fs.promises.writeFile(filePath, updatedContent, 'utf8')
    console.log(`✅ Added logger to file: ${filePath}`)
    return true
  } catch (error) {
    console.error(`❌ Error updating ${filePath}: ${error.message}`)
    return false
  }
}

// Main function
async function main() {
  try {
    // Get files to process, excluding patterns
    const files = glob.sync('**/*.{js,ts,tsx,jsx}', {
      ignore: excludePatterns,
    })

    console.log(`Found ${files.length} files to check`)

    let updatedCount = 0

    // Process each file
    for (const file of files) {
      if (await addLoggerToFile(file)) {
        updatedCount++
      }
    }

    console.log(`\n🎉 Added logging to ${updatedCount} files`)
    console.log(
      'Remember to review the added logging and uncomment/customize the example log statements!',
    )
  } catch (error) {
    console.error(`Error running script: ${error.message}`)
    process.exit(1)
  }
}

main()
