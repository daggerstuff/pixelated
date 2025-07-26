#!/usr/bin/env node

/**
 * TypeScript Configuration Validation Script
 *
 * This script validates that the enhanced TypeScript configurations
 * are properly set up and working with strict typing enabled.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

// ============================================================================
// TYPES
// ============================================================================

interface TSConfig {
  compilerOptions?: Record<string, any>
  include?: string[]
  exclude?: string[]
  extends?: string
}

interface ValidationResult {
  passed: boolean
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ValidationSummary {
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  results: ValidationResult[]
}

// ============================================================================
// CONFIGURATION CHECKS
// ============================================================================

const REQUIRED_STRICT_OPTIONS = [
  'strict',
  'noImplicitAny',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'noImplicitThis',
  'useUnknownInCatchVariables',
  'alwaysStrict',
] as const

const RECOMMENDED_ADDITIONAL_OPTIONS = [
  'noUnusedLocals',
  'noUnusedParameters',
  'exactOptionalPropertyTypes',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch',
  'noUncheckedIndexedAccess',
  'noImplicitOverride',
  'noPropertyAccessFromIndexSignature',
] as const

const REQUIRED_CONFIG_FILES = [
  'tsconfig.json',
  'tsconfig.astro.json',
  'tsconfig.test.json',
] as const

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function readTSConfig(filePath: string): TSConfig | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    // Remove comments for JSON parsing
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    return JSON.parse(cleanContent)
  } catch (error) {
    console.warn(`Failed to read ${filePath}: ${error}`)
    return null
  }
}

function validateConfigFile(filePath: string): ValidationResult[] {
  const results: ValidationResult[] = []

  // Check if file exists
  if (!existsSync(filePath)) {
    return [
      {
        passed: false,
        message: `Configuration file ${filePath} does not exist`,
        severity: 'error',
      },
    ]
  }

  const config = readTSConfig(filePath)
  if (!config) {
    return [
      {
        passed: false,
        message: `Failed to parse ${filePath}`,
        severity: 'error',
      },
    ]
  }

  const compilerOptions = config.compilerOptions || {}

  // Check strict options
  for (const option of REQUIRED_STRICT_OPTIONS) {
    if (compilerOptions[option] !== true) {
      results.push({
        passed: false,
        message: `${filePath}: Missing or disabled strict option "${option}"`,
        severity: 'error',
      })
    } else {
      results.push({
        passed: true,
        message: `${filePath}: Strict option "${option}" is properly enabled`,
        severity: 'info',
      })
    }
  }

  // Check additional recommended options
  for (const option of RECOMMENDED_ADDITIONAL_OPTIONS) {
    if (
      filePath.includes('test.json') &&
      (option === 'noUnusedLocals' || option === 'noUnusedParameters')
    ) {
      if (compilerOptions[option] !== false) {
        results.push({
          passed: true,
          message: `${filePath}: Test-specific option "${option}" is properly disabled for tests`,
          severity: 'info',
        })
      }
      continue
    }

    if (compilerOptions[option] !== true) {
      results.push({
        passed: false,
        message: `${filePath}: Recommended option "${option}" is not enabled`,
        severity: 'warning',
      })
    } else {
      results.push({
        passed: true,
        message: `${filePath}: Recommended option "${option}" is enabled`,
        severity: 'info',
      })
    }
  }

  // Check specific settings
  if (compilerOptions['skipLibCheck'] !== false) {
    results.push({
      passed: false,
      message: `${filePath}: "skipLibCheck" should be false for strict typing`,
      severity: 'warning',
    })
  }

  // Check path mappings
  const { paths } = compilerOptions
  if (!paths || !paths['@/*'] || !paths['@types/*']) {
    results.push({
      passed: false,
      message: `${filePath}: Missing required path mappings (@/*, @types/*)`,
      severity: 'error',
    })
  }

  return results
}

function validateTypeFiles(): ValidationResult[] {
  const results: ValidationResult[] = []
  const requiredTypeFiles = [
    'src/types/index.ts',
    'src/types/utility.ts',
    'src/types/environment.ts',
  ]

  for (const filePath of requiredTypeFiles) {
    if (!existsSync(filePath)) {
      results.push({
        passed: false,
        message: `Required type file ${filePath} does not exist`,
        severity: 'error',
      })
    } else {
      results.push({
        passed: true,
        message: `Type file ${filePath} exists`,
        severity: 'info',
      })
    }
  }

  return results
}

function validateCompilation(): ValidationResult[] {
  const results: ValidationResult[] = []

  try {
    // Test TypeScript compilation
    console.log('Running TypeScript compilation check...')

    // Check main config
    execSync('npx tsc --noEmit --project tsconfig.json', {
      stdio: 'pipe',
      timeout: 30000,
    })

    results.push({
      passed: true,
      message: 'Main TypeScript configuration compiles without errors',
      severity: 'info',
    })

    // Check Astro config
    execSync('npx tsc --noEmit --project tsconfig.astro.json', {
      stdio: 'pipe',
      timeout: 30000,
    })

    results.push({
      passed: true,
      message: 'Astro TypeScript configuration compiles without errors',
      severity: 'info',
    })

    // Check test config
    execSync('npx tsc --noEmit --project tsconfig.test.json', {
      stdio: 'pipe',
      timeout: 30000,
    })

    results.push({
      passed: true,
      message: 'Test TypeScript configuration compiles without errors',
      severity: 'info',
    })
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : String(error)
    results.push({
      passed: false,
      message: `TypeScript compilation failed: ${errorOutput}`,
      severity: 'error',
    })
  }

  return results
}

function validateESLintIntegration(): ValidationResult[] {
  const results: ValidationResult[] = []

  if (!existsSync('eslint.config.js')) {
    results.push({
      passed: false,
      message: 'ESLint configuration file not found',
      severity: 'warning',
    })
    return results
  }

  try {
    // Check if ESLint can run with TypeScript
    execSync('npx eslint --print-config src/types/index.ts', {
      stdio: 'pipe',
      timeout: 15000,
    })

    results.push({
      passed: true,
      message: 'ESLint is properly integrated with TypeScript',
      severity: 'info',
    })
  } catch (error) {
    results.push({
      passed: false,
      message: 'ESLint integration with TypeScript has issues',
      severity: 'warning',
    })
  }

  return results
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

function validateTypeScriptSetup(): ValidationSummary {
  console.log('🔍 Validating Enhanced TypeScript Configuration...\n')

  const allResults: ValidationResult[] = []

  // Validate configuration files
  console.log('📁 Checking configuration files...')
  for (const configFile of REQUIRED_CONFIG_FILES) {
    allResults.push(...validateConfigFile(configFile))
  }

  // Validate type files
  console.log('\n📝 Checking type definition files...')
  allResults.push(...validateTypeFiles())

  // Validate compilation
  console.log('\n🔨 Testing compilation...')
  allResults.push(...validateCompilation())

  // Validate ESLint integration
  console.log('\n🔧 Checking ESLint integration...')
  allResults.push(...validateESLintIntegration())

  // Generate summary
  const summary: ValidationSummary = {
    totalChecks: allResults.length,
    passed: allResults.filter((r) => r.passed).length,
    failed: allResults.filter((r) => !r.passed && r.severity === 'error')
      .length,
    warnings: allResults.filter((r) => !r.passed && r.severity === 'warning')
      .length,
    results: allResults,
  }

  return summary
}

// ============================================================================
// REPORTING
// ============================================================================

function printResults(summary: ValidationSummary): void {
  console.log('\n' + '='.repeat(60))
  console.log('📊 TYPESCRIPT CONFIGURATION VALIDATION SUMMARY')
  console.log('='.repeat(60))

  console.log(`\n✅ Passed: ${summary.passed}`)
  console.log(`❌ Failed: ${summary.failed}`)
  console.log(`⚠️  Warnings: ${summary.warnings}`)
  console.log(`📊 Total Checks: ${summary.totalChecks}`)

  if (summary.failed > 0) {
    console.log('\n🚨 CRITICAL ISSUES:')
    summary.results
      .filter((r) => !r.passed && r.severity === 'error')
      .forEach((r) => console.log(`   ❌ ${r.message}`))
  }

  if (summary.warnings > 0) {
    console.log('\n⚠️  WARNINGS:')
    summary.results
      .filter((r) => !r.passed && r.severity === 'warning')
      .forEach((r) => console.log(`   ⚠️  ${r.message}`))
  }

  console.log('\n' + '='.repeat(60))

  if (summary.failed === 0) {
    console.log(
      '🎉 TypeScript configuration validation completed successfully!',
    )
    console.log('✨ Enhanced strict typing is properly configured!')
  } else {
    console.log('❌ TypeScript configuration validation failed!')
    console.log('🔧 Please fix the critical issues above.')
  }

  console.log('='.repeat(60))
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

if (require.main === module) {
  try {
    const summary = validateTypeScriptSetup()
    printResults(summary)

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('❌ Validation script failed:', error)
    process.exit(1)
  }
}

export {
  validateTypeScriptSetup,
  type ValidationSummary,
  type ValidationResult,
}
