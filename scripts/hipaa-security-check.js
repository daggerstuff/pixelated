#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import * as globModule from 'glob'

const glob = globModule.glob || globModule.default || globModule
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔒 Running HIPAA Security Compliance Check...')

// Files to exclude from processing
const excludePatterns = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  'test-results/**',
  'coverage/**',
  '**/hipaa-security-check.js', // Exclude this script itself - fixed to match any path
  '**/security-check/**', // Exclude any security check scripts
  '**/scripts/backup/**', // Exclude backup scripts
  '**/polyfills/**', // Exclude polyfills
  '**/*.test.ts', // Exclude test files
  '**/__tests__/**', // Exclude test directories
  '**/test/**', // Exclude test directories
  '**/mock/**', // Exclude mock data
  '**/test-utils/**', // Exclude test utilities
]

// Security checks to perform
const securityChecks = [
  {
    name: 'Deprecated Crypto Methods',
    description: 'Check for deprecated/insecure crypto methods',
    pattern:
      /(?<!\/)(?<!\/)(?<!pattern:.*)\bcreate(?:Cipher|Decipher)\b(?!iv)/i,
    filePattern: /\.(ts|js|py)$/,
    severity: 'ERROR',
    message: 'Deprecated/insecure crypto methods found',
  },
  {
    name: 'GCM Mode Encryption',
    description:
      'Ensure secure encryption algorithm (AES-256-GCM) with authentication',
    pattern: /createCipheriv|createDecipheriv/i,
    requiredPattern: /aes-256-gcm|scrypt|pbkdf2/i,
    filePattern: /\.(ts|js|py)$/,
    severity: 'WARNING',
    message:
      'Encryption implementation may not be secure. Ensure using AES-256-GCM with proper key derivation',
  },
  {
    name: 'Authentication Tag',
    description: 'Ensure authentication tag is used with GCM mode',
    pattern: /createCipheriv|createDecipheriv/i,
    requiredPattern: /authTag|getAuthTag/i,
    filePattern: /\.(ts|js|py)$/,
    severity: 'WARNING',
    message: 'Authentication tag not found in encryption implementation',
  },
  {
    name: 'Route Authentication',
    description: 'Ensure all routes have authentication checks',
    pattern: /router\.(get|post|put|delete)/i,
    requiredPattern: /authenticate|authorize|checkPermission/i,
    filePattern: /\.(ts|js|py)$/,
    severity: 'ERROR',
    message: 'Route without authentication checks',
  },
  {
    name: 'PHI Audit Logging',
    description: 'Ensure PHI handling includes audit logging',
    pattern: /patient|phi|medical/i,
    requiredPattern: /audit|log\.info|logger/i,
    filePattern: /\.(ts|js|py)$/,
    // Skip PHI logging checks for test files, mocks, and types
    skipPatterns: [
      /\.test\.[jt]sx?$/,
      /__tests__\//,
      /\/test\//,
      /\/mock\//,
      /\/polyfills\//,
      /\/types?\//,
      /\.d\.ts$/,
      /\/scenarios\.ts$/,
      /\/scripts\//,
    ],
    severity: 'ERROR',
    message: 'PHI handling without audit logging',
  },
]

// Function to check a file for security issues
async function checkFile(filePath) {
  try {
    // This script should already be excluded by the excludePatterns
    // but as a double-check, skip checking this script itself
    const absoluteFilePathToCheck = path.resolve(filePath)
    if (absoluteFilePathToCheck === __filename) {
      return []
    }

    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8')
    const lines = content.split('\n')
    const issues = []

    // Check each security rule
    for (const check of securityChecks) {
      // Skip files that don't match the file pattern
      if (!filePath.match(check.filePattern)) {
        continue
      }

      // If the check has skipPatterns, check if the file should be skipped
      if (check.skipPatterns?.some((pattern) => pattern.test(filePath))) {
        continue
      }

      // Check if the file contains the pattern
      if (check.pattern.test(content)) {
        // Find line number for better reporting
        let lineNumber = 1
        for (let i = 0; i < lines.length; i++) {
          if (check.pattern.test(lines[i])) {
            lineNumber = i + 1
            break
          }
        }

        // If there's a required pattern, check if it's missing
        if (check.requiredPattern && !check.requiredPattern.test(content)) {
          issues.push({
            file: filePath,
            line: lineNumber,
            check: check.name,
            severity: check.severity,
            message: check.message,
            description: check.description,
          })
        }
        // If there's no required pattern, report the issue
        else if (!check.requiredPattern) {
          issues.push({
            file: filePath,
            line: lineNumber,
            check: check.name,
            severity: check.severity,
            message: check.message,
            description: check.description,
          })
        }
      }
    }

    return issues
  } catch (error) {
    console.error(`❌ Error checking ${filePath}: ${error.message}`)
    return []
  }
}

// Main function
async function main() {
  try {
    // Get files to process
    const files = glob.sync('**/*.{js,ts,tsx,jsx,py}', {
      ignore: excludePatterns,
    })

    console.log(`Found ${files.length} files to check`)

    let allIssues = []
    let fileCount = 0
    let fileWithIssuesCount = 0

    // Process each file
    for (const file of files) {
      fileCount++
      if (fileCount % 100 === 0) {
        console.log(`Checked ${fileCount} files...`)
      }

      const issues = await checkFile(file)
      if (issues.length > 0) {
        allIssues.push(...issues)
        fileWithIssuesCount++
      }
    }

    // Report findings
    console.log('\n🔍 HIPAA Security Check Results:')
    console.log(`Checked ${fileCount} files`)

    if (allIssues.length > 0) {
      console.log(
        `Found ${allIssues.length} issues in ${fileWithIssuesCount} files`,
      )

      // Group issues by severity
      const errorIssues = allIssues.filter(
        (issue) => issue.severity === 'ERROR',
      )
      const warningIssues = allIssues.filter(
        (issue) => issue.severity === 'WARNING',
      )

      if (errorIssues.length > 0) {
        console.log(`\n❌ ERRORS (${errorIssues.length}):`)
        errorIssues.forEach((issue) => {
          console.log(`  - ${issue.file}: ${issue.check} - ${issue.message}`)
        })
      }

      if (warningIssues.length > 0) {
        console.log(`\n⚠️ WARNINGS (${warningIssues.length}):`)
        warningIssues.forEach((issue) => {
          console.log(`  - ${issue.file}: ${issue.check} - ${issue.message}`)
        })
      }

      // Generate report
      const report = {
        scanDate: new Date().toISOString(),
        totalFiles: fileCount,
        filesWithIssues: fileWithIssuesCount,
        totalIssues: allIssues.length,
        errorCount: errorIssues.length,
        warningCount: warningIssues.length,
        issues: allIssues,
      }

      await fs.promises.writeFile(
        'hipaa-security-report.json',
        JSON.stringify(report, null, 2),
        'utf8',
      )
      console.log('\n📊 Detailed report written to hipaa-security-report.json')

      process.exit(errorIssues.length > 0 ? 1 : 0) // Exit with error if there are ERROR severity issues
    } else {
      console.log('✅ No HIPAA security issues found!')
    }
  } catch (error) {
    console.error(`Error running security check: ${error.message}`)
    process.exit(1)
  }
}

main()
