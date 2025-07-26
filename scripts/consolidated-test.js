#!/usr/bin/env node

/**
 * Consolidated Testing Utility
 *
 * This script combines functionality from multiple testing scripts:
 * - HIPAA compliance checks
 * - Backup testing
 * - Security and PHI detection
 * - Crypto validation
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Helper to run commands
function runCommand(command, label) {
  console.log(`
🔄 ${label}...`)
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot })
    return true
  } catch (error) {
    console.error(`❌ ${label} failed: ${error.message}`)
    return false
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const testType = args[0] || 'all'

async function main() {
  console.log('🚀 Running consolidated test utility...')

  switch (testType) {
    case 'hipaa':
      console.log('🔍 Running HIPAA compliance tests...')
      runCommand(
        'bash scripts/backup/test-hipaa-check.sh',
        'HIPAA compliance check',
      )
      break

    case 'backup':
      console.log('🔍 Running backup system tests...')
      runCommand('node scripts/test-backup-system.ts', 'Backup system test')
      break

    case 'crypto':
      console.log('🔍 Running cryptography tests...')
      runCommand('bash scripts/backup/test-crypto-check.sh', 'Crypto check')
      break

    case 'security':
      console.log('🔍 Running security scans...')
      runCommand(
        'node scripts/clean-credentials.js --check-only',
        'Credentials security check',
      )
      runCommand(
        'node scripts/verify-security-headers.js',
        'Security headers check',
      )
      break

    case 'all':
    default:
      console.log('🔍 Running all tests...')
      runCommand('node scripts/run-tests.sh', 'Standard tests')
      runCommand(
        'node scripts/clean-credentials.js --check-only',
        'Credentials security check',
      )
      runCommand(
        'node scripts/verify-security-headers.js',
        'Security headers check',
      )
  }

  console.log('✅ Testing completed!')
}

main().catch((error) => {
  console.error('❌ Error running tests:', error)
  process.exit(1)
})
