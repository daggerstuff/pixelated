#!/usr/bin/env node

/**
 * Consolidated Test Runner
 *
 * Runs HIPAA compliance, security, and crypto tests across Python and TypeScript
 *
 * Usage:
 *   node scripts/consolidated-test.js hipaa
 *   node scripts/consolidated-test.js security
 *   node scripts/consolidated-test.js crypto
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const testType = process.argv[2]

if (!testType) {
  console.error('Usage: node scripts/consolidated-test.js <hipaa|security|crypto>')
  process.exit(1)
}

const projectRoot = process.cwd()

/**
 * Run a command and exit if it fails
 */
function runCommand(command, description) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running: ${description}`)
  console.log(`Command: ${command}`)
  console.log(`${'='.repeat(60)}\n`)

  try {
    const output = execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })
    return output
  } catch (error) {
    console.error(`\n❌ ${description} failed`)
    process.exit(1)
  }
}

/**
 * Check if a file exists
 */
function fileExists(relativePath) {
  return existsSync(join(projectRoot, relativePath))
}

/**
 * Run HIPAA compliance tests
 */
function runHipaaTests() {
  console.log('\n🏥 HIPAA Compliance Test Suite')
  console.log('Verifying HIPAA++ compliance requirements...\n')

  const tests = []

  // Python HIPAA tests
  if (fileExists('tests/test_hipaa_compliance.py')) {
    tests.push(
      runCommand(
        '.venv/bin/python -m pytest tests/test_hipaa_compliance.py -v --tb=short',
        'Python HIPAA compliance tests'
      )
    )
  } else {
    console.log('⚠️  tests/test_hipaa_compliance.py not found - skipping Python HIPAA tests')
  }

  // TypeScript HIPAA tests
  if (fileExists('src/test/hipaa-compliance.test.ts')) {
    tests.push(
      runCommand(
        'NODE_ENV=test pnpm vitest run src/test/hipaa-compliance.test.ts --reporter=verbose',
        'TypeScript HIPAA compliance tests'
      )
    )
  } else {
    console.log('⚠️  src/test/hipaa-compliance.test.ts not found - skipping TypeScript HIPAA tests')
  }

  // Verify audit logging exists
  console.log('\n📋 Verifying audit logging infrastructure...')
  if (fileExists('src/lib/security/audit.logging.ts')) {
    console.log('✓ Audit logging module exists')
  } else {
    console.log('⚠️  Audit logging module not found')
  }

  // Verify encryption exists
  console.log('\n🔐 Verifying encryption infrastructure...')
  if (fileExists('src/lib/fhe/seal-service.ts')) {
    console.log('✓ FHE/SEAL encryption service exists')
  } else {
    console.log('⚠️  FHE/SEAL encryption service not found')
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ HIPAA compliance test suite completed')
  console.log('='.repeat(60) + '\n')
}

/**
 * Run security tests
 */
function runSecurityTests() {
  console.log('\n🛡️  Security Test Suite')
  console.log('Verifying security controls...\n')

  const tests = []

  // Python security scanning tests
  if (fileExists('tests/test_security_scanning.py')) {
    tests.push(
      runCommand(
        '.venv/bin/python -m pytest tests/test_security_scanning.py -v --tb=short',
        'Python security scanning tests'
      )
    )
  } else {
    console.log('⚠️  tests/test_security_scanning.py not found - skipping Python security tests')
  }

  // TypeScript security tests
  const tsSecurityTests = [
    'src/lib/security/__tests__/phiDetection.test.ts',
    'src/lib/security/__tests__/dlp.test.ts',
    'src/lib/security/__tests__/token.encryption.test.ts',
    'src/lib/security/__tests__/audit.logging.test.ts',
  ]

  const existingTests = tsSecurityTests.filter((f) => fileExists(f))

  if (existingTests.length > 0) {
    const testFiles = existingTests.join(' ')
    tests.push(
      runCommand(
        `NODE_ENV=test pnpm vitest run ${testFiles} --reporter=verbose`,
        'TypeScript security tests'
      )
    )
  } else {
    console.log('⚠️  No TypeScript security test files found')
  }

  // Run security scan script if exists
  if (fileExists('scripts/devops/security-scan.sh')) {
    tests.push(
      runCommand('bash scripts/devops/security-scan.sh', 'Security vulnerability scan')
    )
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Security test suite completed')
  console.log('='.repeat(60) + '\n')
}

/**
 * Run crypto tests
 */
function runCryptoTests() {
  console.log('\n🔐 Cryptography Test Suite')
  console.log('Verifying encryption implementations...\n')

  const tests = []

  // Python crypto tests (if any exist)
  const pythonCryptoTests = 'tests/python/test_crypto_standalone.py'
  if (fileExists(pythonCryptoTests)) {
    tests.push(
      runCommand(
        `.venv/bin/python -m pytest ${pythonCryptoTests} -v --tb=short`,
        'Python cryptography tests'
      )
    )
  }

  // TypeScript crypto/FHE tests
  const tsCryptoTests = [
    'src/lib/fhe/__tests__/key-rotation.test.ts',
    'src/lib/fhe/__tests__/parameter-optimizer.test.ts',
    'src/lib/fhe/__tests__/multi-tenant-isolation.test.ts',
    'src/lib/security/__tests__/token.encryption.test.ts',
  ]

  const existingTests = tsCryptoTests.filter((f) => fileExists(f))

  if (existingTests.length > 0) {
    const testFiles = existingTests.join(' ')
    tests.push(
      runCommand(
        `NODE_ENV=test pnpm vitest run ${testFiles} --reporter=verbose`,
        'TypeScript cryptography tests'
      )
    )
  } else {
    console.log('⚠️  No TypeScript crypto test files found')
  }

  // Test FHE service directly
  if (fileExists('src/lib/fhe/test-seal-integration.ts')) {
    console.log('\n🔬 Running SEAL integration test...')
    tests.push(
      runCommand(
        'NODE_ENV=test pnpm tsx src/lib/fhe/test-seal-integration.ts',
        'SEAL encryption integration test'
      )
    )
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Cryptography test suite completed')
  console.log('='.repeat(60) + '\n')
}

// Main execution
switch (testType) {
  case 'hipaa':
    runHipaaTests()
    break
  case 'security':
    runSecurityTests()
    break
  case 'crypto':
    runCryptoTests()
    break
  default:
    console.error(`Unknown test type: ${testType}`)
    console.error('Usage: node scripts/consolidated-test.js <hipaa|security|crypto>')
    process.exit(1)
}
