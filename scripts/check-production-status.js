#!/usr/bin/env node

/**
 * Simple Production Readiness Status Checker
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

const checks = [
  {
    id: 'crisis-detection',
    name: 'Crisis Detection Service',
    file: 'src/lib/ai/services/crisis-detection.ts',
    required: true
  },
  {
    id: 'health-monitor',
    name: 'Health Monitoring',
    file: 'src/lib/services/health-monitor.ts',
    required: true
  },
  {
    id: 'uptime-monitor',
    name: 'Uptime Monitoring',
    file: 'src/lib/services/uptime-monitor.ts',
    required: true
  },
  {
    id: 'security-workflow',
    name: 'Security Scanning Workflow',
    file: '.github/workflows/security-scanning.yml',
    required: true
  },
  {
    id: 'security-baseline',
    name: 'Security Baseline',
    file: 'security-baseline.json',
    required: true
  },
  {
    id: 'performance-validation',
    name: 'Performance Validation',
    file: 'scripts/performance-validation.js',
    required: true
  },
  {
    id: 'group-i-validator',
    name: 'Group I Validator',
    file: 'scripts/group-i-validator.js',
    required: true
  },
  {
    id: 'health-api',
    name: 'Health Check API',
    file: 'src/pages/api/v1/health.ts',
    required: true
  },
  {
    id: 'production-api',
    name: 'Production Readiness API',
    file: 'src/pages/api/v1/production-readiness.ts',
    required: true
  },
  {
    id: 'readme',
    name: 'Documentation (README)',
    file: 'README.md',
    required: false
  },
  {
    id: 'docs',
    name: 'Documentation Directory',
    file: 'src/content/docs',
    required: false
  },
  {
    id: 'tests',
    name: 'Test Directory',
    file: 'tests',
    required: false
  }
]

function checkFile(filePath) {
  return existsSync(join(process.cwd(), filePath))
}

function runChecks() {
  console.log('🔍 Production Readiness Status Check')
  console.log('=' .repeat(50))
  
  let passed = 0
  let failed = 0
  let warnings = 0
  
  for (const check of checks) {
    const exists = checkFile(check.file)
    
    if (exists) {
      console.log(`✅ ${check.name}`)
      passed++
    } else if (check.required) {
      console.log(`❌ ${check.name} (REQUIRED)`)
      failed++
    } else {
      console.log(`⚠️  ${check.name} (OPTIONAL)`)
      warnings++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`Total Checks: ${checks.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Warnings: ${warnings}`)
  
  const score = (passed / checks.length) * 100
  console.log(`Score: ${score.toFixed(1)}%`)
  
  let status = 'PRODUCTION READY'
  if (failed > 0) {
    status = 'NOT PRODUCTION READY'
  } else if (warnings > 0) {
    status = 'PRODUCTION READY (WITH WARNINGS)'
  }
  
  console.log(`Status: ${status}`)
  
  if (failed > 0) {
    console.log('\n❌ CRITICAL ISSUES:')
    for (const check of checks) {
      if (check.required && !checkFile(check.file)) {
        console.log(`  - Missing: ${check.name} (${check.file})`)
      }
    }
  }
  
  return failed === 0
}

// Run the checks
const success = runChecks()
process.exit(success ? 0 : 1)
